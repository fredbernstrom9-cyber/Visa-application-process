'use client';

import { useEffect } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { useOrg } from '@/components/app/org-context';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { AtRiskList } from './at-risk-list';
import { SetupGuide } from './setup-guide';

export function OverviewView() {
  const { org, user } = useOrg();

  // Keep risk-transition and overdue notifications fresh even without a cron job (throttled in the database).
  useEffect(() => {
    void getSupabaseBrowser().rpc('touch_maintenance', { p_org: org.id });
  }, [org.id]);

  return (
    <>
      <PageHeader title={`Welcome back, ${user.fullName.split(' ')[0]}`} description="Where every applicant stands, and what needs attention first." />
      <SetupGuide />
      <AtRiskList />
    </>
  );
}
