'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, ArrowDownRight, ArrowUpRight, Download, FileBarChart, Minus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { CaseFilterBar } from '@/components/app/filter-bar';
import { useOrg } from '@/components/app/org-context';
import { AcceptanceChart, CohortChart, FunnelChart, HorizonChart, StageTimesChart, ThroughputChart } from '@/components/charts/dashboard-charts';
import { ChartCard } from '@/components/charts/chart-kit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { downloadWorkbook } from '@/lib/export';
import { addDays, filtersToParams, parseFilters, type CaseFilters } from '@/lib/filters';
import { formatDate } from '@/lib/format';
import { formatKpi, kpiDelta, type Better, type KpiUnit } from '@/lib/kpi';
import {
  RANGES, rangeWindow, useAcceptance, useAdvisors, useCohorts, useFunnel, useHorizon, useKpis, useStageTimes, useThroughput, type KpiBlock, type RangeKey,
} from '@/lib/queries/analytics';
import { countryName } from '@/lib/countries';
import { stageLabel } from '@/lib/domain';
import { cn } from '@/lib/utils';

interface KpiDef {
  key: string; label: string; unit: KpiUnit; better: Better; hint: string;
  pick: (k: KpiBlock) => number | null; drill?: CaseFilters;
}

const KPIS: KpiDef[] = [
  { key: 'active', label: 'Active cases', unit: 'count', better: 'neutral', hint: 'Open cases', pick: (k) => k.active, drill: { open: true } },
  { key: 'approved', label: 'Approved', unit: 'count', better: 'up', hint: 'Visas granted', pick: (k) => k.approved, drill: { stage: ['approved'] } },
  { key: 'refused', label: 'Refused', unit: 'count', better: 'down', hint: 'Visas refused', pick: (k) => k.refused, drill: { stage: ['refused'] } },
  { key: 'acceptance', label: 'Acceptance rate', unit: 'pct', better: 'up', hint: 'Approved ÷ decided', pick: (k) => k.acceptance_rate, drill: { decided: true } },
  { key: 'high', label: 'High-risk cases', unit: 'count', better: 'down', hint: 'Open and high risk', pick: (k) => k.high_risk, drill: { risk: ['high'], open: true } },
  { key: 'a2d', label: 'Median days: admission → decision', unit: 'days', better: 'down', hint: 'Decided cases', pick: (k) => k.median_admission_to_decision_days, drill: { decided: true } },
  { key: 's2d', label: 'Median days: submission → decision', unit: 'days', better: 'down', hint: 'Decided cases', pick: (k) => k.median_submission_to_decision_days, drill: { decided: true } },
  { key: 'docs', label: 'Documents verified', unit: 'pct', better: 'up', hint: 'Required docs, open cases', pick: (k) => k.docs_verified_pct, drill: { open: true } },
];

const TONE_CLASS = { good: 'text-ok', bad: 'text-danger', neutral: 'text-muted-foreground' } as const;

function DeltaLine({ cur, prev, unit, better, since }: { cur: number | null | undefined; prev: number | null | undefined; unit: KpiUnit; better: Better; since: string }) {
  const d = kpiDelta(cur, prev, unit, better);
  if (!d) return <p className="text-xs text-muted-foreground">{since === 'all' ? 'No comparison for all time' : 'No earlier data to compare'}</p>;
  const Icon = d.direction === 'up' ? ArrowUpRight : d.direction === 'down' ? ArrowDownRight : Minus;
  return (
    <p className={cn('flex items-center gap-1 text-xs font-medium', TONE_CLASS[d.tone])}>
      <Icon className="size-3.5" aria-hidden />
      <span>{d.text}</span>
      <span className="sr-only">{d.direction === 'up' ? 'increase' : d.direction === 'down' ? 'decrease' : ''}{d.tone === 'good' ? ', favourable' : d.tone === 'bad' ? ', unfavourable' : ''}</span>
      <span className="font-normal text-muted-foreground">{since}</span>
    </p>
  );
}

function KpiRow({ filters, drill, days }: { filters: CaseFilters; drill: (f: CaseFilters) => void; days: number | null }) {
  const { data, isLoading } = useKpis(filters);
  const since = days ? `vs previous ${days} days` : 'all';
  if (isLoading && !data) return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" role="list" aria-label="Key figures">
      {KPIS.map((k) => (
        <Card key={k.key} role="listitem" className="transition-colors hover:border-primary/40">
          <button type="button" onClick={() => k.drill && drill(k.drill)} className="grid h-full w-full gap-1 rounded-xl p-4 text-left" aria-label={`${k.label}: ${formatKpi(k.pick(data.current), k.unit)}. Open the cases.`}>
            <span className="text-[13px] leading-tight text-muted-foreground">{k.label}</span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatKpi(k.pick(data.current), k.unit)}</span>
            <DeltaLine cur={k.pick(data.current)} prev={data.previous ? k.pick(data.previous) : null} unit={k.unit} better={k.better} since={since} />
          </button>
        </Card>
      ))}
      <Card role="listitem" className="transition-colors hover:border-primary/40">
        <Link href="/activity?types=stage" className="grid h-full gap-1 rounded-xl p-4" aria-label={`Stage moves today: ${data.stage_moves_today}`}>
          <span className="text-[13px] leading-tight text-muted-foreground">Stage moves today</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{data.stage_moves_today}</span>
          <DeltaLine cur={data.stage_moves_today} prev={data.stage_moves_yesterday} unit="count" better="neutral" since="vs yesterday" />
        </Link>
      </Card>
    </div>
  );
}

function AdvisorTable({ filters, drill }: { filters: CaseFilters; drill: (f: CaseFilters) => void }) {
  const { data, isLoading } = useAdvisors(filters);
  const rows = data ?? [];
  const maxOpen = Math.max(1, ...rows.map((r) => r.open_cases));
  return (
    <ChartCard
      title="Advisor workload & performance" description="Open caseload, risk exposure and results per advisor. Click a name to see their cases."
      exportName="advisor-performance" loading={isLoading} empty={rows.length === 0} emptyText="Assign applicants to advisors to compare workload and results."
      table={{ headers: ['Advisor', 'Open cases', 'High-risk', 'Overdue tasks', 'Decisions', 'Approved', 'Acceptance rate (%)'], rows: rows.map((r) => [r.advisor_name ?? 'Unassigned', r.open_cases, r.high_risk, r.overdue_tasks, r.decided, r.approved, r.acceptance_rate]) }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Advisor</TableHead><TableHead className="min-w-40">Open cases</TableHead><TableHead>High-risk</TableHead><TableHead>Overdue tasks</TableHead><TableHead>Decisions</TableHead><TableHead>Acceptance</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.advisor_id ?? 'none'}>
                <TableCell>
                  <button type="button" className="font-medium hover:text-primary hover:underline" onClick={() => drill({ advisor: [r.advisor_id ?? 'unassigned'], open: true })}>{r.advisor_name ?? 'Unassigned'}</button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2"><span className="w-7 tabular-nums">{r.open_cases}</span><span className="h-2 rounded-r bg-[var(--series-1)]" style={{ width: `${(r.open_cases / maxOpen) * 96}px` }} aria-hidden /></div>
                </TableCell>
                <TableCell className="tabular-nums">{r.high_risk > 0 ? <span className="inline-flex items-center gap-1 font-medium text-danger"><AlertOctagon className="size-3.5" aria-hidden />{r.high_risk}</span> : 0}</TableCell>
                <TableCell className={cn('tabular-nums', r.overdue_tasks > 0 && 'font-medium text-danger')}>{r.overdue_tasks}</TableCell>
                <TableCell className="tabular-nums">{r.decided}</TableCell>
                <TableCell className="tabular-nums">{r.acceptance_rate === null ? '—' : `${r.acceptance_rate}%`} {r.decided > 0 && r.decided < 5 && <span className="text-xs text-muted-foreground">(n={r.decided})</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const { org } = useOrg();
  const range = (sp.get('range') as RangeKey | null) ?? '90';
  const dims = useMemo(() => parseFilters(sp), [sp]);
  const filters = useMemo<CaseFilters>(() => {
    if (range === 'custom') return dims;
    const w = rangeWindow(range);
    return { ...dims, opened_from: w.from, opened_to: w.to };
  }, [dims, range]);

  const setUrl = useCallback((f: CaseFilters, r: RangeKey) => {
    const p = filtersToParams(r === 'custom' ? f : { ...f, opened_from: undefined, opened_to: undefined });
    if (r !== '90') p.set('range', r);
    router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false });
  }, [pathname, router]);

  const drill = useCallback((extra: CaseFilters) => {
    const merged: CaseFilters = { ...filters, ...extra };
    router.push(`/applicants?${filtersToParams(merged)}`);
  }, [filters, router]);

  // Spans for the "vs previous N days" label
  const days = filters.opened_from && filters.opened_to ? Math.round((Date.parse(filters.opened_to) - Date.parse(filters.opened_from)) / 86_400_000) + 1 : null;

  // data for "export everything"
  const funnel = useFunnel(filters); const through = useThroughput(filters); const dest = useAcceptance(filters, 'destination'); const nat = useAcceptance(filters, 'nationality');
  const stages = useStageTimes(filters); const horizon = useHorizon(filters); const cohorts = useCohorts(filters); const advisors = useAdvisors(filters); const kpis = useKpis(filters);

  async function exportAll() {
    const k = kpis.data;
    await downloadWorkbook(`${org.name.replace(/[^\w]+/g, '-')}-analytics-${new Date().toISOString().slice(0, 10)}`, [
      { sheet: 'Filters', headers: ['Filter', 'Value'], rows: [['Admitted between', `${filters.opened_from ?? 'start'} → ${filters.opened_to ?? 'today'}`], ...Object.entries(dims).map(([key, v]) => [key, Array.isArray(v) ? v.join(', ') : String(v)])] },
      { sheet: 'KPIs', headers: ['KPI', 'Current', 'Previous period'], rows: k ? KPIS.map((d) => [d.label, d.pick(k.current), k.previous ? d.pick(k.previous) : null]) : [] },
      { sheet: 'Funnel', headers: ['Step', 'Cases reached'], rows: (funnel.data ?? []).map((r) => [r.step, r.reached]) },
      { sheet: 'Throughput', headers: ['Week', 'Submissions', 'Approvals', 'Refusals'], rows: (through.data ?? []).map((r) => [r.week, r.submissions, r.approvals, r.refusals]) },
      { sheet: 'Acceptance by destination', headers: ['Destination', 'Decisions', 'Approved', 'Refused', 'Rate %'], rows: (dest.data ?? []).map((r) => [countryName(r.key), r.decided, r.approved, r.refused, r.rate]) },
      { sheet: 'Acceptance by nationality', headers: ['Nationality', 'Decisions', 'Approved', 'Refused', 'Rate %'], rows: (nat.data ?? []).map((r) => [countryName(r.key), r.decided, r.approved, r.refused, r.rate]) },
      { sheet: 'Time in stage', headers: ['Stage', 'Completed', 'Avg days', 'Median days', 'Open now'], rows: (stages.data ?? []).map((r) => [stageLabel(r.stage), r.finished, r.avg_days, r.median_days, r.open_now]) },
      { sheet: 'Open cases', headers: ['Applicant', 'Destination', 'Stage', 'Start', 'Days to start', 'Docs %', 'Risk'], rows: (horizon.data ?? []).map((r) => [r.full_name, countryName(r.destination), stageLabel(r.stage), r.start_date, r.days_to_start, r.docs_pct, r.risk_level ?? 'unscored']) },
      { sheet: 'Cohorts', headers: ['Intake', 'Weeks before start', 'Cases', 'Docs started', 'Appointment', 'Submitted', 'Decided'], rows: (cohorts.data ?? []).map((r) => [r.intake, r.weeks_before, r.total, r.documents_plus, r.appointment_plus, r.submitted_plus, r.decided_plus]) },
      { sheet: 'Advisors', headers: ['Advisor', 'Open', 'High-risk', 'Overdue tasks', 'Decisions', 'Approved', 'Rate %'], rows: (advisors.data ?? []).map((r) => [r.advisor_name ?? 'Unassigned', r.open_cases, r.high_risk, r.overdue_tasks, r.decided, r.approved, r.acceptance_rate]) },
    ]);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-xs" role="region" aria-label="Dashboard filters">
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Date range" className="h-8 w-44 text-[13px]" value={range} onChange={(e) => {
            const r = e.target.value as RangeKey;
            if (r === 'custom') { const w = rangeWindow('90'); setUrl({ ...dims, opened_from: w.from, opened_to: w.to }, 'custom'); } else setUrl(dims, r);
          }}>
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            <option value="custom">Custom range…</option>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filters.opened_from || filters.opened_to ? `Cases admitted ${formatDate(filters.opened_from)} – ${formatDate(filters.opened_to ?? addDays(new Date().toISOString().slice(0, 10), 0))}` : 'All cases ever admitted'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void qc.invalidateQueries({ queryKey: ['analytics'] })}>Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => void exportAll()}><Download /> Export all (XLSX)</Button>
            <Button size="sm" asChild><Link href={`/reports?${filtersToParams(dims)}`}><FileBarChart /> Intake report</Link></Button>
          </div>
        </div>
        <CaseFilterBar
          filters={range === 'custom' ? filters : dims}
          onChange={(f) => setUrl(f, range)}
          hide={['stage', 'tag']} dates={range === 'custom'} datesLabel="Cases admitted between"
        />
      </div>

      <KpiRow filters={filters} drill={drill} days={days} />

      <div className="grid gap-5 xl:grid-cols-2">
        <FunnelChart filters={filters} drill={drill} />
        <ThroughputChart filters={filters} drill={drill} />
        <AcceptanceChart filters={filters} drill={drill} dimension="destination" />
        <AcceptanceChart filters={filters} drill={drill} dimension="nationality" />
        <StageTimesChart filters={filters} drill={drill} />
        <HorizonChart filters={filters} />
        <CohortChart filters={filters} drill={drill} />
        <AdvisorTable filters={filters} drill={drill} />
      </div>
      <Card className="border-dashed bg-transparent shadow-none"><CardContent className="py-3 text-xs text-muted-foreground">
        Date range filters cases by the date they were admitted. “Previous period” compares the same measure for the equally long window just before. Risk, document and cohort charts always reflect today’s state of those cases.
      </CardContent></Card>
    </div>
  );
}
