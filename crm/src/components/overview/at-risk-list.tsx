'use client';

import { AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import { RiskBadge, StageBadge } from '@/components/app/badges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { formatDate } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { useCases } from '@/lib/queries/cases';
import type { CaseRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function Row({ c }: { c: CaseRow }) {
  const hot = useIsHighlighted(c.id);
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5', hot && 'live-flash')}>
      <div className="min-w-40 flex-1">
        <Link href={`/cases/${c.id}`} className="font-medium hover:text-primary hover:underline">{c.full_name}</Link>
        <p className="text-xs text-muted-foreground">Starts {formatDate(c.start_date)} · {c.advisor_name ?? 'Unassigned'}</p>
      </div>
      <StageBadge stage={c.stage} short />
      <RiskBadge level={c.risk_level} reason={c.risk_reason} showReason className="min-w-56 max-w-md flex-1" />
    </li>
  );
}

/** Open cases that most urgently need attention, ordered by remaining slack. */
export function AtRiskList({ limit = 8 }: { limit?: number }) {
  const { data, isLoading } = useCases({ filters: { open: true, risk: ['high', 'medium'] }, q: '', sort: 'risk', dir: 'asc', page: 0, pageSize: limit });
  const rows = data?.rows ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><AlertOctagon className="size-4 text-danger" /> Needs attention</CardTitle>
          <CardDescription>Open cases with the least time left, with the reason behind each score.</CardDescription>
        </div>
        {(data?.total ?? 0) > limit && <Button variant="outline" size="sm" asChild><Link href="/applicants?risk=high,medium&open=1">View all {data?.total}</Link></Button>}
      </CardHeader>
      <CardContent className="pt-1">
        {isLoading ? (
          <div className="grid gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No high or medium risk cases right now. Cases appear here as start dates approach without the work done.</p>
        ) : (
          <ul className="divide-y">{rows.map((c) => <Row key={c.id} c={c} />)}</ul>
        )}
      </CardContent>
    </Card>
  );
}
