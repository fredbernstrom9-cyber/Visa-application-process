'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { countryName, flagEmoji } from '@/lib/countries';
import { OPEN_STAGES, stageLabel } from '@/lib/domain';
import type { CaseFilters } from '@/lib/filters';
import { addDays } from '@/lib/filters';
import {
  useAcceptance, useCohorts, useFunnel, useHorizon, useStageTimes, useThroughput, type HorizonPoint,
} from '@/lib/queries/analytics';
import { axisProps, ChartCard, gridProps, pctLabel, RISK_COLOR, SERIES, shortWeek, TooltipBox } from './chart-kit';

type Drill = (extra: CaseFilters) => void;

const FUNNEL_LABELS: Record<string, string> = {
  admitted: 'Admitted / signed', documents: 'Documents started', appointment: 'Appointment booked', submitted: 'Submitted',
  decision_pending: 'Decision pending', decided: 'Decision made', approved: 'Approved',
};

// ---------------------------------------------------------------------------------------------
export function FunnelChart({ filters, drill }: { filters: CaseFilters; drill: Drill }) {
  const { data, isLoading } = useFunnel(filters);
  const rows = useMemo(() => (data ?? []).map((r, i, a) => ({
    ...r, label: FUNNEL_LABELS[r.step] ?? r.step,
    conv: i === 0 ? null : a[i - 1].reached > 0 ? Math.round((r.reached / a[i - 1].reached) * 1000) / 10 : null,
  })), [data]);
  const empty = rows.length === 0 || rows[0].reached === 0;
  return (
    <ChartCard
      title="Pipeline funnel" description="How many cases reached each stage, and the conversion from the step before. Click a bar to see those cases."
      exportName="pipeline-funnel" loading={isLoading} empty={empty} emptyText="No cases in this selection yet."
      table={{ headers: ['Step', 'Cases reached', 'Conversion from previous step (%)'], rows: rows.map((r) => [r.label, r.reached, r.conv]) }}
    >
      <div role="img" aria-label={`Funnel: ${rows.map((r) => `${r.label} ${r.reached}`).join(', ')}`} className="h-[19rem] w-full">
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 130, bottom: 4, left: 4 }} barCategoryGap={10}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="label" width={128} {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--accent)', opacity: 0.5 }} content={({ active, payload }) => {
              const r = active && payload?.[0]?.payload;
              return r ? <TooltipBox title={r.label} rows={[{ label: 'Cases reached', value: String(r.reached), color: SERIES[0] }, ...(r.conv !== null ? [{ label: 'From previous step', value: pctLabel(r.conv) }] : [])]} hint="Click to open these cases" /> : null;
            }} />
            <Bar dataKey="reached" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={22} style={{ cursor: 'pointer' }}
              onClick={(d) => { const step = (d as unknown as { step: string }).step; drill(step === 'approved' ? { stage: ['approved'] } : step === 'decided' ? { decided: true } : { reached_min: (d as unknown as { ord: number }).ord }); }}>
              <LabelList dataKey="reached" position="right" content={(p) => {
                const { x, y, width, height, index } = p as unknown as { x: number; y: number; width: number; height: number; index: number };
                const r = rows[index];
                return (
                  <text x={(x ?? 0) + (width ?? 0) + 8} y={(y ?? 0) + (height ?? 0) / 2} dominantBaseline="central" fontSize={12} fill="var(--foreground)">
                    <tspan fontWeight={600}>{r.reached.toLocaleString()}</tspan>
                    {r.conv !== null && <tspan fill="var(--muted-foreground)" dx={6}>{r.conv}% of prev.</tspan>}
                  </text>
                );
              }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------------------------
export function ThroughputChart({ filters, drill }: { filters: CaseFilters; drill: Drill }) {
  const { data, isLoading } = useThroughput(filters);
  const [all, setAll] = useState(false);
  const weeks = data ?? [];
  const shown = all ? weeks : weeks.slice(-16);
  const legend = [
    { label: 'Submissions', color: SERIES[0] }, { label: 'Approvals', color: SERIES[2] }, { label: 'Refusals', color: SERIES[1] },
  ];
  return (
    <ChartCard
      title="Weekly throughput" description="Applications submitted and decisions received each week. Click a bar to open the cases behind it."
      legend={legend} exportName="weekly-throughput" loading={isLoading} empty={weeks.length === 0} emptyText="Throughput appears once cases are submitted or decided."
      table={{ headers: ['Week starting', 'Submissions', 'Approvals', 'Refusals'], rows: weeks.map((w) => [w.week, w.submissions, w.approvals, w.refusals]) }}
      actions={weeks.length > 16 ? (
        <button type="button" className="rounded-md px-2 py-1 text-xs text-primary hover:bg-accent" onClick={() => setAll(!all)}>{all ? 'Last 16 weeks' : `All ${weeks.length} weeks`}</button>
      ) : undefined}
    >
      <div role="img" aria-label="Weekly submissions, approvals and refusals" className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={shown} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2} barCategoryGap="16%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="week" tickFormatter={shortWeek} {...axisProps} minTickGap={24} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--accent)', opacity: 0.5 }} content={({ active, payload, label }) => active && payload?.length ? (
              <TooltipBox title={`Week of ${shortWeek(String(label))}`} rows={payload.map((p) => ({ label: String(p.name), value: String(p.value), color: p.color as string }))} hint="Click a bar to open these cases" />
            ) : null} />
            {([['submissions', 'Submissions', SERIES[0]], ['approvals', 'Approvals', SERIES[2]], ['refusals', 'Refusals', SERIES[1]]] as const).map(([key, name, color]) => (
              <Bar key={key} dataKey={key} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={16} style={{ cursor: 'pointer' }}
                onClick={(d) => {
                  const wk = (d as unknown as { week: string }).week;
                  const range = { from: wk, to: addDays(wk, 6) };
                  drill(key === 'submissions' ? { submitted_from: range.from, submitted_to: range.to }
                    : { stage: [key === 'approvals' ? 'approved' : 'refused'], decided_from: range.from, decided_to: range.to });
                }} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------------------------
const MIN_SAMPLE = 5;
export function AcceptanceChart({ filters, drill, dimension }: { filters: CaseFilters; drill: Drill; dimension: 'destination' | 'nationality' }) {
  const { data, isLoading } = useAcceptance(filters, dimension);
  const rows = useMemo(() => (data ?? []).slice(0, 10).map((r) => ({
    ...r, label: `${flagEmoji(r.key)} ${countryName(r.key) || r.key}`.trim(),
  })), [data]);
  const title = dimension === 'destination' ? 'Acceptance rate by destination' : 'Acceptance rate by nationality';
  const hasSmall = rows.some((r) => r.decided < MIN_SAMPLE);
  return (
    <ChartCard
      title={title} description={`Share of decided cases that were approved, with the number of decisions (n).${hasSmall ? ` Lighter bars have fewer than ${MIN_SAMPLE} decisions: read with care.` : ''}`}
      exportName={`acceptance-by-${dimension}`} loading={isLoading} empty={rows.length === 0} emptyText="Acceptance rates appear once decisions are recorded."
      table={{ headers: [dimension === 'destination' ? 'Destination' : 'Nationality', 'Decisions (n)', 'Approved', 'Refused', 'Acceptance rate (%)'], rows: (data ?? []).map((r) => [countryName(r.key) || r.key, r.decided, r.approved, r.refused, r.rate]) }}
    >
      <div role="img" aria-label={title} style={{ height: Math.max(180, rows.length * 34 + 16) }} className="w-full">
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 4 }} barCategoryGap={8}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis yAxisId="l" type="category" dataKey="label" width={130} {...axisProps} />
            <YAxis
              yAxisId="r" orientation="right" type="category" dataKey="label" width={104} axisLine={false} tickLine={false}
              tick={(props) => {
                const p = props as unknown as { x: number; y: number; payload: { index: number } };
                const r = rows[p.payload.index];
                return r ? (
                  <text x={Number(p.x) + 8} y={p.y} dominantBaseline="central" fontSize={12} fill="var(--foreground)">
                    <tspan fontWeight={600}>{pctLabel(r.rate)}</tspan><tspan fill="var(--muted-foreground)" dx={6}>n={r.decided}</tspan>
                  </text>
                ) : <g />;
              }}
            />
            <Tooltip cursor={{ fill: 'var(--accent)', opacity: 0.5 }} content={({ active, payload }) => {
              const r = active && payload?.[0]?.payload;
              return r ? <TooltipBox title={r.label} rows={[{ label: 'Acceptance rate', value: pctLabel(r.rate) }, { label: 'Decisions (n)', value: String(r.decided) }, { label: 'Approved', value: String(r.approved) }, { label: 'Refused', value: String(r.refused) }]} hint="Click to open the decided cases" /> : null;
            }} />
            <Bar yAxisId="l" dataKey="rate" radius={[0, 4, 4, 0]} barSize={18} minPointSize={2} style={{ cursor: 'pointer' }}
              onClick={(d) => drill({ [dimension]: [(d as unknown as { key: string }).key], decided: true })}>
              {rows.map((r) => <Cell key={r.key} fill={r.decided < MIN_SAMPLE ? 'var(--seq-250)' : SERIES[0]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------------------------
export function StageTimesChart({ filters, drill }: { filters: CaseFilters; drill: Drill }) {
  const { data, isLoading } = useStageTimes(filters);
  const rows = useMemo(() => (data ?? []).map((r) => ({ ...r, label: stageLabel(r.stage), avg: r.avg_days ?? 0, med: r.median_days ?? 0 })), [data]);
  const measured = rows.filter((r) => r.finished > 0);
  const slowest = measured.length ? measured.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  return (
    <ChartCard
      title="Time spent in each stage" legend={[{ label: 'Average days', color: SERIES[0] }, { label: 'Median days', color: SERIES[1] }]}
      description={slowest ? `Bottleneck: ${slowest.label} (average ${slowest.avg} days across ${slowest.finished} completed stays).` : 'Based on cases that have moved on from a stage.'}
      exportName="time-in-stage" loading={isLoading} empty={measured.length === 0} emptyText="Stage durations appear once cases have moved between stages in the app. Imported historical cases have no stage-by-stage history."
      table={{ headers: ['Stage', 'Completed stays', 'Average days', 'Median days', 'Open now', 'Average age of open cases (days)'], rows: rows.map((r) => [r.label, r.finished, r.avg_days, r.median_days, r.open_now, r.avg_open_days]) }}
    >
      <div role="img" aria-label="Average and median days per stage" className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 4 }} barGap={3} barCategoryGap={12}>
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis type="number" {...axisProps} unit=" d" />
            <YAxis type="category" dataKey="label" width={138} {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--accent)', opacity: 0.5 }} content={({ active, payload }) => {
              const r = active && payload?.[0]?.payload;
              return r ? <TooltipBox title={r.label} rows={[
                { label: 'Average', value: r.avg_days === null ? '—' : `${r.avg_days} d`, color: SERIES[0] }, { label: 'Median', value: r.median_days === null ? '—' : `${r.median_days} d`, color: SERIES[1] },
                { label: 'Completed stays', value: String(r.finished) }, { label: 'In this stage now', value: `${r.open_now}${r.avg_open_days !== null ? ` (avg ${r.avg_open_days} d)` : ''}` },
              ]} hint="Click to open cases in this stage" /> : null;
            }} />
            <Bar dataKey="avg" name="Average" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={12} style={{ cursor: 'pointer' }} onClick={(d) => drill({ stage: [(d as unknown as { stage: string }).stage] })}>
              <LabelList dataKey="avg" position="right" fontSize={12} fill="var(--foreground)" formatter={(v: unknown) => (Number(v) > 0 ? `${v} d` : '')} />
            </Bar>
            <Bar dataKey="med" name="Median" fill={SERIES[1]} radius={[0, 4, 4, 0]} barSize={12} style={{ cursor: 'pointer' }} onClick={(d) => drill({ stage: [(d as unknown as { stage: string }).stage] })} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">Stages: {OPEN_STAGES.map(stageLabel).join(' → ')}</p>
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------------------------
function riskShape(level: 'low' | 'medium' | 'high' | 'none') {
  // Colour is never alone: low = circle, medium = diamond, high = triangle, unscored = square
  const Shape = (props: unknown) => {
    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { id: string } };
    const stroke = { stroke: 'var(--card)', strokeWidth: 2 };
    const color = level === 'none' ? 'var(--muted-foreground)' : RISK_COLOR[level];
    const common = { fill: color, ...stroke, style: { cursor: 'pointer' } };
    void payload;
    if (level === 'medium') return <path {...common} d={`M${cx},${cy - 7} L${cx + 7},${cy} L${cx},${cy + 7} L${cx - 7},${cy} Z`} />;
    if (level === 'high') return <path {...common} d={`M${cx},${cy - 7} L${cx + 7},${cy + 6} L${cx - 7},${cy + 6} Z`} />;
    if (level === 'none') return <rect {...common} x={cx - 5} y={cy - 5} width={10} height={10} />;
    return <circle {...common} cx={cx} cy={cy} r={5} />;
  };
  Shape.displayName = `RiskShape-${level}`;
  return Shape;
}
const SHAPES = { low: riskShape('low'), medium: riskShape('medium'), high: riskShape('high'), none: riskShape('none') };
const X_MIN = -30;
const X_MAX = 240;

function jitter(id: string, amp: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return ((h % 1000) / 1000) * amp;
}

export function HorizonChart({ filters }: { filters: CaseFilters }) {
  const router = useRouter();
  const { data, isLoading } = useHorizon(filters);
  const groups = useMemo(() => {
    const g: Record<'low' | 'medium' | 'high' | 'none', (HorizonPoint & { x: number; y: number; id: string })[]> = { low: [], medium: [], high: [], none: [] };
    for (const p of data ?? []) {
      g[p.risk_level ?? 'none'].push({ ...p, id: p.case_id, x: Math.max(X_MIN, Math.min(X_MAX, p.days_to_start)), y: Math.max(0, Math.min(100, (p.docs_pct ?? 0) + jitter(p.case_id, 3))) });
    }
    return g;
  }, [data]);
  const total = data?.length ?? 0;
  return (
    <ChartCard
      title="Start-date horizon"
      description="Open cases by days until the start date (left = urgent) and share of documents verified. Click a point to open the case."
      legend={[{ label: 'Low risk', color: RISK_COLOR.low, shape: 'dot' }, { label: 'Medium risk', color: RISK_COLOR.medium, shape: 'diamond' }, { label: 'High risk', color: RISK_COLOR.high, shape: 'triangle' }, { label: 'Unscored', color: 'var(--muted-foreground)', shape: 'dot' }]}
      exportName="start-date-horizon" loading={isLoading} empty={total === 0} emptyText="Open cases with a start date are plotted here."
      table={{ headers: ['Applicant', 'Destination', 'Stage', 'Start date', 'Days until start', 'Docs verified (%)', 'Risk', 'Slack (days)'], rows: (data ?? []).map((p) => [p.full_name, countryName(p.destination), stageLabel(p.stage), p.start_date, p.days_to_start, p.docs_pct, p.risk_level ?? 'unscored', p.slack_days]) }}
    >
      <div role="img" aria-label={`${total} open cases plotted by days until start`} className="h-80 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: -8 }}>
            <CartesianGrid {...gridProps} vertical />
            <XAxis type="number" dataKey="x" domain={[X_MIN, X_MAX]} allowDataOverflow {...axisProps} label={{ value: 'Days until start', position: 'insideBottom', offset: -10, fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis type="number" dataKey="y" domain={[0, 100]} {...axisProps} unit="%" />
            <ZAxis range={[80, 80]} />
            <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="0" label={{ value: 'today', fill: 'var(--muted-foreground)', fontSize: 11, position: 'insideTopRight' }} />
            <Tooltip cursor={false} content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as (HorizonPoint & { id: string }) | undefined);
              return p ? <TooltipBox title={p.full_name} rows={[
                { label: 'Destination', value: countryName(p.destination) }, { label: 'Stage', value: stageLabel(p.stage) }, { label: 'Starts in', value: `${p.days_to_start} d` },
                { label: 'Docs verified', value: `${p.docs_pct ?? 0}%` }, { label: 'Slack', value: p.slack_days === null ? '—' : `${p.slack_days} d` },
              ]} hint="Click to open the case" /> : null;
            }} />
            {(['low', 'medium', 'high', 'none'] as const).map((k) => (
              <Scatter key={k} name={k} data={groups[k]} shape={SHAPES[k] as never} isAnimationActive={false}
                onClick={(d) => { const id = (d as unknown as { id?: string; payload?: { id: string } }); router.push(`/cases/${id.id ?? id.payload?.id}`); }} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {(data ?? []).some((p) => p.days_to_start > X_MAX || p.days_to_start < X_MIN) && <p className="text-xs text-muted-foreground">Cases beyond {X_MIN} / +{X_MAX} days are drawn at the edge; the tooltip shows the real value.</p>}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------------------------
const METRICS = [
  { key: 'documents_plus', label: 'Documents started' }, { key: 'appointment_plus', label: 'Appointment booked' },
  { key: 'submitted_plus', label: 'Submitted' }, { key: 'decided_plus', label: 'Decision made' },
] as const;

export function CohortChart({ filters, drill }: { filters: CaseFilters; drill: Drill }) {
  const { data, isLoading } = useCohorts(filters);
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('submitted_plus');
  const { intakes, rows, sizes } = useMemo(() => {
    const all = [...new Set((data ?? []).map((r) => r.intake))].sort();
    const size = new Map<string, number>();
    for (const r of data ?? []) size.set(r.intake, Math.max(size.get(r.intake) ?? 0, r.total));
    const top = [...all].sort((a, b) => (size.get(b) ?? 0) - (size.get(a) ?? 0)).slice(0, 6).sort();
    const byWeek = new Map<number, Record<string, number | null>>();
    for (let w = 24; w >= 0; w--) byWeek.set(w, { wk: w });
    for (const r of data ?? []) {
      if (!top.includes(r.intake)) continue;
      byWeek.get(r.weeks_before)![r.intake] = r.total > 0 ? Math.round((r[metric] / r.total) * 1000) / 10 : null;
    }
    return { intakes: top, rows: [...byWeek.values()], sizes: size };
  }, [data, metric]);
  const colorOf = (i: string) => SERIES[Math.max(0, [...new Set((data ?? []).map((r) => r.intake))].sort().indexOf(i)) % SERIES.length];
  const label = METRICS.find((m) => m.key === metric)!.label;
  return (
    <ChartCard
      title="Cohort progress toward start" description={`Share of each intake that has reached “${label}” in the weeks before its start date. Only weeks that have already happened are shown.`}
      legend={intakes.map((i) => ({ label: `${i} (${sizes.get(i)})`, color: colorOf(i), shape: 'line' as const }))}
      exportName="cohort-progress" loading={isLoading} empty={intakes.length === 0} emptyText="Give cases an intake and a start date to see how each cohort progresses."
      table={{ headers: ['Intake', 'Weeks before start', 'Cases in cohort', ...METRICS.map((m) => m.label)], rows: (data ?? []).map((r) => [r.intake, r.weeks_before, r.total, r.documents_plus, r.appointment_plus, r.submitted_plus, r.decided_plus]) }}
      actions={null}
    >
      <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
        <TabsList className="h-auto flex-wrap">{METRICS.map((m) => <TabsTrigger key={m.key} value={m.key} className="text-xs">{m.label}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div role="img" aria-label={`Cohort progress: ${label}`} className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 16, left: -8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="wk" reversed type="number" domain={[0, 24]} ticks={[24, 20, 16, 12, 8, 4, 0]} tickFormatter={(v) => (v === 0 ? 'start' : `-${v}w`)} {...axisProps} label={{ value: 'Weeks before start date', position: 'insideBottom', offset: -10, fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis domain={[0, 100]} unit="%" {...axisProps} />
            <Tooltip content={({ active, payload, label: l }) => active && payload?.length ? (
              <TooltipBox title={Number(l) === 0 ? 'Start date' : `${l} weeks before start`} rows={payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => ({ label: String(p.name), value: pctLabel(Number(p.value)), color: p.color as string, shape: 'line' as const }))} hint="Click a line to open the intake" />
            ) : null} />
            {intakes.map((i) => (
              <Line key={i} dataKey={i} name={i} stroke={colorOf(i)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" connectNulls={false} isAnimationActive={false}
                dot={false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2, onClick: () => drill({ intake: [i] }), style: { cursor: 'pointer' } }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
