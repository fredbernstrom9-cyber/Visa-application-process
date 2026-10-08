'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useOrg } from '@/components/app/org-context';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type {
  ActivityRow, CaseRow, ChecklistItem, ChecklistTemplate, ItemFile, OrgSettings, PortalLink, ProcessingTime, Task, TemplateItem,
} from '@/lib/types';

export function useItems(caseId: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['items', org.id, caseId],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('checklist_items').select('*').eq('case_id', caseId).order('sort_order').order('created_at');
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });
}

export function useFiles(caseId: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['files', org.id, caseId],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('checklist_item_files').select('*').eq('case_id', caseId).order('created_at');
      if (error) throw error;
      return (data ?? []) as ItemFile[];
    },
  });
}

export function useTemplates() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['settings', org.id, 'templates'],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('checklist_templates').select('*').eq('org_id', org.id).order('name');
      if (error) throw error;
      return (data ?? []) as ChecklistTemplate[];
    },
  });
}

export function useTemplate(id: string | null) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['settings', org.id, 'template', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const [t, items] = await Promise.all([
        supabase.from('checklist_templates').select('*').eq('id', id!).maybeSingle(),
        supabase.from('checklist_template_items').select('*').eq('template_id', id!).order('sort_order'),
      ]);
      if (t.error) throw t.error;
      if (items.error) throw items.error;
      return { template: t.data as ChecklistTemplate | null, items: (items.data ?? []) as TemplateItem[] };
    },
  });
}

/** Which templates the items of this case came from (for the "official source" box). */
export function useCaseTemplates(items: ChecklistItem[], caseId: string) {
  const { org } = useOrg();
  const ids = [...new Set(items.map((i) => i.template_item_id).filter((x): x is string => Boolean(x)))].sort();
  return useQuery({
    queryKey: ['settings', org.id, 'case-templates', caseId, ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data: ti, error } = await supabase.from('checklist_template_items').select('id, template_id').in('id', ids);
      if (error) throw error;
      const tplIds = [...new Set((ti ?? []).map((r) => r.template_id as string))];
      if (tplIds.length === 0) return [] as ChecklistTemplate[];
      const { data, error: e2 } = await supabase.from('checklist_templates').select('*').in('id', tplIds);
      if (e2) throw e2;
      return (data ?? []) as ChecklistTemplate[];
    },
  });
}

export function useCaseTasks(caseId: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['tasks', org.id, 'case', caseId],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('tasks').select('*').eq('case_id', caseId).order('status', { ascending: false }).order('due_date', { nullsFirst: false }).order('created_at');
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useMyTasks(userId: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['tasks', org.id, 'mine', userId],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.from('tasks').select('*').eq('org_id', org.id).eq('assignee_id', userId).order('due_date', { nullsFirst: false });
      if (error) throw error;
      const tasks = (data ?? []) as Task[];
      const caseIds = [...new Set(tasks.map((t) => t.case_id))];
      const names: Record<string, { name: string; stage: string }> = {};
      if (caseIds.length) {
        const { data: cs } = await supabase.from('case_overview').select('id, full_name, stage').in('id', caseIds);
        for (const c of (cs ?? []) as Pick<CaseRow, 'id' | 'full_name' | 'stage'>[]) names[c.id] = { name: c.full_name, stage: c.stage };
      }
      return { tasks, names };
    },
  });
}

export function useApplicantCases(applicantId: string | undefined) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['cases', org.id, 'applicant', applicantId],
    enabled: Boolean(applicantId),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('case_overview').select('*').eq('applicant_id', applicantId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CaseRow[];
    },
  });
}

export function usePortalLinks(caseId: string) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['portal', org.id, caseId],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('portal_links')
        .select('id, org_id, case_id, label, expires_at, revoked_at, created_at, last_used_at, use_count').eq('case_id', caseId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalLink[];
    },
  });
}

export interface ActivityFilter { userId?: string; caseId?: string; groups?: string[]; types?: string[] }

export function useActivity(filter: ActivityFilter, pageSize = 40) {
  const { org } = useOrg();
  return useInfiniteQuery({
    queryKey: ['activity', org.id, filter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = getSupabaseBrowser().from('activity_feed').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(pageSize);
      if (filter.caseId) q = q.eq('case_id', filter.caseId);
      if (filter.userId === 'applicant') q = q.eq('actor_type', 'applicant');
      else if (filter.userId === 'system') q = q.eq('actor_type', 'system');
      else if (filter.userId) q = q.eq('actor_id', filter.userId);
      if (filter.types?.length) q = q.in('type', filter.types);
      else q = q.neq('type', 'decision_recorded');
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
    getNextPageParam: (last) => (last.length === pageSize ? last[last.length - 1].created_at : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useOrgSettings() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['settings', org.id, 'org'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const [s, p] = await Promise.all([
        supabase.from('org_settings').select('*').eq('org_id', org.id).maybeSingle(),
        supabase.from('processing_times').select('*').eq('org_id', org.id).order('destination'),
      ]);
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      return { settings: s.data as OrgSettings | null, times: (p.data ?? []) as ProcessingTime[] };
    },
  });
}
