import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { applySubscription, getStripe } from '@/lib/billing';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const body = await request.text(); // the raw body is required for signature verification
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  // Idempotency: Stripe may deliver an event more than once.
  const { error: dupe } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dupe) {
    if (dupe.code === '23505') return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: 'Storage error' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orgId = s.client_reference_id;
        if (orgId && s.customer) {
          await admin.from('organizations').update({
            stripe_customer_id: typeof s.customer === 'string' ? s.customer : s.customer.id,
            ...(s.subscription ? { stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : s.subscription.id } : {}),
          }).eq('id', orgId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(admin, event.data.object as Stripe.Subscription, event.created);
        break;
      default:
        break; // other events are acknowledged and ignored
    }
  } catch (e) {
    console.error('[stripe webhook]', event.type, (e as Error).message);
    await admin.from('stripe_events').delete().eq('id', event.id); // let Stripe retry
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
