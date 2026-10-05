'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { EmptyState } from '@/components/app/page-header';
import { useLive } from '@/components/live/realtime-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/misc';
import { createTaskAction, deleteTaskAction, updateTaskAction } from '@/lib/actions/tasks';
import { daysLabelFromToday, formatDate, todayIso } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { useCaseTasks } from '@/lib/queries/case-data';
import { useMembers } from '@/lib/queries/cases';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

function TaskRow({ t, memberName, onChange }: { t: Task; memberName: string | null; onChange: () => void }) {
  const { canWrite } = useOrg();
  const hot = useIsHighlighted(t.id);
  const [pending, start] = useTransition();
  const overdue = t.status === 'open' && t.due_date && t.due_date < todayIso();
  return (
    <li className={cn('flex items-start gap-3 rounded-lg border bg-card p-3', hot && 'live-flash', t.status === 'done' && 'opacity-70')}>
      <Checkbox
        className="mt-0.5" aria-label={`Mark “${t.title}” as ${t.status === 'done' ? 'open' : 'done'}`} checked={t.status === 'done'} disabled={!canWrite || pending}
        onCheckedChange={(v) => start(async () => { const r = await updateTaskAction(t.id, { status: v === true ? 'done' : 'open' }); if (!r.ok) toast.error(r.error); else onChange(); })}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', t.status === 'done' && 'line-through')}>{t.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span>{memberName ?? 'Unassigned'}</span>
          {t.due_date && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-danger')}>
              <CalendarClock className="size-3" /> {formatDate(t.due_date)} · {daysLabelFromToday(t.due_date)}{overdue && ' · overdue'}
            </span>
          )}
        </p>
      </div>
      {canWrite && (
        <Button size="icon-sm" variant="ghost" aria-label={`Delete task ${t.title}`} disabled={pending}
          onClick={() => start(async () => { const r = await deleteTaskAction(t.id); if (!r.ok) toast.error(r.error); else onChange(); })}><Trash2 /></Button>
      )}
    </li>
  );
}

export function CaseTasks({ caseId, defaultAssignee }: { caseId: string; defaultAssignee: string | null }) {
  const { canWrite, user } = useOrg();
  const { data: tasks, isLoading } = useCaseTasks(caseId);
  const { data: members } = useMembers();
  const qc = useQueryClient();
  const { announce } = useLive();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState(defaultAssignee ?? user.id);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.full_name]));
  const refresh = () => { void qc.invalidateQueries(); announce(['tasks', 'deadlines', 'analytics', 'activity']); };

  return (
    <div className="grid gap-4">
      {canWrite && (
        <form
          className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_9.5rem_11rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createTaskAction({ caseId, title, dueDate: due || null, assigneeId: assignee || null });
              if (!r.ok) { toast.error(r.error); return; }
              setTitle(''); setDue(''); refresh();
            });
          }}
        >
          <Field label="New task" htmlFor="t-title"><Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chase bank statement" required maxLength={300} /></Field>
          <Field label="Due" htmlFor="t-due"><Input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Assignee" htmlFor="t-as">
            <Select id="t-as" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {(members ?? []).filter((m) => m.role !== 'viewer').map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
            </Select>
          </Field>
          <Button type="submit" loading={pending}><Plus /> Add</Button>
        </form>
      )}
      {isLoading ? <Skeleton className="h-24" /> : (tasks ?? []).length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks on this case">Tasks keep follow-ups from slipping: chase a document, book the appointment, call the applicant.</EmptyState>
      ) : (
        <ul className="grid gap-2">{(tasks ?? []).map((t) => <TaskRow key={t.id} t={t} memberName={t.assignee_id ? names.get(t.assignee_id) ?? 'Former teammate' : null} onChange={refresh} />)}</ul>
      )}
    </div>
  );
}
