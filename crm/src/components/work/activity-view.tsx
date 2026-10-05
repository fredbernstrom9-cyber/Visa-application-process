'use client';

import { Activity, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { MultiSelect } from '@/components/app/multi-select';
import { useOrg } from '@/components/app/org-context';
import { EmptyState, PageHeader } from '@/components/app/page-header';
import { EventRow } from '@/components/cases/case-timeline';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/misc';
import { ACTION_GROUPS } from '@/lib/activity';
import { useActivity } from '@/lib/queries/case-data';
import { fetchCasePage, useMembers } from '@/lib/queries/cases';
import type { CaseRow } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { useLive } from '@/components/live/realtime-provider';

function CasePicker({ value, label, onChange }: { value: string | null; label: string | null; onChange: (c: { id: string; name: string } | null) => void }) {
  const { org } = useOrg();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['cases', org.id, 'picker', q],
    enabled: open,
    queryFn: () => fetchCasePage(org.id, { filters: {}, q, sort: 'updated', dir: 'desc', page: 0, pageSize: 8 }),
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={value ? 'border-primary/50 bg-accent/60 font-normal' : 'font-normal'}>
          <Search /> {label ?? 'Any case'}
          {value && <span role="button" tabIndex={0} aria-label="Clear case filter" onClick={(e) => { e.stopPropagation(); onChange(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null); } }}><X className="size-3.5" /></span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applicant name" aria-label="Search cases" autoFocus />
        <ul className="mt-2 max-h-56 overflow-y-auto">
          {(data?.rows ?? []).map((c: CaseRow) => (
            <li key={c.id}><button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { onChange({ id: c.id, name: c.full_name }); setOpen(false); }}>{c.full_name}<span className="block text-xs text-muted-foreground">{c.destination} · {c.stage}</span></button></li>
          ))}
          {data && data.rows.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function ActivityView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: members } = useMembers();
  const { status } = useLive();
  const caseId = sp.get('case');
  const [caseName, setCaseName] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const types = groups.length ? ACTION_GROUPS.filter((g) => groups.includes(g.key)).flatMap((g) => g.types) : undefined;
  const q = useActivity({ userId: userId || undefined, caseId: caseId ?? undefined, types });
  const events = q.data?.pages.flat() ?? [];
  const filtered = Boolean(userId || caseId || groups.length);

  return (
    <>
      <PageHeader
        title="Live activity"
        description={status === 'live' ? 'Everything your team does, as it happens.' : 'A stream of team actions. Premium plans update this feed instantly without refreshing.'}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter activity">
        <Select aria-label="Filter by person" className="h-8 w-48 text-[13px]" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Everyone</option>
          {(members ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
          <option value="applicant">Applicants (portal)</option>
          <option value="system">System</option>
        </Select>
        <CasePicker value={caseId} label={caseName ?? (caseId ? 'Selected case' : null)} onChange={(c) => { setCaseName(c?.name ?? null); router.replace(c ? `/activity?case=${c.id}` : '/activity'); }} />
        <MultiSelect label="Action type" value={groups} onChange={setGroups} options={ACTION_GROUPS.map((g) => ({ value: g.key, label: g.label }))} />
        {filtered && <Button size="sm" variant="ghost" onClick={() => { setUserId(''); setGroups([]); setCaseName(null); router.replace('/activity'); }}><X /> Clear</Button>}
      </div>
      {q.isLoading ? <Skeleton className="h-72" /> : events.length === 0 ? (
        <EmptyState icon={Activity} title={filtered ? 'No activity matches these filters' : 'No activity yet'}>
          Stage moves, verified documents, completed tasks, imports and applicant uploads will stream in here with who did what and when.
        </EmptyState>
      ) : (
        <div className="rounded-xl border bg-card px-4">
          <ul className="divide-y" aria-live="polite" aria-relevant="additions">{events.map((e) => <EventRow key={e.id} e={e} />)}</ul>
        </div>
      )}
      {q.hasNextPage && <Button variant="outline" className="mt-4" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load older activity</Button>}
    </>
  );
}
