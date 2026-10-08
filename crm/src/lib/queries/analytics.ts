'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useOrg } from '@/components/app/org-context';
import { addDays, isoDate, toRpcFilters, type CaseFilters } from '@/lib/filters';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export type RangeKey = '30' | '90' | '180' | 'ytd' | 'all' | 'custom';
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '30', label: 'Last 30 days' }, { key: '90', label: 'Last 90 days' }, { key: '180', label: 'Last 180 days' },
  { key: 'ytd', label: 'Year to date' }, { key: 'all', label: 'All time' },
];

/** "Admitted between" window for a preset, inclusive of today. */
export function rangeWindow(range: RangeKey, today = isoDate(new Date())): { from?: string; to?: string } {
  switch (range) {
    case '30': return { from: addDays(today, -29), to: today };
    case '90': return { from: addDays(today, -89), to: today };
    case '180': return { from: addDays(today, -179), to: today };
    case 'ytd': return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default: return {};
  }
}

export interface KpiBlock {
  total: number; active: number; approved: number; refused: number; acceptance_rate: number | null; high_risk: number;
  median_admission_to_decision_days: number | null; median_submission_to_decision_days: number | null; docs_verified_pct: number | null;
}
export interface Kpis { current: KpiBlock; previous: KpiBlock | null; stage_moves_today: number; stage_moves_yesterday: number }
export interface FunnelStep { step: string; ord: number; reached: number }
export interface ThroughputWeek { week: string; submissions: number; approvals: number; refusals: number }
export interface AcceptanceRow { key: string; decided: number; approved: number; refused: number; rate: number }
export interface StageTime { stage: string; ord: number; finished: number; avg_days: number | null; median_days: number | null; open_now: number; avg_open_days: number | null }
export interface HorizonPoint { case_id: string; full_name: string; destination: string; stage: string; start_date: string; days_to_start: number; docs_pct: number | null; risk_level: 'low' | 'medium' | 'high' | null; slack_days: number | null }
export interface CohortRow { intake: string; weeks_before: number; total: number; documents_plus: number; appointment_plus: number; submitted_plus: number; decided_plus: number }
export interface AdvisorRow { advisor_id: string | null; advisor_name: string | null; open_cases: number; high_risk: number; overdue_tasks: number; decided: number; approved: number; acceptance_rate: number | null }

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function useRpc<T>(name: string, filters: CaseFilters, extra: Record<string, unknown> = {}, map: (d: unknown) => T) {
  const { org, canUse } = useOrg();
  return useQuery({
    queryKey: ['analytics', org.id, name, filters, extra],
    enabled: canUse('analytics'),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc(name, { p_org: org.id, p_filters: toRpcFilters(filters), ...extra });
      if (error) throw error;
      return map(data);
    },
  });
}

export const useKpis = (f: CaseFilters) => useRpc<Kpis>('analytics_kpis', f, {}, (d) => d as Kpis);
export const useFunnel = (f: CaseFilters) =>
  useRpc<FunnelStep[]>('analytics_funnel', f, {}, (d) => ((d ?? []) as FunnelStep[]).map((r) => ({ ...r, reached: Number(r.reached) })));
export const useThroughput = (f: CaseFilters) =>
  useRpc<ThroughputWeek[]>('analytics_throughput', f, {}, (d) => ((d ?? []) as ThroughputWeek[]).map((r) => ({ ...r, week: String(r.week).slice(0, 10), submissions: Number(r.submissions), approvals: Number(r.approvals), refusals: Number(r.refusals) })));
export const useAcceptance = (f: CaseFilters, dimension: 'destination' | 'nationality') =>
  useRpc<AcceptanceRow[]>('analytics_acceptance', f, { p_dimension: dimension }, (d) => ((d ?? []) as AcceptanceRow[]).map((r) => ({ ...r, decided: Number(r.decided), approved: Number(r.approved), refused: Number(r.refused), rate: Number(r.rate) })));
export const useStageTimes = (f: CaseFilters) =>
  useRpc<StageTime[]>('analytics_stage_times', f, {}, (d) => ((d ?? []) as StageTime[]).map((r) => ({ ...r, finished: Number(r.finished), avg_days: num(r.avg_days), median_days: num(r.median_days), open_now: Number(r.open_now), avg_open_days: num(r.avg_open_days) })));
export const useHorizon = (f: CaseFilters) => useRpc<HorizonPoint[]>('analytics_horizon', f, {}, (d) => (d ?? []) as HorizonPoint[]);
export const useCohorts = (f: CaseFilters) =>
  useRpc<CohortRow[]>('analytics_cohorts', f, {}, (d) => ((d ?? []) as CohortRow[]).map((r) => ({ ...r, total: Number(r.total), documents_plus: Number(r.documents_plus), appointment_plus: Number(r.appointment_plus), submitted_plus: Number(r.submitted_plus), decided_plus: Number(r.decided_plus) })));
export const useAdvisors = (f: CaseFilters) =>
  useRpc<AdvisorRow[]>('analytics_advisors', f, {}, (d) => ((d ?? []) as AdvisorRow[]).map((r) => ({ ...r, open_cases: Number(r.open_cases), high_risk: Number(r.high_risk), overdue_tasks: Number(r.overdue_tasks), decided: Number(r.decided), approved: Number(r.approved), acceptance_rate: num(r.acceptance_rate) })));
