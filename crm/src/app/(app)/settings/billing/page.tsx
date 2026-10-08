import type { Metadata } from 'next';
import { BillingSettings } from '@/components/settings/billing-settings';
import { isStripeConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'Plan & billing' };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const sp = await searchParams;
  return <BillingSettings stripeConfigured={isStripeConfigured()} checkout={sp.checkout} />;
}
