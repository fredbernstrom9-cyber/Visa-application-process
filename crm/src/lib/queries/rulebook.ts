'use client';

import { useQuery } from '@tanstack/react-query';
import { useOrg } from '@/components/app/org-context';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { CaseRow, RuleChange, RuleFact, RuleGuide, RuleRequirement, RuleSource, RulebookMeta } from '@/lib/types';

// The rulebook is shared and changes rarely, so it is cached for a long time. Query keys start
// with 'rulebook' so a rule-change notification can refresh all of them at once.
const LONG = 30 * 60_000;

export function useRulebookMeta() {
  return useQuery({
    queryKey: ['rulebook', 'meta'],
    staleTime: LONG,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('rulebook_meta').select('version, verified_on, synced_at').maybeSingle();
      if (error) throw error;
      return data as RulebookMeta | null;
    },
  });
}

/** Every source (a couple of hundred short rows), keyed by id. */
export function useRuleSources() {
  return useQuery({
    queryKey: ['rulebook', 'sources'],
    staleTime: LONG,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('rulebook_sources').select('*');
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as RuleSource[]).map((s) => [s.id, s])) as Record<string, RuleSource>;
    },
  });
}

export function useRuleGuides() {
  return useQuery({
    queryKey: ['rulebook', 'guides'],
    staleTime: LONG,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('rulebook_guides').select('*').eq('active', true).order('id');
      if (error) throw error;
      return (data ?? []) as RuleGuide[];
    },
  });
}

export function useRuleGuide(guideId: string | null) {
  return useQuery({
    queryKey: ['rulebook', 'guide', guideId],
    enabled: Boolean(guideId),
    staleTime: LONG,
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const [g, r, f] = await Promise.all([
        supabase.from('rulebook_guides').select('*').eq('id', guideId!).maybeSingle(),
        supabase.from('rulebook_requirements').select('*').eq('guide_id', guideId!).eq('active', true).order('sort_order'),
        supabase.from('rulebook_facts').select('*').eq('guide_id', guideId!).eq('active', true).order('sort_order'),
      ]);
      if (g.error) throw g.error;
      if (r.error) throw r.error;
      if (f.error) throw f.error;
      return { guide: g.data as RuleGuide | null, requirements: (r.data ?? []) as RuleRequirement[], facts: (f.data ?? []) as RuleFact[] };
    },
  });
}

/** The rulebook rows behind a case's checklist items (for sources and confidence). */
export function useRequirementsById(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['rulebook', 'requirements', sorted],
    enabled: sorted.length > 0,
    staleTime: LONG,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('rulebook_requirements').select('*').in('id', sorted);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as RuleRequirement[]).map((r) => [r.id, r])) as Record<string, RuleRequirement>;
    },
  });
}

/** Key figures (funds, fees, work rights ...) that apply to one case. */
export function useCaseRuleFacts(caseId: string, deps: unknown[] = []) {
  return useQuery({
    queryKey: ['rulebook', 'case-facts', caseId, ...deps],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc('case_rule_facts', { p_case: caseId });
      if (error) throw error;
      return (data ?? []) as RuleFact[];
    },
  });
}

export function useRuleChanges() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['rulebook', 'changes', org.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const [c, n] = await Promise.all([
        supabase.from('rulebook_changes').select('*').order('effective_on', { ascending: false }).limit(200),
        supabase.rpc('rule_change_counts', { p_org: org.id }),
      ]);
      if (c.error) throw c.error;
      if (n.error) throw n.error;
      const counts = Object.fromEntries(((n.data ?? []) as { change_id: string; open_cases: number }[]).map((x) => [x.change_id, x.open_cases]));
      return ((c.data ?? []) as RuleChange[]).map((ch) => ({ ...ch, open_cases: (counts[ch.id] as number | undefined) ?? 0 }));
    },
  });
}

export function useRuleChangeCases(changeId: string | null) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['rulebook', 'change-cases', org.id, changeId],
    enabled: Boolean(changeId),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc('rule_change_cases', { p_change: changeId! });
      if (error) throw error;
      return ((data ?? []) as CaseRow[]).filter((c) => c.org_id === org.id);
    },
  });
}
