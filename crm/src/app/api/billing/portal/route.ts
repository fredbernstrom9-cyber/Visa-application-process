import { NextResponse, type NextRequest } from 'next/server';
import { getOrgContext } from '@/lib/auth/session';
import { getStripe } from '@/lib/billing';
import { appUrl, isStripeConfigured } from '@/lib/env';
import { isAdmin } from '@/lib/domain';
import { isSameOrigin } from '@/lib/same-origin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!isAdmin(ctx.role)) return NextResponse.json({ error: 'Only owners and admins can manage billing' }, { status: 403 });
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Billing is not configured on this deployment' }, { status: 503 });
  if (!ctx.org.stripe_customer_id) return NextResponse.json({ error: 'No billing account yet. Upgrade first.' }, { status: 404 });
  const session = await getStripe().billingPortal.sessions.create({ customer: ctx.org.stripe_customer_id, return_url: `${appUrl()}/settings/billing` });
  return NextResponse.json({ url: session.url });
}
