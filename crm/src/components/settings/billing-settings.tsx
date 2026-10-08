'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CreditCard, Minus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { Alert, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { FEATURE_LABELS, limitFor, PLAN_FEATURES, type Feature } from '@/lib/plans';
import { getSupabaseBrowser } from '@/lib/supabase/client';

function useUsage() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['members', org.id, 'usage'],
    queryFn: async () => {
      const s = getSupabaseBrowser();
      const [a, m] = await Promise.all([
        s.from('applicants').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
        s.from('memberships').select('user_id', { count: 'exact', head: true }).eq('org_id', org.id),
      ]);
      return { applicants: a.count ?? 0, seats: m.count ?? 0 };
    },
  });
}

async function go(path: string): Promise<string> {
  const res = await fetch(path, { method: 'POST' });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? 'Something went wrong');
  return body.url;
}

export function BillingSettings({ stripeConfigured, checkout }: { stripeConfigured: boolean; checkout?: string }) {
  const { org, isAdmin } = useOrg();
  const router = useRouter();
  const { data: usage } = useUsage();
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);
  const premium = org.plan === 'premium';
  const appLimit = limitFor(org, 'applicants');
  const seatLimit = limitFor(org, 'seats');

  // After returning from Checkout the webhook may take a few seconds: poll the plan briefly.
  useEffect(() => {
    if (checkout !== 'success' || premium) return;
    let n = 0;
    const t = setInterval(() => { router.refresh(); if (++n > 10) clearInterval(t); }, 2500);
    return () => clearInterval(t);
  }, [checkout, premium, router]);

  async function open(kind: 'checkout' | 'portal') {
    setBusy(kind);
    try { window.location.assign(await go(`/api/billing/${kind}`)); } catch (e) { toast.error((e as Error).message); setBusy(null); }
  }
  const features = Object.keys(FEATURE_LABELS) as Feature[];

  return (
    <div className="grid gap-5">
      {checkout === 'success' && (premium
        ? <Alert tone="ok" title="You are on Premium">Thank you. Every Premium feature is unlocked for your whole team.</Alert>
        : <Alert tone="info" title="Payment received">We are activating Premium. This usually takes a few seconds.</Alert>)}
      {checkout === 'cancelled' && <Alert tone="warn" title="Checkout cancelled">No charge was made. You can upgrade whenever you are ready.</Alert>}
      {org.subscription_status === 'past_due' && <Alert tone="danger" title="Your last payment failed">Update your card in the billing portal to keep Premium. We will retry automatically.</Alert>}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">{premium ? 'Premium' : 'Free'} plan <Badge tone={premium ? 'primary' : 'neutral'}>{premium ? 'Active' : 'Current'}</Badge></CardTitle>
            <CardDescription>
              {premium
                ? `Unlimited applicants and seats.${org.current_period_end ? ` ${org.subscription_status === 'canceled' ? 'Ends' : 'Renews'} ${formatDate(org.current_period_end)}.` : ''}`
                : 'One user and up to 10 applicants, free forever.'}
            </CardDescription>
          </div>
          {isAdmin && (
            premium ? (
              <Button variant="outline" onClick={() => void open('portal')} loading={busy === 'portal'} disabled={!stripeConfigured || !org.stripe_customer_id}><CreditCard /> Manage billing</Button>
            ) : (
              <Button onClick={() => void open('checkout')} loading={busy === 'checkout'} disabled={!stripeConfigured}><Sparkles /> Upgrade to Premium</Button>
            )
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <div className="flex justify-between text-sm"><span>Applicants</span><span className="tabular-nums text-muted-foreground">{usage?.applicants ?? '…'}{appLimit ? ` / ${appLimit}` : ' · unlimited'}</span></div>
            {appLimit && <Progress value={((usage?.applicants ?? 0) / appLimit) * 100} label="Applicants used" />}
          </div>
          <div className="grid gap-1.5">
            <div className="flex justify-between text-sm"><span>Team members</span><span className="tabular-nums text-muted-foreground">{usage?.seats ?? '…'}{seatLimit ? ` / ${seatLimit}` : ' · unlimited'}</span></div>
            {seatLimit && <Progress value={((usage?.seats ?? 0) / seatLimit) * 100} label="Seats used" />}
          </div>
          {!stripeConfigured && isAdmin && (
            <div className="sm:col-span-2"><Alert tone="info" title="Billing is not configured on this deployment">Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PREMIUM and STRIPE_WEBHOOK_SECRET (see the README), then redeploy.</Alert></div>
          )}
          {!isAdmin && <p className="text-sm text-muted-foreground sm:col-span-2">Only owners and admins can change the plan.</p>}
          {premium === false && (usage?.applicants ?? 0) >= 10 && <div className="sm:col-span-2"><Alert tone="warn" title="Applicant limit reached">Upgrade to add more applicants. Existing data stays available.</Alert></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Compare plans</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <Table>
            <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead>Free</TableHead><TableHead>Premium</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>Team members</TableCell><TableCell>1</TableCell><TableCell>Unlimited</TableCell></TableRow>
              <TableRow><TableCell>Applicants</TableCell><TableCell>10</TableCell><TableCell>Unlimited</TableCell></TableRow>
              <TableRow><TableCell>Pipeline, checklists, tasks, deadlines, risk scoring</TableCell><TableCell><Check className="size-4 text-ok" aria-label="Included" /></TableCell><TableCell><Check className="size-4 text-ok" aria-label="Included" /></TableCell></TableRow>
              {features.map((f) => (
                <TableRow key={f}>
                  <TableCell><span className="font-medium">{FEATURE_LABELS[f].name}</span><span className="block text-xs text-muted-foreground">{FEATURE_LABELS[f].blurb}</span></TableCell>
                  <TableCell>{PLAN_FEATURES.free.includes(f) ? <Check className="size-4 text-ok" aria-label="Included" /> : <Minus className="size-4 text-muted-foreground" aria-label="Not included" />}</TableCell>
                  <TableCell><Check className="size-4 text-ok" aria-label="Included" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Payments are processed by Stripe. If you downgrade, nothing is deleted: you keep access to existing data but cannot add beyond the Free limits.</p>
    </div>
  );
}
