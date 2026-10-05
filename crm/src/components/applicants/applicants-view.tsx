'use client';

import { useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState, type VisibilityState } from '@tanstack/react-table';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bookmark, ChevronLeft, ChevronRight, Columns3, Download, FileUp, Plus, Search, Sparkles, Trash2, UserCog, Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Destination, RiskBadge, StageBadge } from '@/components/app/badges';
import { CaseFilterBar } from '@/components/app/filter-bar';
import { useOrg } from '@/components/app/org-context';
import { EmptyState, PageHeader } from '@/components/app/page-header';
import { UpgradeDialog } from '@/components/app/upgrade';
import { useLive } from '@/components/live/realtime-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, UserAvatar } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import {
  assignAdvisorAction, changeStageAction, deleteApplicantsAction, deleteViewAction, logExportAction, saveViewAction, tagCasesAction,
} from '@/lib/actions/cases';
import { applyChecklistAction } from '@/lib/actions/checklists';
import { countryName } from '@/lib/countries';
import { STAGES, visaLabel, type CaseStage } from '@/lib/domain';
import { CASE_EXPORT_HEADERS, caseExportRow, downloadTable } from '@/lib/export';
import { filtersToParams, parseFilters, type CaseFilters } from '@/lib/filters';
import { formatDate, daysLabel, relativeTime } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { fetchAllCases, useCases, useMembers, useSavedViews, type SortKey } from '@/lib/queries/cases';
import type { CaseRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ApplicantFormDialog } from './applicant-form';

const PAGE_SIZE = 50;
const DEFAULT_COLS: VisibilityState = {
  nationality: false, visa: false, appointment: false, intake: false, tags: false, updated: false,
};
const COLUMN_LABELS: Record<string, string> = {
  destination: 'Destination', nationality: 'Nationality', visa: 'Visa type', stage: 'Stage', risk: 'Risk & reason', docs: 'Documents',
  start: 'Start date', appointment: 'Appointment', advisor: 'Advisor', intake: 'Intake', tags: 'Tags', updated: 'Last updated',
};
const SORTABLE: Record<string, SortKey> = {
  name: 'name', destination: 'destination', nationality: 'nationality', visa: 'visa', stage: 'stage', risk: 'risk', docs: 'docs',
  start: 'start', appointment: 'appointment', advisor: 'advisor', intake: 'intake', updated: 'updated',
};

function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const q = sp.get('q') ?? '';
  const sort = (sp.get('sort') as SortKey | null) ?? 'risk';
  const dir = (sp.get('dir') as 'asc' | 'desc' | null) ?? 'asc';
  const page = Math.max(0, Number(sp.get('page') ?? 0) || 0);

  const update = useCallback((patch: { filters?: CaseFilters; q?: string; sort?: SortKey; dir?: 'asc' | 'desc'; page?: number }) => {
    const next = new URLSearchParams();
    filtersToParams(patch.filters ?? filters, next);
    const nq = patch.q ?? q; if (nq) next.set('q', nq);
    const ns = patch.sort ?? sort; const nd = patch.dir ?? dir;
    if (ns !== 'risk' || nd !== 'asc') { next.set('sort', ns); next.set('dir', nd); }
    const np = patch.page ?? (patch.filters || patch.q !== undefined ? 0 : page); if (np > 0) next.set('page', String(np));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, q, sort, dir, page, pathname, router]);
  return { filters, q, sort, dir, page, update, searchParams: sp };
}

function DocsCell({ row }: { row: CaseRow }) {
  if (row.docs_total === 0) return <span className="text-xs text-muted-foreground">No checklist</span>;
  return (
    <div className="grid w-28 gap-1" title={`${row.docs_verified} of ${row.docs_total} required documents verified`}>
      <Progress value={row.docs_pct ?? 0} label={`${row.docs_pct ?? 0}% of documents verified`} />
      <span className="text-xs text-muted-foreground">{row.docs_verified}/{row.docs_total} verified</span>
    </div>
  );
}

function StartCell({ row }: { row: CaseRow }) {
  if (!row.start_date) return <span className="text-muted-foreground">—</span>;
  const open = !['approved', 'refused', 'withdrawn'].includes(row.stage);
  return (
    <div className="grid">
      <span>{formatDate(row.start_date)}</span>
      {open && <span className={cn('text-xs', (row.days_to_start ?? 0) < 0 ? 'font-medium text-danger' : 'text-muted-foreground')}>{daysLabel(row.days_to_start)}</span>}
    </div>
  );
}

function buildColumns(): ColumnDef<CaseRow>[] {
  return [
    {
      id: 'select', enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
        />
      ),
      cell: ({ row }) => <Checkbox aria-label={`Select ${row.original.full_name}`} checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(v === true)} onClick={(e) => e.stopPropagation()} />,
    },
    {
      id: 'name', header: 'Applicant', enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/cases/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.full_name}</Link>
          <p className="truncate text-xs text-muted-foreground">{row.original.email ?? row.original.programme ?? '—'}</p>
        </div>
      ),
    },
    { id: 'destination', header: 'Destination', cell: ({ row }) => <Destination code={row.original.destination} /> },
    { id: 'nationality', header: 'Nationality', cell: ({ row }) => countryName(row.original.nationality) || '—' },
    { id: 'visa', header: 'Visa', cell: ({ row }) => visaLabel(row.original.visa_type) },
    { id: 'stage', header: 'Stage', cell: ({ row }) => <StageBadge stage={row.original.stage} short /> },
    { id: 'risk', header: 'Risk', cell: ({ row }) => <RiskBadge level={row.original.risk_level} reason={row.original.risk_reason} showReason /> },
    { id: 'docs', header: 'Documents', cell: ({ row }) => <DocsCell row={row.original} /> },
    { id: 'start', header: 'Start', cell: ({ row }) => <StartCell row={row.original} /> },
    { id: 'appointment', header: 'Appointment', cell: ({ row }) => formatDate(row.original.appointment_date) },
    {
      id: 'advisor', header: 'Advisor',
      cell: ({ row }) => row.original.advisor_name
        ? <span className="flex items-center gap-1.5"><UserAvatar name={row.original.advisor_name} src={row.original.advisor_avatar} className="size-5" />{row.original.advisor_name}</span>
        : <span className="text-muted-foreground">Unassigned</span>,
    },
    { id: 'intake', header: 'Intake', cell: ({ row }) => row.original.intake ?? '—' },
    {
      id: 'tags', header: 'Tags',
      cell: ({ row }) => <div className="flex flex-wrap gap-1">{row.original.tags.slice(0, 3).map((t) => <Badge key={t} tone="info">{t}</Badge>)}{row.original.tags.length > 3 && <Badge tone="neutral">+{row.original.tags.length - 3}</Badge>}</div>,
    },
    { id: 'updated', header: 'Updated', cell: ({ row }) => <span className="text-xs text-muted-foreground">{relativeTime(row.original.updated_at)}</span> },
  ];
}

function CaseCard({ c, selected, onSelect }: { c: CaseRow; selected: boolean; onSelect: (v: boolean) => void }) {
  const hotCase = useIsHighlighted(c.id);
  const hotApplicant = useIsHighlighted(c.applicant_id);
  const hot = hotCase || hotApplicant;
  return (
    <li className={cn('rounded-xl border bg-card p-3 shadow-xs', hot && 'live-flash', selected && 'border-primary')}>
      <div className="flex items-start gap-3">
        <Checkbox className="mt-1" aria-label={`Select ${c.full_name}`} checked={selected} onCheckedChange={(v) => onSelect(v === true)} />
        <div className="min-w-0 flex-1">
          <Link href={`/cases/${c.id}`} className="block truncate font-medium">{c.full_name}</Link>
          <p className="truncate text-xs text-muted-foreground"><Destination code={c.destination} /> · {visaLabel(c.visa_type)}</p>
        </div>
        <StageBadge stage={c.stage} short />
      </div>
      <div className="mt-2 grid gap-2 pl-7">
        <RiskBadge level={c.risk_level} reason={c.risk_reason} showReason />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Starts {formatDate(c.start_date)}</span>
          <span>{c.advisor_name ?? 'Unassigned'}</span>
        </div>
        <DocsCell row={c} />
      </div>
    </li>
  );
}

function GridRow({ row, children }: { row: CaseRow; children: React.ReactNode }) {
  const hotCase = useIsHighlighted(row.id);
  const hotApplicant = useIsHighlighted(row.applicant_id);
  const hot = hotCase || hotApplicant;
  return <TableRow className={cn(hot && 'live-flash')}>{children}</TableRow>;
}

export function ApplicantsView() {
  const { org, canWrite, isAdmin, canUse, user } = useOrg();
  const { filters, q, sort, dir, page, update, searchParams } = useUrlState();
  const [search, setSearch] = useState(q);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [colVis, setColVis] = useState<VisibilityState>(DEFAULT_COLS);
  const [formOpen, setFormOpen] = useState(false);
  const [upgrade, setUpgrade] = useState<null | 'import' | 'export'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pending, start] = useTransition();
  const qc = useQueryClient();
  const { announce } = useLive();
  const { data: members } = useMembers();
  const { data: views } = useSavedViews('applicants');

  const { data, isLoading, isError, isFetching } = useCases({ filters, q, sort, dir, page, pageSize: PAGE_SIZE });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (search !== q) update({ q: search }); }, 350);
    return () => clearTimeout(t);
  }, [search, q, update]);
  useEffect(() => {
    try { const raw = localStorage.getItem(`cols:${org.id}`); if (raw) setColVis({ ...DEFAULT_COLS, ...JSON.parse(raw) }); } catch { /* ignore */ }
  }, [org.id]);
  const changeCols = (next: VisibilityState) => {
    setColVis(next);
    try { localStorage.setItem(`cols:${org.id}`, JSON.stringify(next)); } catch { /* ignore */ }
  };
  useEffect(() => { setSelection({}); }, [page, q, filters]);

  const columns = useMemo(buildColumns, []);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (r) => r.id,
    state: { rowSelection: selection, columnVisibility: colVis },
    onRowSelectionChange: setSelection, onColumnVisibilityChange: (u) => changeCols(typeof u === 'function' ? u(colVis) : u),
    manualSorting: true, manualPagination: true, enableRowSelection: canWrite,
  });
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);
  const selectedRows = rows.filter((r) => selection[r.id]);

  function done(msg: string) {
    toast.success(msg);
    setSelection({});
    void qc.invalidateQueries();
    announce(['cases', 'case', 'analytics', 'activity', 'pipeline']);
  }
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    const r = await fn();
    if (r.ok) done(ok); else toast.error(r.error ?? 'Something went wrong');
  });

  async function exportRows(format: 'csv' | 'xlsx', scope: 'selected' | 'filtered') {
    if (!canUse('export')) { setUpgrade('export'); return; }
    const toastId = toast.loading('Preparing export…');
    try {
      const list = scope === 'selected' ? selectedRows : await fetchAllCases(org.id, filters, q);
      await downloadTable({ filename: `applicants-${new Date().toISOString().slice(0, 10)}`, format, headers: CASE_EXPORT_HEADERS, rows: list.map(caseExportRow), sheet: 'Applicants' });
      void logExportAction({ what: 'applicants', rows: list.length });
      toast.success(`Exported ${list.length} applicants`, { id: toastId });
    } catch (e) {
      toast.error((e as Error).message || 'Export failed', { id: toastId });
    }
  }

  const sortBy = (id: string) => {
    const key = SORTABLE[id];
    if (!key) return;
    update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc', page: 0 });
  };
  const hasFilters = Object.keys(filters).length > 0 || q.length > 0;
  const nothingYet = !isLoading && !isError && total === 0 && !hasFilters;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const advisors = (members ?? []).filter((m) => m.role !== 'viewer');

  const currentConfig = { filters, q, sort, dir, cols: colVis };
  const applyView = (cfg: Record<string, unknown>) => {
    const f = (cfg.filters ?? {}) as CaseFilters;
    update({ filters: f, q: (cfg.q as string) ?? '', sort: (cfg.sort as SortKey) ?? 'risk', dir: (cfg.dir as 'asc' | 'desc') ?? 'asc', page: 0 });
    if (cfg.cols) changeCols({ ...DEFAULT_COLS, ...(cfg.cols as VisibilityState) });
  };

  return (
    <>
      <PageHeader
        title="Applicants"
        description="Every visa case across your organisation. Search, filter and act on many at once."
        actions={
          <>
            <Button variant="outline" onClick={() => (canUse('import') ? undefined : setUpgrade('import'))} asChild={canUse('import')}>
              {canUse('import') ? <Link href="/applicants/import"><FileUp /> Import</Link> : <><FileUp /> Import <Sparkles className="text-primary" /></>}
            </Button>
            {canWrite && <Button onClick={() => setFormOpen(true)}><Plus /> New applicant</Button>}
          </>
        }
      />

      <div className="mb-3 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, e-mail or programme" className="pl-8" aria-label="Search applicants" />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Bookmark /> Views{views?.length ? ` (${views.length})` : ''}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Saved views</DropdownMenuLabel>
                {(views ?? []).length === 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">Save a filter + sort + column set to reuse it or share it with your team.</p>}
                {(views ?? []).map((v) => (
                  <DropdownMenuItem key={v.id} onSelect={() => applyView(v.config)} className="justify-between">
                    <span className="truncate">{v.name}{v.shared && <span className="ml-1 text-xs text-muted-foreground">(shared)</span>}</span>
                    {v.user_id === user.id && (
                      <button type="button" aria-label={`Delete view ${v.name}`} className="rounded p-1 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); run(() => deleteViewAction(v.id), 'View deleted'); }}><Trash2 className="size-3.5" /></button>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSaveOpen(true)}><Plus /> Save current view…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 /> Columns</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(v)} onSelect={(e) => e.preventDefault()}>
                    {COLUMN_LABELS[c.id] ?? c.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!canUse('export') && <DropdownMenuLabel className="flex items-center gap-1 text-primary"><Sparkles className="size-3.5" /> Premium feature</DropdownMenuLabel>}
                <DropdownMenuItem onSelect={() => exportRows('csv', 'filtered')}>All matching → CSV</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportRows('xlsx', 'filtered')}>All matching → XLSX</DropdownMenuItem>
                {selectedIds.length > 0 && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => exportRows('csv', 'selected')}>Selected ({selectedIds.length}) → CSV</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportRows('xlsx', 'selected')}>Selected ({selectedIds.length}) → XLSX</DropdownMenuItem>
                </>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CaseFilterBar filters={filters} onChange={(f) => update({ filters: f })} />
      </div>

      {selectedIds.length > 0 && canWrite && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-accent px-3 py-2 shadow-sm" role="toolbar" aria-label="Bulk actions">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={pending}>Move to stage</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {STAGES.map((s) => <DropdownMenuItem key={s.key} onSelect={() => run(() => changeStageAction({ caseIds: selectedIds, stage: s.key as CaseStage }), `Moved ${selectedIds.length} to ${s.short}`)}>{s.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={pending}><UserCog /> Assign</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => run(() => assignAdvisorAction({ caseIds: selectedIds, userId: null }), 'Unassigned')}>Unassigned</DropdownMenuItem>
              {advisors.map((m) => <DropdownMenuItem key={m.user_id} onSelect={() => run(() => assignAdvisorAction({ caseIds: selectedIds, userId: m.user_id }), `Assigned to ${m.full_name}`)}>{m.full_name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const tag = window.prompt('Tag to add to the selected applicants');
            if (tag?.trim()) run(() => tagCasesAction({ caseIds: selectedIds, tag: tag.trim(), mode: 'add' }), 'Tag added');
          }}>Add tag</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => applyChecklistAction({ caseIds: selectedIds }), 'Matching checklists applied')}>Apply checklist</Button>
          {isAdmin && <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelection({})}>Clear</Button>
        </div>
      )}

      {isError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm">We couldn&apos;t load applicants. Check your connection and refresh.</p>}

      {nothingYet ? (
        <EmptyState icon={Users} title="No applicants yet" actions={
          <>
            {canWrite && <Button onClick={() => setFormOpen(true)}><Plus /> Add your first applicant</Button>}
            <Button variant="outline" asChild={canUse('import')} onClick={() => (!canUse('import') ? setUpgrade('import') : undefined)}>
              {canUse('import') ? <Link href="/applicants/import"><FileUp /> Import a spreadsheet</Link> : <><FileUp /> Import a spreadsheet <Sparkles className="text-primary" /></>}
            </Button>
          </>
        }>
          Add applicants one by one or import your existing spreadsheet. Set processing times and build a checklist first so risk scores and document lists are ready from day one.
        </EmptyState>
      ) : (
        <>
          {/* Phone layout */}
          <ul className="grid gap-2.5 md:hidden" aria-label="Applicants">
            {isLoading && Array.from({ length: 4 }).map((_, i) => <li key={i}><Skeleton className="h-32 w-full rounded-xl" /></li>)}
            {rows.map((c) => <CaseCard key={c.id} c={c} selected={!!selection[c.id]} onSelect={(v) => setSelection((s) => ({ ...s, [c.id]: v }))} />)}
          </ul>

          {/* Laptop layout */}
          <div className={cn('hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block', isFetching && !isLoading && 'opacity-80')}>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => {
                      const sortable = SORTABLE[h.column.id];
                      const active = sortable && sort === sortable;
                      return (
                        <TableHead key={h.id} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined} className={h.column.id === 'select' ? 'w-10' : undefined}>
                          {sortable ? (
                            <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground" onClick={() => sortBy(h.column.id)}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {active ? (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                            </button>
                          ) : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={table.getVisibleLeafColumns().length}><Skeleton className="h-9 w-full" /></TableCell></TableRow>
                ))}
                {table.getRowModel().rows.map((r) => (
                  <GridRow key={r.id} row={r.original}>
                    {r.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                  </GridRow>
                ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="py-12 text-center text-muted-foreground">
                    No applicants match these filters. <button type="button" className="text-primary hover:underline" onClick={() => update({ filters: {}, q: '' })}>Clear filters</button>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {total > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total.toLocaleString()}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page === 0} onClick={() => update({ page: page - 1 })}><ChevronLeft /></Button>
                <span className="px-2">Page {page + 1} / {pageCount}</span>
                <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => update({ page: page + 1 })}><ChevronRight /></Button>
              </div>
            </div>
          )}
        </>
      )}

      <ApplicantFormDialog open={formOpen} onOpenChange={setFormOpen} mode={{ kind: 'create' }} />
      <UpgradeDialog feature={upgrade ?? 'import'} open={upgrade !== null} onOpenChange={(o) => !o && setUpgrade(null)} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} applicant{selectedIds.length === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              This permanently removes the applicants with all their cases, checklists, uploaded documents, tasks and history. Use it for erasure requests. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" loading={pending} onClick={() => run(async () => {
              const r = await deleteApplicantsAction({ applicantIds: [...new Set(selectedRows.map((x) => x.applicant_id))] });
              setConfirmDelete(false);
              return r;
            }, 'Applicants deleted')}>Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveViewDialog open={saveOpen} onOpenChange={setSaveOpen} config={currentConfig} onSaved={() => { void qc.invalidateQueries({ queryKey: ['views'] }); }} />
      {searchParams.size === 0 && null}
    </>
  );
}

function SaveViewDialog({ open, onOpenChange, config, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; config: Record<string, unknown>; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Save view</DialogTitle><DialogDescription>Stores the current filters, search, sort and visible columns.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveViewAction({ name, page: 'applicants', config, shared });
            if (!r.ok) { toast.error(r.error); return; }
            toast.success('View saved'); onSaved(); onOpenChange(false); setName('');
          });
        }}>
          <Field label="Name" htmlFor="view-name"><Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="e.g. High risk · France" autoFocus /></Field>
          <label className="flex items-center justify-between gap-3 text-sm">Share with my team <Switch checked={shared} onCheckedChange={setShared} /></label>
          <DialogFooter><Button type="submit" loading={pending}>Save view</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
