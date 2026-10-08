'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/components/app/org-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

function useSetupCounts() {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['cases', org.id, 'setup-counts'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const [tpl, cases, members, settings, portal] = await Promise.all([
        supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('memberships').select('user_id', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('org_settings').select('processing_times_confirmed').eq('org_id', org.id).maybeSingle(),
        supabase.from('portal_links').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
      ]);
      return {
        templates: tpl.count ?? 0, cases: cases.count ?? 0, members: members.count ?? 0,
        confirmed: Boolean(settings.data?.processing_times_confirmed), portal: portal.count ?? 0,
      };
    },
  });
}

/** Guides a brand-new organisation: processing times, a checklist, applicants, teammates. */
export function SetupGuide() {
  const { data } = useSetupCounts();
  const { isAdmin, canUse } = useOrg();
  if (!data) return null;
  const steps = [
    { done: data.confirmed, title: 'Set processing times', body: 'Tell us how long visas, appointments and document preparation take for each destination. Risk scores depend on it.', href: '/settings/processing', cta: 'Open processing times', admin: true },
    { done: data.templates > 0, title: 'Build your first document checklist', body: 'One template per destination and visa type. New cases get the matching checklist automatically.', href: '/checklists', cta: 'Create a checklist', admin: true },
    { done: data.cases > 0, title: 'Add or import applicants', body: canUse('import') ? 'Add them one by one or import your spreadsheet with automatic column matching.' : 'Add your first applicants. Spreadsheet import is part of Premium.', href: data.cases === 0 && canUse('import') ? '/applicants/import' : '/applicants', cta: canUse('import') ? 'Import applicants' : 'Add applicants', admin: false },
    { done: data.members > 1, title: 'Invite your team', body: canUse('analytics') ? 'Advisors see only their own applicants unless you grant more.' : 'The Free plan includes one user. Upgrade to invite advisors.', href: '/settings/team', cta: 'Manage team', admin: true },
  ].filter((s) => isAdmin || !s.admin);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card className="mb-6 border-primary/25">
      <CardHeader>
        <CardTitle>Get your organisation ready</CardTitle>
        <CardDescription>{done} of {steps.length} steps done. Do them in this order for the most accurate risk scores.</CardDescription>
        <Progress value={(done / steps.length) * 100} className="mt-2 max-w-sm" label="Setup progress" />
      </CardHeader>
      <CardContent className="pt-1">
        <ol className="grid gap-2">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link href={s.href} className={cn('group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-accent/40', s.done && 'bg-muted/40')}>
                {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-label="Done" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="To do" />}
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', s.done && 'text-muted-foreground line-through')}>{i + 1}. {s.title}</span>
                  <span className="block text-[13px] text-muted-foreground">{s.body}</span>
                </span>
                {!s.done && <span className="mt-0.5 hidden shrink-0 items-center gap-1 text-sm font-medium text-primary sm:flex">{s.cta} <ChevronRight className="size-4" /></span>}
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
