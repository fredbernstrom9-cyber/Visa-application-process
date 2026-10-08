'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FEATURE_LABELS, type Feature } from '@/lib/plans';
import { cn } from '@/lib/utils';
import { useOrg } from './org-context';

/** Inline upgrade prompt for a Premium feature. */
export function UpgradeCard({ feature, className, compact }: { feature: Feature; className?: string; compact?: boolean }) {
  const { isAdmin } = useOrg();
  const f = FEATURE_LABELS[feature];
  return (
    <Card className={cn('border-primary/30 bg-gradient-to-br from-accent/60 to-card', className)}>
      <CardContent className={cn('flex flex-col items-start gap-3', compact ? 'py-4' : 'py-8 sm:items-center sm:text-center')}>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Lock className="size-4" /></span>
        <div className="grid gap-1">
          <p className="font-semibold">{f.name} is a Premium feature</p>
          <p className="max-w-md text-sm text-muted-foreground">{f.blurb}</p>
        </div>
        {isAdmin ? (
          <Button asChild size={compact ? 'sm' : 'default'}><Link href="/settings/billing"><Sparkles /> Upgrade to Premium</Link></Button>
        ) : (
          <p className="text-xs text-muted-foreground">Ask an owner or admin of your organisation to upgrade.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders children when the plan includes `feature`, otherwise an upgrade prompt. */
export function PremiumGate({ feature, children, fallback }: { feature: Feature; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canUse } = useOrg();
  if (canUse(feature)) return <>{children}</>;
  return <>{fallback ?? <UpgradeCard feature={feature} />}</>;
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      <Sparkles className="size-3" /> Premium
    </span>
  );
}

/** Modal upgrade prompt, shown when someone clicks a Premium action on the Free plan. */
export function UpgradeDialog({ feature, open, onOpenChange }: { feature: Feature; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
          <DialogDescription>Unlimited applicants and seats, analytics, live tracking, import / export, portal links and reports.</DialogDescription>
        </DialogHeader>
        <UpgradeCard feature={feature} compact className="border-0 bg-transparent shadow-none" />
      </DialogContent>
    </Dialog>
  );
}
