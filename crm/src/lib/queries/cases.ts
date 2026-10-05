'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useOrg } from '@/components/app/org-context';
import type { CaseFilters } from '@/lib/filters';
import { toRpcFilters } from '@/lib/filters';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { CaseRow, Member, SavedView } from '@/lib/types';

export const SORT_COLUMNS = {
  name: 'full_name', destination: 'destination', stage: 'max_stage_ord', risk: 'slack_days', docs: 'docs_pct',
  start: 'start_date', appointment: 'appointment_date', advisor: 'advisor_name', intake: 'intake',
  updated: 'updated_at', opened: 'opened_on', visa: 'visa_type', nationality: 'nationality',
} as const;
export type SortKey = keyof typeof SORT_COLUMNS;

export interface CaseQuery {
  filters: CaseFilters;
  q: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

/** PostgREST `or=` values must not contain reserved characters. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[%,()*\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function casesRpc(orgId: string, filters: CaseFilters, q: string, count = false): any {
  const supabase = getSupabaseBrowser();
  let query = supabase.rpc('filtered_cases', { p_org: orgId, p_filters: toRpcFilters(filters) }, count ? { count: 'exact' } : undefined);
  const s = sanitizeSearch(q);
  if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,programme.ilike.%${s}%`);
  return query;
}

export async function fetchCasePage(orgId: string, qy: CaseQuery): Promise<{ rows: CaseRow[]; total: number }> {
  const from = qy.page * qy.pageSize;
  const query = casesRpc(orgId, qy.filters, qy.q, true)
    .order(SORT_COLUMNS[qy.sort], { ascending: qy.dir === 'asc', nullsFirst: false })
    .order('id')
    .range(from, from + qy.pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as CaseRow[], total: count ?? 0 };
}

/** Every matching case, fetched in pages (used by exports and the pipeline). */
export async function fetchAllCases(orgId: string, filters: CaseFilters, q = '', max = 20_000): Promise<CaseRow[]> {
  const out: CaseRow[] = [];
  const size = 1000;
  for (let from = 0; from < max; from += size) {
    const { data, error } = await casesRpc(orgId, filters, q).order('id').range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data ?? []) as CaseRow[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export function useCases(qy: CaseQuery) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['cases', org.id, 'list', qy],
    queryFn: () => fetchCasePage(org.id, qy),
    placeholderData: keepPreviousData,
  });
}

export function useAllCases(filters: CaseFilters, key = 'all') {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['cases', org.id, key, filters],
    queryFn: () => fetchAllCases(org.id, filters),
    placeholderData: keepPreviousData,
  });
}

export function useCase(caseId: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['case', org.id, caseId],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.from('case_overview').select('*').eq('id', caseId).maybeSingle();
      if (error) throw error;
      return (data as CaseRow | null) ?? null;
    },
  });
}

export function useMembers() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['members', org.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.from('member_directory').select('*').eq('org_id', org.id).order('full_name');
      if (error) throw error;
      return (data ?? []) as Member[];
    },
    staleTime: 60_000,
  });
}

export interface FilterOptions { intakes: string[]; destinations: string[]; nationalities: string[]; tags: string[] }
export function useFilterOptions() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['filter-options', org.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.rpc('filter_options', { p_org: org.id });
      if (error) throw error;
      return (data ?? { intakes: [], destinations: [], nationalities: [], tags: [] }) as FilterOptions;
    },
    staleTime: 60_000,
  });
}

export function useSavedViews(page: 'applicants' | 'pipeline') {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['views', org.id, page],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.from('saved_views').select('*').eq('org_id', org.id).eq('page', page).order('name');
      if (error) throw error;
      return (data ?? []) as SavedView[];
    },
  });
}
