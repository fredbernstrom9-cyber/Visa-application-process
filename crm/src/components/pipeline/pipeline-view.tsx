'use client';

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Lock, MoveRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { RiskBadge } from '@/components/app/badges';
import { CaseFilterBar } from '@/components/app/filter-bar';
import { useOrg } from '@/components/app/org-context';
import { PageHeader } from '@/components/app/page-header';
import { ApplicantFormDialog } from '@/components/applicants/applicant-form';
import { useLive } from '@/components/live/realtime-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Progress, Skeleton, UserAvatar } from '@/components/ui/misc';
import { changeStageAction } from '@/lib/actions/cases';
import { flagEmoji, countryName } from '@/lib/countries';
import { STAGES, type CaseStage } from '@/lib/domain';
import { filtersToParams, parseFilters, type CaseFilters } from '@/lib/filters';
import { daysLabel, docsPercent, formatDate } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { fetchAllCases, sanitizeSearch } from '@/lib/queries/cases';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { toRpcFilters } from '@/lib/filters';
import type { CaseRow } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Keyboard dragging: left/right arrows jump to the neighbouring stage column. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context: { droppableRects, droppableContainers }, currentCoordinates }) => {
  if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
  event.preventDefault();
  const cols = droppableContainers.getEnabled()
    .map((c) => ({ id: c.id, rect: droppableRects.get(c.id) }))
    .filter((c): c is { id: typeof c.id; rect: NonNullable<typeof c.rect> } => Boolean(c.rect))
    .sort((a, b) => a.rect.left - b.rect.left);
  if (cols.length === 0) return undefined;
  // currentCoordinates is the dragged card's top-left corner; columns are 280px wide, so the nearest left edge identifies the current column
  const idx = cols.reduce((best, c, i) => (Math.abs(c.rect.left - currentCoordinates.x) < Math.abs(cols[best].rect.left - currentCoordinates.x) ? i : best), 0);
  const next = cols[Math.max(0, Math.min(cols.length - 1, idx + (event.code === 'ArrowRight' ? 1 : -1)))];
  return { x: next.rect.left + 8, y: next.rect.top + 80 }; // align the card with the column so it is unambiguously "over" it
};

const CLOSED: CaseStage[] = ['approved', 'refused', 'withdrawn'];
const CLOSED_LIMIT = 40;

interface BoardData { cases: CaseRow[]; closedTotals: Partial<Record<CaseStage, number>> }

function usePipeline(filters: CaseFilters, q: string) {
  const { org } = useOrg();
  const f = useMemo(() => ({ ...filters, stage: undefined }), [filters]);
  return useQuery<BoardData>({
    queryKey: ['pipeline', org.id, f, q],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const s = sanitizeSearch(q);
      const open = await fetchAllCases(org.id, { ...f, open: true }, q);
      const closed = await Promise.all(CLOSED.map(async (stage) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query: any = supabase.rpc('filtered_cases', { p_org: org.id, p_filters: toRpcFilters({ ...f, stage: [stage] }) }, { count: 'exact' });
        if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,programme.ilike.%${s}%`);
        const { data, count, error } = await query.order('stage_changed_at', { ascending: false }).limit(CLOSED_LIMIT);
        if (error) throw error;
        return { stage, rows: (data ?? []) as CaseRow[], total: count ?? 0 };
      }));
      return {
        cases: [...open, ...closed.flatMap((c) => c.rows)],
        closedTotals: Object.fromEntries(closed.map((c) => [c.stage, c.total])),
      };
    },
  });
}

function sortColumn(stage: CaseStage, rows: CaseRow[]): CaseRow[] {
  if (CLOSED.includes(stage)) return [...rows].sort((a, b) => b.stage_changed_at.localeCompare(a.stage_changed_at));
  const rank = (c: CaseRow) => (c.slack_days === null ? Number.MAX_SAFE_INTEGER : c.slack_days);
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.full_name.localeCompare(b.full_name));
}

function CardBody({ c, compact }: { c: CaseRow; compact?: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{c.full_name}</p>
          <p className="truncate text-xs text-muted-foreground"><span aria-hidden>{flagEmoji(c.destination)}</span> {countryName(c.destination)} · {c.visa_type}</p>
        </div>
        {c.advisor_name && <UserAvatar name={c.advisor_name} src={c.advisor_avatar} className="size-6" />}
      </div>
      {!compact && (
        <>
          <RiskBadge level={c.risk_level} reason={c.risk_reason} showReason={false} className="mt-2" />
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{c.risk_reason}</p>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={docsPercent(c) ?? 0} className="h-1.5 flex-1" label="Documents verified" />
            <span className="text-[11px] text-muted-foreground">{c.docs_total ? `${docsPercent(c)}%` : 'no list'}</span>
          </div>
          {c.start_date && <p className="mt-1.5 text-[11px] text-muted-foreground">Starts {formatDate(c.start_date)} · {daysLabel(c.days_to_start)}</p>}
        </>
      )}
    </>
  );
}

function BoardCard({ c, canDrag, onMove }: { c: CaseRow; canDrag: boolean; onMove: (c: CaseRow, to: CaseStage) => void }) {
  const { dragging } = useLive();
  const { user } = useOrg();
  const hot = useIsHighlighted(c.id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id, data: { stage: c.stage }, disabled: !canDrag });
  const lock = dragging[c.id];
  const lockedByOther = lock && lock.userId !== user.id;
  return (
    <li
      ref={setNodeRef}
      className={cn('group relative rounded-lg border bg-card p-2.5 shadow-xs', isDragging && 'opacity-30', hot && 'live-flash', lockedByOther && 'ring-2 ring-primary/50')}
    >
      <div className="flex items-start gap-1">
        {canDrag && (
          <button
            type="button" aria-label={`Drag ${c.full_name}. Use space to pick up and arrow keys to move.`}
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            {...listeners} {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <Link href={`/cases/${c.id}`} className="block min-w-0 flex-1"><CardBody c={c} /></Link>
      </div>
      {lockedByOther && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary"><Lock className="size-3" /> {lock.name} is moving this</p>}
      {canDrag && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="ghost" className="mt-1.5 h-6 w-full justify-start px-1 text-[11px] text-muted-foreground"><MoveRight className="size-3" /> Move to…</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Move {c.full_name.split(' ')[0]} to</DropdownMenuLabel>
            {STAGES.filter((s) => s.key !== c.stage).map((s) => <DropdownMenuItem key={s.key} onSelect={() => onMove(c, s.key)}>{s.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function Column({ stage, cases, total, canDrag, onMove }: { stage: (typeof STAGES)[number]; cases: CaseRow[]; total: number; canDrag: boolean; onMove: (c: CaseRow, to: CaseStage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const high = cases.filter((c) => c.risk_level === 'high').length;
  const closed = CLOSED.includes(stage.key);
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.label}: ${total} cases`}
      className={cn('flex w-72 shrink-0 snap-start flex-col rounded-xl border bg-muted/40 transition-colors sm:w-[17.5rem]', isOver && 'border-primary bg-accent/50')}
    >
      <header className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{stage.label}</h2>
          <p className="text-[11px] text-muted-foreground">{stage.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {high > 0 && <span className="rounded-full bg-danger-bg px-1.5 py-0.5 text-[11px] font-semibold text-danger" title={`${high} high risk`}>{high} high</span>}
          <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold shadow-xs" aria-label={`${total} cases`}>{total}</span>
        </div>
      </header>
      <ul className="flex max-h-[calc(100dvh-17rem)] min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {cases.map((c) => <BoardCard key={c.id} c={c} canDrag={canDrag} onMove={onMove} />)}
        {cases.length === 0 && <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Drop a case here</li>}
        {closed && total > cases.length && (
          <li className="px-1 pt-1 text-center text-xs text-muted-foreground">
            Showing latest {cases.length} of {total}. <Link className="text-primary underline underline-offset-2 hover:no-underline" href={`/applicants?stage=${stage.key}`}>See all</Link>
          </li>
        )}
      </ul>
    </section>
  );
}

export function PipelineView() {
  const { canWrite, org } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const { data, isLoading, isError } = usePipeline(filters, debouncedQ);
  const qc = useQueryClient();
  const { announce, announceDrag } = useLive();
  const [active, setActive] = useState<CaseRow | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{ c: CaseRow; to: 'approved' | 'refused' } | null>(null);
  const [reason, setReason] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [, start] = useTransition();

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 300); return () => clearTimeout(t); }, [q]);
  const setFilters = useCallback((f: CaseFilters) => {
    const next = filtersToParams(f);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const byStage = useMemo(() => {
    const m = new Map<CaseStage, CaseRow[]>(STAGES.map((s) => [s.key, []]));
    for (const c of data?.cases ?? []) m.get(c.stage)?.push(c);
    return m;
  }, [data]);

  const key = ['pipeline', org.id, { ...filters, stage: undefined }, debouncedQ];
  const applyMove = useCallback((c: CaseRow, to: CaseStage, why?: string) => {
    if (c.stage === to) return;
    const previous = qc.getQueryData<BoardData>(key);
    // optimistic: the card jumps immediately; rolled back if the server says no
    qc.setQueryData<BoardData>(key, (old) => old && { ...old, cases: old.cases.map((x) => (x.id === c.id ? { ...x, stage: to } : x)) });
    start(async () => {
      const r = await changeStageAction({ caseIds: [c.id], stage: to, reason: why || null });
      if (!r.ok) {
        qc.setQueryData(key, previous);
        toast.error(r.error);
        return;
      }
      toast.success(`${c.full_name} → ${STAGES.find((s) => s.key === to)?.short}`);
      void qc.invalidateQueries();
      announce(['cases', 'case', 'analytics', 'activity', 'pipeline']);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, org.id, filters, debouncedQ, announce]);

  const request = useCallback((c: CaseRow, to: CaseStage) => {
    if (to === 'approved' || to === 'refused') { setPendingDecision({ c, to }); setReason(''); } else applyMove(c, to);
  }, [applyMove]);

  function onStart(e: DragStartEvent) {
    const c = data?.cases.find((x) => x.id === e.active.id) ?? null;
    setActive(c);
    if (c) announceDrag(c.id, true);
  }
  function onEnd(e: DragEndEvent) {
    const c = active;
    setActive(null);
    if (c) announceDrag(c.id, false);
    if (!c || !e.over) return;
    const to = e.over.id as CaseStage;
    if (STAGES.some((s) => s.key === to)) request(c, to);
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag cases between stages, or use “Move to…” on a phone. Cards are ordered by urgency, most at-risk first."
        actions={canWrite ? <Button onClick={() => setFormOpen(true)}><Plus /> New applicant</Button> : undefined}
      />
      <div className="mb-4 grid gap-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the board" className="pl-8" aria-label="Search the board" />
        </div>
        <CaseFilterBar filters={filters} onChange={setFilters} hide={['stage']} dates={false} />
      </div>

      {isError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm">We couldn&apos;t load the pipeline. Refresh to try again.</p>}
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">{STAGES.slice(0, 5).map((s) => <Skeleton key={s.key} className="h-96 w-72 shrink-0" />)}</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => { if (active) announceDrag(active.id, false); setActive(null); }}>
          <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-4 sm:-mx-6 sm:px-6" role="region" aria-label="Pipeline board" tabIndex={0}>
            {STAGES.map((s) => (
              <Column
                key={s.key} stage={s} cases={sortColumn(s.key, byStage.get(s.key) ?? [])}
                total={CLOSED.includes(s.key) ? data?.closedTotals[s.key] ?? 0 : byStage.get(s.key)?.length ?? 0}
                canDrag={canWrite} onMove={request}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {active && <div className="w-64 rotate-1 rounded-lg border-2 border-primary bg-card p-2.5 shadow-xl"><CardBody c={active} compact /></div>}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={pendingDecision !== null} onOpenChange={(o) => !o && setPendingDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record decision: {pendingDecision?.to === 'approved' ? 'Approved' : 'Refused'}</DialogTitle>
            <DialogDescription>{pendingDecision?.c.full_name}. The team is notified and the decision date is stored.</DialogDescription>
          </DialogHeader>
          <Field label="Note (optional)" htmlFor="pl-reason"><Textarea id="pl-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDecision(null)}>Cancel</Button>
            <Button onClick={() => { if (pendingDecision) applyMove(pendingDecision.c, pendingDecision.to, reason); setPendingDecision(null); }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ApplicantFormDialog open={formOpen} onOpenChange={setFormOpen} mode={{ kind: 'create' }} />
    </>
  );
}
