'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Plus, TriangleAlert } from 'lucide-react';
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

export function TemplatesView() {
  const { isAdmin } = useOrg();
  const { data: templates, isLoading } = useTemplates();
  const { data: counts } = useItemCounts();
  const today = Date.parse(todayIso());
  return (
    <>
      <PageHeader
        title="Checklists"
        description="Document checklist templates per destination and visa type, with optional nationality overrides. New cases receive the matching template automatically."
        actions={isAdmin ? <Button asChild><Link href="/checklists/new"><Plus /> New template</Link></Button> : undefined}
      />
      <Alert tone="warn" title="Always verify with the official source" className="mb-5">{REQUIREMENTS_NOTICE} Record the source and the date you last checked it on every template.</Alert>
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
