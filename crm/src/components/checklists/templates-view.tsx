'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, ClipboardList, Plus, TriangleAlert } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { setUseRulebookAction } from '@/lib/actions/settings';
import { useOrgSettings } from '@/lib/queries/case-data';
import Link from 'next/link';
import { Destination } from '@/components/app/badges';
import { useOrg } from '@/components/app/org-context';
import { EmptyState, PageHeader } from '@/components/app/page-header';
import { Alert, Skeleton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { countryName } from '@/lib/countries';
import { REQUIREMENTS_NOTICE, SOURCE_STALE_DAYS, visaLabel } from '@/lib/domain';
import { formatDate, todayIso } from '@/lib/format';
import { useTemplates } from '@/lib/queries/case-data';
import { useRulebookMeta } from '@/lib/queries/rulebook';
import { getSupabaseBrowser } from '@/lib/supabase/client';

function useItemCounts() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['settings', org.id, 'template-counts'],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('checklist_template_items').select('template_id').eq('org_id', org.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { template_id: string }[]) counts[r.template_id] = (counts[r.template_id] ?? 0) + 1;
      return counts;
    },
  });
}

function RulebookSwitch() {
  const { isAdmin } = useOrg();
  const { data } = useOrgSettings();
  const { data: meta } = useRulebookMeta();
  const qc = useQueryClient();
  const [pending, start] = useTransition();
  const on = data?.settings?.use_rulebook ?? true;
  return (
    <Card className="mb-5">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <BookOpenCheck className="size-5 text-primary" aria-hidden />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <label htmlFor="use-rulebook" className="font-medium">Fill new cases from the ClearEntry rulebook</label>
          <p className="text-sm text-muted-foreground">
            When none of your templates below matches a case, its checklist comes from the source-cited rulebook for its destination, route and nationality
            {meta ? ` (checked ${formatDate(meta.verified_on)})` : ''}. Your own templates always win. <Link href="/rulebook" className="text-primary underline underline-offset-2 hover:no-underline">Browse the rulebook</Link>
          </p>
        </div>
        <Switch id="use-rulebook" checked={on} disabled={!isAdmin || pending || !data} onCheckedChange={(v) => start(async () => {
          const r = await setUseRulebookAction({ enabled: v });
          if (!r.ok) toast.error(r.error); else { toast.success(v ? 'Rulebook checklists on' : 'Rulebook checklists off'); void qc.invalidateQueries({ queryKey: ['settings'] }); }
        })} />
      </CardContent>
    </Card>
  );
}

export function TemplatesView() {
  const { isAdmin } = useOrg();
  const { data: templates, isLoading } = useTemplates();
  const { data: counts } = useItemCounts();
  const today = Date.parse(todayIso());
  return (
    <>
      <PageHeader
        title="Checklists"
        description="Your own checklist templates per destination and visa type, with optional nationality overrides. A matching template is applied to new cases instead of the rulebook."
        actions={isAdmin ? <Button asChild><Link href="/checklists/new"><Plus /> New template</Link></Button> : undefined}
      />
      <Alert tone="warn" title="Always verify with the official source" className="mb-5">{REQUIREMENTS_NOTICE} Record the source and the date you last checked it on every template.</Alert>
      <RulebookSwitch />
      {isLoading ? <Skeleton className="h-40" /> : (templates ?? []).length === 0 ? (
        <EmptyState icon={ClipboardList} title="Build your first checklist" actions={isAdmin ? <Button asChild><Link href="/checklists/new"><Plus /> Create a template</Link></Button> : undefined}>
          Pick a destination and visa type, list the documents applicants must provide, and note the official source. From then on every new case for that combination starts with this checklist.
          {!isAdmin && ' Ask an owner or admin to create templates.'}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(templates ?? []).map((t) => {
            const age = t.source_last_checked ? Math.floor((today - Date.parse(t.source_last_checked)) / 86_400_000) : null;
            const stale = age === null || age > SOURCE_STALE_DAYS;
            return (
              <Link key={t.id} href={`/checklists/${t.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardContent className="grid gap-2 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold leading-tight">{t.name}</h2>
                      {!t.active && <Badge tone="neutral">Inactive</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Destination code={t.destination} /><Badge tone="info">{visaLabel(t.visa_type)}</Badge>
                      {t.nationality && <Badge tone="violet">{countryName(t.nationality)} override</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{counts?.[t.id] ?? 0} items</p>
                    <p className={`flex items-center gap-1 text-xs ${stale ? 'font-medium text-warn' : 'text-muted-foreground'}`}>
                      {stale && <TriangleAlert className="size-3" />}
                      {t.official_source_name || 'No source recorded'} · {t.source_last_checked ? `checked ${formatDate(t.source_last_checked)}` : 'never checked'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
