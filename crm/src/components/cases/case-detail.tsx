'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, FilePlus2, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Destination, RiskBadge, StageBadge } from '@/components/app/badges';
import { useOrg } from '@/components/app/org-context';
import { ApplicantFormDialog } from '@/components/applicants/applicant-form';
import { CaseViewers } from '@/components/live/presence';
import { useLive } from '@/components/live/realtime-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assignAdvisorAction, eraseApplicantAction, exportApplicantDataAction } from '@/lib/actions/cases';
import { countryName } from '@/lib/countries';
import { routeLabel, visaLabel } from '@/lib/domain';
import { ConfidenceBadge, SourceLinks } from '@/components/rulebook/citations';
import { useCaseRuleFacts, useRuleSources } from '@/lib/queries/rulebook';
import { downloadBlob } from '@/lib/export';
import { daysLabel, formatDate } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { useActivity, useApplicantCases } from '@/lib/queries/case-data';
import { useCase, useMembers } from '@/lib/queries/cases';
import type { CaseRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CaseChecklist } from './case-checklist';
import { CasePortal } from './case-portal';
import { CaseTasks } from './case-tasks';
import { EventRow } from './case-timeline';
import { StageControl } from './stage-control';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/** Funds, fees, work rights ... from the rulebook for this case's destination, route and nationality. */
function KeyRules({ c }: { c: CaseRow }) {
  const { data: facts, isLoading } = useCaseRuleFacts(c.id, [c.destination, c.route, c.nationality, c.residence_country]);
  const { data: sources } = useRuleSources();
  if (isLoading) return <Skeleton className="h-32" />;
  if (!facts?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Key rules</CardTitle>
        <CardDescription>{countryName(c.destination)} · {routeLabel(c.route)}. <Link href="/rulebook" className="text-primary underline underline-offset-2 hover:no-underline">Full guide</Link></CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <dl className="divide-y">
          {facts.map((f) => (
            <div key={f.id} className="grid gap-1 py-2 text-sm">
              <dt className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{f.label} <ConfidenceBadge value={f.confidence} className="px-1.5 py-0 text-[10px]" /></dt>
              <dd className="font-medium">{f.value}</dd>
              <dd><SourceLinks ids={f.source_ids} sources={sources} /></dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function Timeline({ caseId }: { caseId: string }) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useActivity({ caseId, types: undefined });
  const events = data?.pages.flat() ?? [];
  if (isLoading) return <Skeleton className="h-40" />;
  if (events.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nothing has happened on this case yet.</p>;
  return (
    <div>
      <ul className="divide-y">{events.map((e) => <EventRow key={e.id} e={e} showCase={false} />)}</ul>
      {hasNextPage && <Button variant="outline" size="sm" className="mt-3" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>Load older activity</Button>}
    </div>
  );
}

function RiskExplainer({ c }: { c: CaseRow }) {
  const { settings, isAdmin } = useOrg();
  const open = !['approved', 'refused', 'withdrawn'].includes(c.stage);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk</CardTitle>
        <CardDescription>Transparent: estimated time still needed versus time left.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <RiskBadge level={c.risk_level} reason={c.risk_reason} showReason />
        {open && c.start_date ? (
          <dl className="divide-y rounded-lg border px-3 text-sm">
            <Fact label="Days until start">{c.days_to_start}d</Fact>
            <Fact label="Estimated time still needed">~{c.est_days_needed}d</Fact>
            <Fact label="Slack"><span className={cn((c.slack_days ?? 0) < 0 && 'text-danger')}>{c.slack_days}d</span></Fact>
          </dl>
        ) : null}
        {open && settings && (
          <p className="text-xs text-muted-foreground">
            High risk when slack is below {settings.high_buffer_days}d, medium below {settings.medium_buffer_days}d.{' '}
            {isAdmin && <Link href="/settings/processing" className="text-primary underline underline-offset-2 hover:no-underline">Adjust processing times</Link>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PrivacyDialogs({ c, erase, onErase, exp, onExp }: { c: CaseRow; erase: boolean; onErase: (v: boolean) => void; exp: boolean; onExp: (v: boolean) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { announce } = useLive();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState('');
  void exp; void onExp;
  return (
    <Dialog open={erase} onOpenChange={onErase}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="size-5" /> Erase {c.full_name}</DialogTitle>
          <DialogDescription>
            Right to erasure: permanently deletes this person, every case, checklist, uploaded document, task, note and activity entry about them. The audit log keeps only that an erasure happened. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Field label={`Type “${c.full_name}” to confirm`} htmlFor="erase-confirm"><Input id="erase-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onErase(false)}>Cancel</Button>
          <Button variant="destructive" disabled={confirm.trim() !== c.full_name} loading={pending} onClick={() => start(async () => {
            const r = await eraseApplicantAction(c.applicant_id);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success('Applicant erased');
            void qc.invalidateQueries();
            announce(['cases', 'case', 'analytics', 'activity', 'pipeline', 'filter-options']);
            router.push('/applicants');
          })}>Erase permanently</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CaseDetail({ caseId }: { caseId: string }) {
  const { data: c, isLoading } = useCase(caseId);
  const { data: members } = useMembers();
  const { data: siblings } = useApplicantCases(c?.applicant_id);
  const { canWrite, isAdmin, canUse } = useOrg();
  const qc = useQueryClient();
  const { announce } = useLive();
  const hot = useIsHighlighted(caseId);
  const [edit, setEdit] = useState(false);
  const [addCase, setAddCase] = useState(false);
  const [erase, setErase] = useState(false);
  const [pending, start] = useTransition();

  if (isLoading) return <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!c) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-xl font-semibold">Case not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">It may have been deleted, or you may not have access to it.</p>
        <Button asChild variant="outline"><Link href="/applicants"><ArrowLeft /> Back to applicants</Link></Button>
      </div>
    );
  }

  const advisors = (members ?? []).filter((m) => m.role !== 'viewer');
  const others = (siblings ?? []).filter((s) => s.id !== c.id);
  const whatsapp = c.phone ? c.phone.replace(/[^\d]/g, '') : '';

  async function exportData() {
    const r = await exportApplicantDataAction(c!.applicant_id);
    if (!r.ok) { toast.error(r.error); return; }
    downloadBlob(new Blob([r.data.json], { type: 'application/json' }), r.data.filename);
    toast.success('Applicant data exported');
  }

  return (
    <div className={cn('grid gap-5', hot && 'live-flash rounded-xl')}>
      <div>
        <Link href="/applicants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Applicants</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.full_name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Destination code={c.destination} className="text-foreground" />
              <span>·</span><span>{visaLabel(c.visa_type)}</span>
              {c.route && <><span>·</span><span>{routeLabel(c.route)}</span></>}
              {c.programme && <><span>·</span><span>{c.programme}</span></>}
              {c.intake && <Badge tone="outline">{c.intake}</Badge>}
              {c.tags.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
            </div>
            <div className="flex flex-wrap items-center gap-2"><StageBadge stage={c.stage} /><CaseViewers caseId={c.id} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canWrite && <DropdownMenuItem onSelect={() => setAddCase(true)}><FilePlus2 /> Add another case for this person</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => void exportData()}><Download /> Export their data (JSON)</DropdownMenuItem>
                {isAdmin && <><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={() => setErase(true)}><Trash2 /> Erase applicant…</DropdownMenuItem></>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Card><CardContent className="py-4"><StageControl caseId={c.id} stage={c.stage} /></CardContent></Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Tabs defaultValue="checklist" className="min-w-0">
          <TabsList>
            <TabsTrigger value="checklist">Documents <span className="text-xs text-muted-foreground">{c.docs_verified}/{c.docs_total}</span></TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="portal">Applicant portal</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="checklist"><CaseChecklist caseRow={c} /></TabsContent>
          <TabsContent value="tasks"><CaseTasks caseId={c.id} defaultAssignee={c.assigned_to} /></TabsContent>
          <TabsContent value="activity"><Timeline caseId={c.id} /></TabsContent>
          <TabsContent value="portal"><CasePortal caseRow={c} canPortal={canUse('portal')} /></TabsContent>
          <TabsContent value="notes">
            <Card><CardContent className="py-4">
              {c.notes ? <p className="whitespace-pre-wrap text-sm">{c.notes}</p> : <p className="text-sm text-muted-foreground">No notes yet. {canWrite && 'Use Edit to add some.'}</p>}
              {c.decision_reason && <p className="mt-3 rounded-lg bg-muted p-3 text-sm"><strong>Decision note:</strong> {c.decision_reason}</p>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <aside className="grid content-start gap-5">
          <RiskExplainer c={c} />
          <KeyRules c={c} />
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <dl className="divide-y">
                <Fact label="Start date">{formatDate(c.start_date)}{c.start_date && c.days_to_start !== null && <span className="block text-xs font-normal text-muted-foreground">{daysLabel(c.days_to_start)}</span>}</Fact>
                <Fact label="Appointment">{formatDate(c.appointment_date)}</Fact>
                <Fact label="Admitted">{formatDate(c.opened_on)}</Fact>
                <Fact label="Submitted">{formatDate(c.submitted_at)}</Fact>
                <Fact label="Decided">{formatDate(c.decided_at)}</Fact>
                <Fact label="Nationality">{countryName(c.nationality) || '—'}</Fact>
                <Fact label="Lives in">{countryName(c.residence_country) || '—'}</Fact>
                <Fact label="Purpose">{c.purpose ?? '—'}</Fact>
                <Fact label="Advisor">
                  {canWrite ? (
                    <Select
                      aria-label="Assigned advisor" className="h-8 w-44 text-xs" value={c.assigned_to ?? ''} disabled={pending}
                      onChange={(e) => start(async () => {
                        const r = await assignAdvisorAction({ caseIds: [c.id], userId: e.target.value || null });
                        if (!r.ok) toast.error(r.error); else { void qc.invalidateQueries(); announce(['cases', 'case', 'activity', 'analytics']); }
                      })}
                    >
                      <option value="">Unassigned</option>
                      {advisors.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
                    </Select>
                  ) : (c.advisor_name ?? 'Unassigned')}
                </Fact>
              </dl>
              {(c.email || c.phone) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  {c.email && <Button asChild size="sm" variant="outline"><a href={`mailto:${c.email}`}><Mail /> E-mail</a></Button>}
                  {c.phone && <Button asChild size="sm" variant="outline"><a href={`tel:${c.phone}`}><Phone /> Call</a></Button>}
                  {whatsapp && <Button asChild size="sm" variant="outline"><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></Button>}
                </div>
              )}
            </CardContent>
          </Card>
          {others.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Other cases for {c.full_name.split(' ')[0]}</CardTitle></CardHeader>
              <CardContent className="grid gap-2 pt-0">
                {others.map((o) => (
                  <Link key={o.id} href={`/cases/${o.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-accent/40">
                    <Destination code={o.destination} /><StageBadge stage={o.stage} short />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          <RiskBadgeFootnote />
        </aside>
      </div>

      <ApplicantFormDialog open={edit} onOpenChange={setEdit} mode={{ kind: 'edit', row: c }} />
      <ApplicantFormDialog open={addCase} onOpenChange={setAddCase} mode={{ kind: 'add-case', applicantId: c.applicant_id, applicantName: c.full_name }} />
      <PrivacyDialogs c={c} erase={erase} onErase={setErase} exp={false} onExp={() => undefined} />
    </div>
  );
}

function RiskBadgeFootnote() {
  return <p className="px-1 text-xs text-muted-foreground">Requirements must be confirmed with the consulate or official portal.</p>;
}
