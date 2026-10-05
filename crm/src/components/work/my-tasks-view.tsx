'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { EmptyState, PageHeader } from '@/components/app/page-header';
import { useLive } from '@/components/live/realtime-provider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateTaskAction } from '@/lib/actions/tasks';
import { bucketFor, BUCKETS } from '@/lib/deadlines';
import { daysLabelFromToday, formatDate, todayIso } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { useMyTasks } from '@/lib/queries/case-data';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

function Row({ t, caseName, onChange }: { t: Task; caseName: string; onChange: () => void }) {
  const hot = useIsHighlighted(t.id);
  const [pending, start] = useTransition();
  const overdue = t.status === 'open' && t.due_date && t.due_date < todayIso();
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', hot && 'live-flash')}>
      <Checkbox className="mt-0.5" checked={t.status === 'done'} disabled={pending} aria-label={`Mark “${t.title}” as ${t.status === 'done' ? 'open' : 'done'}`}
        onCheckedChange={(v) => start(async () => { const r = await updateTaskAction(t.id, { status: v === true ? 'done' : 'open' }); if (!r.ok) toast.error(r.error); else onChange(); })} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</p>
        <p className="text-xs text-muted-foreground"><Link href={`/cases/${t.case_id}`} className="text-primary hover:underline">{caseName}</Link></p>
      </div>
      {t.due_date && <span className={cn('shrink-0 text-xs', overdue ? 'font-medium text-danger' : 'text-muted-foreground')}>{formatDate(t.due_date)} · {daysLabelFromToday(t.due_date)}</span>}
    </li>
  );
}

export function MyTasksView() {
  const { user } = useOrg();
  const { data, isLoading } = useMyTasks(user.id);
  const qc = useQueryClient();
  const { announce } = useLive();
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const today = todayIso();
  const refresh = () => { void qc.invalidateQueries(); announce(['tasks', 'deadlines', 'analytics', 'activity']); };

  const groups = useMemo(() => {
    const open = (data?.tasks ?? []).filter((t) => t.status === 'open');
    const g: Record<string, Task[]> = { overdue: [], week: [], month: [], later: [], none: [] };
    for (const t of open) (t.due_date ? g[bucketFor(t.due_date, today)] : g.none).push(t);
    return g;
  }, [data, today]);
  const done = (data?.tasks ?? []).filter((t) => t.status === 'done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  const openCount = (data?.tasks ?? []).filter((t) => t.status === 'open').length;
  const name = (id: string) => data?.names[id]?.name ?? 'Applicant';

  return (
    <>
      <PageHeader title="My tasks" description="Follow-ups assigned to you across all cases. Create tasks from a case’s Tasks tab." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'done')}>
        <TabsList><TabsTrigger value="open">Open <Badge tone={groups.overdue.length ? 'danger' : 'neutral'}>{openCount}</Badge></TabsTrigger><TabsTrigger value="done">Done</TabsTrigger></TabsList>
      </Tabs>
      <div className="mt-4">
        {isLoading ? <Skeleton className="h-48" /> : tab === 'done' ? (
          done.length === 0 ? <EmptyState icon={ListChecks} title="Nothing completed yet" /> :
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">{done.slice(0, 100).map((t) => <Row key={t.id} t={t} caseName={name(t.case_id)} onChange={refresh} />)}</ul>
        ) : openCount === 0 ? (
          <EmptyState icon={ListChecks} title="You’re all caught up">Tasks assigned to you will show up here, grouped by when they are due.</EmptyState>
        ) : (
          <div className="grid gap-5">
            {([...BUCKETS.map((b) => [b.key, b.label] as const), ['none', 'No due date'] as const]).map(([key, label]) => groups[key].length > 0 && (
              <section key={key}>
                <h2 className={cn('mb-2 text-sm font-semibold', key === 'overdue' && 'text-danger')}>{label} <span className="font-normal text-muted-foreground">({groups[key].length})</span></h2>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">{groups[key].map((t) => <Row key={t.id} t={t} caseName={name(t.case_id)} onChange={refresh} />)}</ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
