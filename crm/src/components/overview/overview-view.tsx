'use client';

import { useEffect } from 'react';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { useOrg } from '@/components/app/org-context';
import { UpgradeCard } from '@/components/app/upgrade';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { AtRiskList } from './at-risk-list';
import { Dashboard } from './dashboard';
import { SetupGuide } from './setup-guide';
import { Skeleton } from '@/components/ui/misc';

export function OverviewView() {
  const { org, user, canUse } = useOrg();

  // Keep risk-transition and overdue notifications fresh even without a cron job (throttled in the database).
  useEffect(() => {
    void getSupabaseBrowser().rpc('touch_maintenance', { p_org: org.id });
  }, [org.id]);

  return (
    <>
      <PageHeader title={`Welcome back, ${user.fullName.split(' ')[0]}`} description="Where every applicant stands, what needs attention, and how your pipeline is performing." />
      <SetupGuide />
      {canUse('analytics') ? (
        <div className="grid gap-5">
          <Suspense fallback={<Skeleton className="h-96" />}><Dashboard /></Suspense>
          <AtRiskList />
        </div>
      ) : (
        <div className="grid gap-5">
          <AtRiskList />
          <UpgradeCard feature="analytics" />
        </div>
      )}
    </>
  );
}
