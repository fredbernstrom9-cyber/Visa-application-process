'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useOrg } from '@/components/app/org-context';
import { Alert, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { downloadTable } from '@/lib/export';
import { formatDateTime } from '@/lib/format';
import { useMembers } from '@/lib/queries/cases';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { AuditRow } from '@/lib/types';

const LABELS: Record<string, string> = {
  'case.stage_changed': 'Stage changed', 'case.decision_recorded': 'Decision recorded', 'case.deleted': 'Case deleted',
  'document.verified': 'Document verified', 'document.unverified': 'Verification removed',
  'member.role_changed': 'Role changed', 'member.removed': 'Member removed', 'member.left': 'Member left', 'member.joined': 'Member joined',
  'applicant.deleted': 'Applicant deleted', 'applicant.erased': 'Applicant erased (GDPR)', 'applicant.exported': 'Applicant data exported',
  'portal_link.created': 'Portal link created', 'portal_link.revoked': 'Portal link revoked',
  'org.plan_changed': 'Plan changed', 'export.created': 'Data exported', 'import.completed': 'Import completed',
  'org_settings.update': 'Risk settings changed', 'processing_times.insert': 'Processing time added', 'processing_times.update': 'Processing time changed',
  'processing_times.delete': 'Processing time removed', 'checklist_templates.delete': 'Checklist template deleted',
};
const FILTERS = [
  { v: '', l: 'All actions' }, { v: 'case.', l: 'Cases & decisions' }, { v: 'document.', l: 'Document verification' },
  { v: 'member.', l: 'Roles & members' }, { v: 'applicant.', l: 'Deletions & privacy' }, { v: 'portal_link.', l: 'Portal links' }, { v: 'org', l: 'Settings & plan' },
];

export function AuditLog() {
  const { org, isAdmin } = useOrg();
  const { data: members } = useMembers();
  const [prefix, setPrefix] = useState('');
  const q = useInfiniteQuery({
    queryKey: ['audit', org.id, prefix],
    enabled: isAdmin,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      let query = getSupabaseBrowser().from('audit_log').select('*').eq('org_id', org.id).order('id', { ascending: false }).limit(50);
      if (prefix) query = query.like('action', `${prefix}%`);
      if (pageParam) query = query.lt('id', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    getNextPageParam: (last) => (last.length === 50 ? last[last.length - 1].id : undefined),
  });
  if (!isAdmin) return <Alert tone="info">Only owners and admins can see the audit log.</Alert>;
  const names = new Map((members ?? []).map((m) => [m.user_id, m.full_name]));
  const rows = q.data?.pages.flat() ?? [];
  const who = (r: AuditRow) => r.actor_type === 'applicant' ? 'Applicant (portal)' : r.actor_id ? names.get(r.actor_id) ?? 'Former teammate' : 'System';
  const detail = (r: AuditRow) => {
    const m = r.metadata as Record<string, unknown>;
    if (r.action === 'case.stage_changed') return `${m.from} → ${m.to}`;
    if (r.action === 'member.role_changed') return `${m.from} → ${m.to}`;
    if (r.action === 'document.verified' || r.action === 'document.unverified') return String(m.label ?? '');
    if (r.action === 'applicant.erased') return `${m.cases ?? 0} cases, ${m.files ?? 0} files removed`;
    return '';
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">An append-only record of stage changes, document verification, role changes and deletions. Personal details are never stored here.</p>
        <div className="flex gap-2">
          <Select aria-label="Filter actions" className="w-52" value={prefix} onChange={(e) => setPrefix(e.target.value)}>{FILTERS.map((f) => <option key={f.l} value={f.v}>{f.l}</option>)}</Select>
          <Button variant="outline" disabled={rows.length === 0} onClick={() => void downloadTable({ filename: 'audit-log', format: 'csv', headers: ['When', 'Who', 'Action', 'Detail', 'Entity'], rows: rows.map((r) => [r.created_at, who(r), LABELS[r.action] ?? r.action, detail(r), r.entity_id]) })}><Download /> CSV</Button>
        </div>
      </div>
      {q.isLoading ? <Skeleton className="h-64" /> : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>{who(r)}</TableCell>
                  <TableCell className="font-medium">{LABELS[r.action] ?? r.action}</TableCell>
                  <TableCell className="text-muted-foreground">{detail(r)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nothing recorded yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
      {q.hasNextPage && <Button variant="outline" className="justify-self-start" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load older entries</Button>}
    </div>
  );
}
