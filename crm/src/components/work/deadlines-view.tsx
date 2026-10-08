'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarClock, CalendarX2, FileWarning, ListChecks, Plane } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StageBadge } from '@/components/app/badges';
import { useOrg } from '@/components/app/org-context';
import { EmptyState, PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton, UserAvatar } from '@/components/ui/misc';
import { BUCKETS, groupDeadlines, KIND_LABELS } from '@/lib/deadlines';
import { daysLabelFromToday, formatDate, todayIso } from '@/lib/format';
import { useMembers } from '@/lib/queries/cases';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { DeadlineItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND_ICON = { start_date: Plane, appointment: CalendarCheck, document: FileWarning, task: ListChecks } as const;
const KIND_TONE = { start_date: 'danger', appointment: 'violet', document: 'warn', task: 'info' } as const;

export function DeadlinesView() {
  const { org, user } = useOrg();
  const { data: members } = useMembers();
  const [kinds, setKinds] = useState<DeadlineItem['kind'][]>([]);
  const [mine, setMine] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['deadlines', org.id],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('deadline_items').select('*').eq('org_id', org.id).order('due_date').limit(3000);
      if (error) throw error;
      return (data ?? []) as DeadlineItem[];
    },
  });
  const today = todayIso();
  const names = useMemo(() => new Map((members ?? []).map((m) => [m.user_id, m])), [members]);
  const filtered = useMemo(
    () => (data ?? []).filter((i) => (kinds.length === 0 || kinds.includes(i.kind)) && (!mine || i.owner_id === user.id)),
    [data, kinds, mine, user.id],
  );
  const groups = useMemo(() => groupDeadlines(filtered, today), [filtered, today]);

  return (
    <>
      <PageHeader title="Deadlines" description="Start dates, appointments, document due dates and task due dates in one timeline, grouped by urgency." />
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter deadlines">
        {(Object.keys(KIND_LABELS) as DeadlineItem['kind'][]).map((k) => {
          const on = kinds.includes(k);
          const Icon = KIND_ICON[k];
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors', on ? 'border-primary bg-accent font-medium' : 'hover:bg-muted')}>
              <Icon className="size-3.5" aria-hidden /> {KIND_LABELS[k]}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine</label>
      </div>

      {isLoading ? <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : filtered.length === 0 ? (
        <EmptyState icon={CalendarX2} title="Nothing due">
          Deadlines appear here once applicants have start dates, appointments, dated documents or tasks.
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {BUCKETS.map((b) => {
            const items = groups[b.key];
            return (
              <section key={b.key} aria-labelledby={`bucket-${b.key}`}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 id={`bucket-${b.key}`} className={cn('text-base font-semibold', b.key === 'overdue' && items.length > 0 && 'text-danger')}>{b.label}</h2>
                  <Badge tone={b.key === 'overdue' && items.length ? 'danger' : 'neutral'}>{items.length}</Badge>
                  <span className="text-xs text-muted-foreground">{b.hint}</span>
                </div>
                {items.length === 0 ? <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Nothing here.</p> : (
                  <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                    {items.slice(0, b.key === 'later' ? 100 : 400).map((i) => {
                      const Icon = KIND_ICON[i.kind];
                      const owner = i.owner_id ? names.get(i.owner_id) : null;
                      return (
                        <li key={`${i.kind}-${i.ref_id}`}>
                          <Link href={`/cases/${i.case_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 hover:bg-accent/40">
                            <Badge tone={KIND_TONE[i.kind]} className="w-32 justify-start"><Icon aria-hidden /> {KIND_LABELS[i.kind]}</Badge>
                            <span className="min-w-40 flex-1">
                              <span className="font-medium">{i.applicant_name}</span>
                              {i.title && <span className="text-muted-foreground"> · {i.title}</span>}
                            </span>
                            <StageBadge stage={i.stage} short />
                            <span className={cn('w-40 text-right text-sm', b.key === 'overdue' ? 'font-medium text-danger' : 'text-muted-foreground')}>
                              {formatDate(i.due_date)} · {daysLabelFromToday(i.due_date)}
                            </span>
                            <span className="flex w-28 items-center justify-end gap-1.5 text-xs text-muted-foreground">
                              {owner ? <><UserAvatar name={owner.full_name} src={owner.avatar_url} className="size-5" /><span className="truncate">{owner.full_name.split(' ')[0]}</span></> : 'Unassigned'}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {items.length > (b.key === 'later' ? 100 : 400) && <p className="mt-1 text-xs text-muted-foreground">Showing the first {b.key === 'later' ? 100 : 400}. Narrow with the filters above.</p>}
              </section>
            );
          })}
        </div>
      )}
      {false && <CalendarClock />}
    </>
  );
}
