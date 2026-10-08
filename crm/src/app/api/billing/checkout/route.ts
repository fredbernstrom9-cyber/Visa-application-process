import { NextResponse, type NextRequest } from 'next/server';
import { getOrgContext } from '@/lib/auth/session';
import { getStripe } from '@/lib/billing';
import { appUrl, isStripeConfigured, requireEnv } from '@/lib/env';
import { isAdmin } from '@/lib/domain';
import { isSameOrigin } from '@/lib/same-origin';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!isAdmin(ctx.role)) return NextResponse.json({ error: 'Only owners and admins can manage billing' }, { status: 403 });
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Billing is not configured on this deployment' }, { status: 503 });
  if (ctx.org.plan === 'premium' && ctx.org.subscription_status && ['active', 'trialing'].includes(ctx.org.subscription_status)) {
    return NextResponse.json({ error: 'This organisation is already on Premium' }, { status: 409 });
  }

  const stripe = getStripe();
  const admin = createSupabaseAdmin();
  let customer = ctx.org.stripe_customer_id;
  if (!customer) {
    const c = await stripe.customers.create({ email: ctx.user.email, name: ctx.org.name, metadata: { org_id: ctx.org.id } });
    customer = c.id;
    await admin.from('organizations').update({ stripe_customer_id: customer }).eq('id', ctx.org.id);
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: ctx.org.id,
    line_items: [{ price: requireEnv('STRIPE_PRICE_ID_PREMIUM'), quantity: 1 }],
    subscription_data: { metadata: { org_id: ctx.org.id } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/settings/billing?checkout=success`,
    cancel_url: `${appUrl()}/settings/billing?checkout=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
