'use client';

import { BookOpenCheck, ChevronDown, ChevronRight, ExternalLink, FileText, Footprints, History } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Destination } from '@/components/app/badges';
import { EmptyState, PageHeader } from '@/components/app/page-header';
import { ConfidenceBadge, SourceLinks } from '@/components/rulebook/citations';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Alert, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { countryName, destinationOptions, flagEmoji } from '@/lib/countries';
import { REQUIREMENTS_NOTICE, ROUTES, routeLabel, stageLabel } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { useRuleChangeCases, useRuleChanges, useRuleGuide, useRuleGuides, useRuleSources, useRulebookMeta } from '@/lib/queries/rulebook';
import type { RuleRequirement } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Plain-language "who is this for" line for a targeted rule. */
function audience(r: { nat_in?: string[] | null; nat_not_in?: string[]; residence_in?: string[] | null; residence_not_in?: string[] }): string | null {
  const names = (codes: string[]) => codes.length > 6 ? `${codes.length} countries` : codes.map(countryName).join(', ');
  const parts: string[] = [];
  if (r.nat_in) parts.push(`nationals of ${names(r.nat_in)}`);
  if (r.nat_not_in?.length) parts.push(`not for nationals of ${names(r.nat_not_in)}`);
  if (r.residence_in) parts.push(`living in ${names(r.residence_in)}`);
  if (r.residence_not_in?.length) parts.push(`not living in ${names(r.residence_not_in)}`);
  return parts.length ? parts.join(' · ') : null;
}

function GuideDetail({ guideId }: { guideId: string }) {
  const { data, isLoading } = useRuleGuide(guideId);
  const { data: sources } = useRuleSources();
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const { guide, requirements, facts } = data;
  if (!guide) return <EmptyState title="Guide not found" />;
  const steps = requirements.filter((r) => r.kind === 'step');
  const docs = requirements.filter((r) => r.kind === 'document');

  const Item = ({ r }: { r: RuleRequirement }) => {
    const who = audience(r);
    return (
      <li className="grid gap-1 border-b py-2.5 last:border-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{r.label}</span>
          {!r.required && <Badge tone="neutral">Optional</Badge>}
          <ConfidenceBadge value={r.confidence} />
          {r.due_days_before_start != null && <span className="text-xs text-muted-foreground">~{r.due_days_before_start} days before start</span>}
        </div>
        {r.detail && <p className="text-[13px] text-muted-foreground">{r.detail}</p>}
        {who && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Applies to:</span> {who}</p>}
        <SourceLinks ids={r.source_ids} sources={sources} />
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-tight">{guide.title}</h2>
            <Badge tone={guide.level === 'full' ? 'ok' : 'neutral'}>{guide.level === 'full' ? 'Full guide' : 'EU baseline'}</Badge>
          </div>
          <p className="text-sm">{guide.summary}</p>
          {guide.permit && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Permit:</span> {guide.permit}</p>}
          <p className="text-xs text-muted-foreground">Checked {formatDate(guide.last_checked)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {guide.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2 hover:no-underline">
                {l.label} <ExternalLink className="size-3" aria-hidden />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {facts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Key figures</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.id} className="grid gap-1 rounded-lg border p-3">
                  <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label} <ConfidenceBadge value={f.confidence} /></dt>
                  <dd className="text-sm">{f.value}</dd>
                  {audience(f) && <dd className="text-xs text-muted-foreground">Applies to: {audience(f)}</dd>}
                  <dd><SourceLinks ids={f.source_ids} sources={sources} /></dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Footprints className="size-4" /> Steps</CardTitle></CardHeader>
          <CardContent><ul>{steps.map((r) => <Item key={r.id} r={r} />)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4" /> Documents</CardTitle></CardHeader>
          <CardContent><ul>{docs.map((r) => <Item key={r.id} r={r} />)}</ul></CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuidesTab() {
  const { data: guides, isLoading } = useRuleGuides();
  const [dest, setDest] = useState('FR');
  const [route, setRoute] = useState('study');
  const available = useMemo(() => (guides ?? []).filter((g) => g.destination === dest), [guides, dest]);
  const current = available.find((g) => g.route === route) ?? available[0];

  if (isLoading) return <Skeleton className="h-96" />;
  if ((guides ?? []).length === 0) {
    return <EmptyState icon={BookOpenCheck} title="The rulebook has not been loaded yet">Run <code>npm run rulebook:sync</code> against this database (see the README).</EmptyState>;
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Destination" htmlFor="rb-dest" className="w-60">
          <Select id="rb-dest" value={dest} onChange={(e) => setDest(e.target.value)}>
            {destinationOptions().filter((c) => (guides ?? []).some((g) => g.destination === c.code)).map((c) => (
              <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Route" htmlFor="rb-route" className="w-72">
          <Select id="rb-route" value={current?.route ?? route} onChange={(e) => setRoute(e.target.value)}>
            {ROUTES.filter((r) => available.some((g) => g.route === r.key)).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </Field>
      </div>
      {current ? <GuideDetail guideId={current.id} /> : <EmptyState title="No guide for this destination yet" />}
    </div>
  );
}

function ChangeCases({ changeId }: { changeId: string }) {
  const { data, isLoading } = useRuleChangeCases(changeId);
  if (isLoading) return <Skeleton className="h-16" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No open cases in your organisation are affected.</p>;
  return (
    <ul className="grid gap-1">
      {data.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/cases/${c.id}`} className="font-medium text-primary underline underline-offset-2 hover:no-underline">{c.full_name}</Link>
          <span className="text-muted-foreground">{flagEmoji(c.destination)} {countryName(c.destination)} · {routeLabel(c.route)} · {stageLabel(c.stage)}{c.start_date ? ` · starts ${formatDate(c.start_date)}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

function ChangesTab() {
  const { data, isLoading } = useRuleChanges();
  const { data: sources } = useRuleSources();
  const [open, setOpen] = useState<string | null>(null);
  if (isLoading) return <Skeleton className="h-96" />;
  if (!data?.length) return <EmptyState icon={History} title="No rule changes recorded yet" />;
  return (
    <ol className="grid gap-2.5">
      {data.map((ch) => {
        const expanded = open === ch.id;
        const many = ch.destinations.length > 4;
        return (
          <li key={ch.id} id={`change-${ch.id}`}>
            <Card className={cn(ch.open_cases > 0 && 'border-warn/50')}>
              <CardContent className="grid gap-2 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatDate(ch.effective_on)}</span>
                  <Badge tone={ch.severity === 'action' ? 'warn' : 'info'}>{ch.severity === 'action' ? 'Action may be needed' : 'For information'}</Badge>
                  {ch.routes?.map((r) => <Badge key={r} tone="outline">{routeLabel(r)}</Badge>)}
                  <span className="text-sm text-muted-foreground">
                    {many ? `${ch.destinations.length} countries` : ch.destinations.map((d) => <Destination key={d} code={d} className="mr-2" />)}
                  </span>
                </div>
                <p className="font-medium">{ch.summary}</p>
                {ch.detail && <p className="text-sm text-muted-foreground">{ch.detail}</p>}
                {ch.nat_in && <p className="text-xs text-muted-foreground">Nationals of {ch.nat_in.length > 6 ? `${ch.nat_in.length} countries` : ch.nat_in.map(countryName).join(', ')}</p>}
                <SourceLinks ids={ch.source_ids} sources={sources} />
                <button type="button" onClick={() => setOpen(expanded ? null : ch.id)}
                  className={cn('inline-flex w-fit items-center gap-1 text-sm font-medium', ch.open_cases > 0 ? 'text-warn' : 'text-muted-foreground')}
                  aria-expanded={expanded}>
                  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  {ch.open_cases === 0 ? 'No open cases affected' : `${ch.open_cases} open ${ch.open_cases === 1 ? 'case' : 'cases'} affected`}
                </button>
                {expanded && <ChangeCases changeId={ch.id} />}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

export function RulebookView() {
  const { data: meta } = useRulebookMeta();
  const [tab, setTab] = useState('guides');
  useEffect(() => {
    const sync = () => { if (window.location.hash.startsWith('#change')) setTab('changes'); };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return (
    <>
      <PageHeader
        title="Rulebook"
        description="ClearEntry's source-cited requirements per destination and route. New cases get a checklist from it automatically (unless your own template matches), and you are notified when a rule that affects your open cases changes."
        actions={meta ? <Badge tone="outline">Checked {formatDate(meta.verified_on)} · v{meta.version}</Badge> : undefined}
      />
      <Alert tone="warn" title="Confirm before advising" className="mb-5">{REQUIREMENTS_NOTICE} Items marked <strong>Verify</strong> rest on one source or on sources that disagree.</Alert>
      <Tabs value={tab} onValueChange={(v) => { setTab(v); history.replaceState(null, '', v === 'changes' ? '#changes' : '#'); }}>
        <TabsList>
          <TabsTrigger value="guides"><BookOpenCheck /> Guides</TabsTrigger>
          <TabsTrigger value="changes"><History /> Rule changes</TabsTrigger>
        </TabsList>
        <TabsContent value="guides"><GuidesTab /></TabsContent>
        <TabsContent value="changes"><ChangesTab /></TabsContent>
      </Tabs>
    </>
  );
}
