import 'server-only';
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Plan } from '@/lib/plans';

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  stripe ??= new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  return stripe;
}

/** Subscription states that keep Premium on. `past_due` is a grace period while Stripe retries the card. */
const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due']);
export const planForStatus = (status: string): Plan => (PREMIUM_STATUSES.has(status) ? 'premium' : 'free');

export function periodEnd(sub: Stripe.Subscription): string | null {
  // Newer API versions moved the period onto subscription items.
  const unix = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

const customerId = (c: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) => (typeof c === 'string' ? c : c?.id ?? null);

/**
 * Apply a subscription snapshot to its organisation. Out-of-order events are ignored by comparing
 * the event timestamp with the last one applied. Returns the organisation id that was updated.
 */
export async function applySubscription(admin: SupabaseClient, sub: Stripe.Subscription, eventCreated: number): Promise<string | null> {
  const cid = customerId(sub.customer);
  let orgId = (sub.metadata?.org_id as string | undefined) ?? null;
  if (!orgId && cid) {
    const { data } = await admin.from('organizations').select('id').eq('stripe_customer_id', cid).maybeSingle();
    orgId = (data?.id as string | undefined) ?? null;
  }
  if (!orgId) return null;
  const at = new Date(eventCreated * 1000).toISOString();
  const { data: cur } = await admin.from('organizations').select('billing_event_at').eq('id', orgId).maybeSingle();
  // Compare instants, not strings: the database may format timestamps with a non-UTC offset.
  if (cur?.billing_event_at && Date.parse(cur.billing_event_at as string) > eventCreated * 1000) return orgId; // stale event
  const { error } = await admin.from('organizations').update({
    plan: planForStatus(sub.status),
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    ...(cid ? { stripe_customer_id: cid } : {}),
    current_period_end: periodEnd(sub),
    billing_event_at: at,
  }).eq('id', orgId);
  if (error) throw new Error(error.message);
  return orgId;
}
