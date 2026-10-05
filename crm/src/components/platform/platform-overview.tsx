'use client';

import { useMemo, useState } from 'react';
import { Building2, Search, Users } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { formatDate, relativeTime } from '@/lib/format';
import type { PlatformOrg, PlatformOverviewData } from '@/lib/platform-types';

const nf = new Intl.NumberFormat('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${nf.format(n)} ${n === 1 ? one : many}`;

type SortKey = 'newest' | 'applicants' | 'open_cases' | 'activity' | 'name';
const SORTS: { key: SortKey; label: string; cmp: (a: PlatformOrg, b: PlatformOrg) => number }[] = [
  { key: 'newest', label: 'Newest first', cmp: (a, b) => b.created_at.localeCompare(a.created_at) },
  { key: 'applicants', label: 'Most applicants', cmp: (a, b) => b.applicants - a.applicants },
  { key: 'open_cases', label: 'Most open cases', cmp: (a, b) => b.open_cases - a.open_cases },
  { key: 'activity', label: 'Recently active', cmp: (a, b) => (b.last_activity_at ?? '').localeCompare(a.last_activity_at ?? '') },
  { key: 'name', label: 'Name (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name) },
];

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="grid gap-1 py-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{typeof value === 'number' ? nf.format(value) : value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function SignupBars({ weeks }: { weeks: PlatformOverviewData['weekly_signups'] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.organisations, w.users]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>New sign-ups per week</CardTitle>
        <CardDescription>Last 12 weeks, week starting on the date shown.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} aria-hidden /> Organisations</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} aria-hidden /> Users</span>
        </div>
        <ol className="grid h-40 grid-cols-12 items-end gap-1.5 border-b" aria-label="Weekly sign-ups">
          {weeks.map((w) => (
            <li key={w.week_start} className="flex h-full flex-col justify-end" title={`Week of ${formatDate(w.week_start)}: ${w.organisations} organisations, ${w.users} users`}>
              <div className="flex h-full items-end justify-center gap-0.5">
                <span className="w-full max-w-3 rounded-t-sm" style={{ height: `${(w.organisations / max) * 100}%`, minHeight: w.organisations ? 3 : 0, background: 'var(--series-1)' }} />
                <span className="w-full max-w-3 rounded-t-sm" style={{ height: `${(w.users / max) * 100}%`, minHeight: w.users ? 3 : 0, background: 'var(--series-2)' }} />
              </div>
              <span className="sr-only">{`Week of ${formatDate(w.week_start)}: ${w.organisations} organisations, ${w.users} users`}</span>
            </li>
          ))}
        </ol>
        <ol className="mt-1.5 grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground" aria-hidden>
          {weeks.map((w, i) => <li key={w.week_start} className="truncate text-center">{i % 2 === 0 ? new Date(w.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''}</li>)}
        </ol>
      </CardContent>
    </Card>
  );
}

export function PlatformOverview({ data }: { data: PlatformOverviewData }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const t = data.totals;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cmp = SORTS.find((s) => s.key === sort)!.cmp;
    return data.organisations.filter((o) => !needle || o.name.toLowerCase().includes(needle)).sort(cmp);
  }, [data.organisations, q, sort]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Platform overview"
        description="Usage across every organisation. Read-only, and it never shows applicant names, e-mails, documents or notes."
        actions={<span className="text-xs text-muted-foreground">Updated {relativeTime(data.generated_at)}</span>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Organisations" value={t.organisations} hint={`${t.premium_organisations} Premium · ${t.free_organisations} Free`} />
        <Kpi label="Users" value={t.users} hint={`+${t.new_users_7d} this week · +${t.new_users_30d} in 30 days`} />
        <Kpi label="Applicants" value={t.applicants} hint={`${plural(t.cases, 'case')} · ${nf.format(t.open_cases)} open`} />
        <Kpi label="Active this week" value={t.active_organisations_7d} hint={`${plural(t.new_organisations_7d, 'new organisation')} this week · ${t.new_organisations_30d} in 30 days`} />
      </div>

      <SignupBars weeks={data.weekly_signups} />

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Organisations</CardTitle>
            <CardDescription>Showing {rows.length} of {data.organisations.length}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisations" aria-label="Search organisations" className="w-56 pl-8" />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort organisations"
              className="h-9 rounded-md border bg-background px-2.5 text-sm"
            >
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2 pt-3">
          {data.organisations.length === 0 ? (
            <div className="px-5 pb-4">
              <EmptyState icon={Building2} title="No organisations yet">Sign-ups will appear here as soon as the first organisation is created.</EmptyState>
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No organisation matches “{q}”.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Organisation</TableHead><TableHead>Plan</TableHead>
                  <TableHead className="text-right">Members</TableHead><TableHead className="text-right">Applicants</TableHead>
                  <TableHead className="text-right">Open cases</TableHead><TableHead className="text-right">Approved / refused</TableHead>
                  <TableHead>Last activity</TableHead><TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="max-w-64 truncate font-medium">{o.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={o.plan === 'premium' ? 'ok' : 'neutral'}>{o.plan === 'premium' ? 'Premium' : 'Free'}</Badge>
                        {o.subscription_status && o.subscription_status !== 'active' && <Badge tone="warn">{o.subscription_status.replace('_', ' ')}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums"><span className="inline-flex items-center gap-1"><Users className="size-3 text-muted-foreground" aria-hidden />{nf.format(o.members)}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(o.applicants)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(o.open_cases)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(o.approved)} / {nf.format(o.refused)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{o.last_activity_at ? relativeTime(o.last_activity_at) : 'No activity yet'}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
