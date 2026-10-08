import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlatformOverview } from '@/components/platform/platform-overview';
import { requireUser } from '@/lib/auth/session';
import { isPlatformAdmin } from '@/lib/platform-admin';
import type { PlatformOverviewData } from '@/lib/platform-types';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Platform overview', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PlatformPage() {
  const user = await requireUser();
  if (!isPlatformAdmin(user.id)) notFound(); // customers get an ordinary 404: they cannot even tell the page exists

  const { data, error } = await createSupabaseAdmin().rpc('platform_overview');
  if (error || !data) {
    console.error('[platform] could not load the overview:', error?.message);
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
        Could not load the platform overview. Check that the latest database migration (08, platform overview) has been applied and that
        SUPABASE_SERVICE_ROLE_KEY is set.
      </div>
    );
  }
  return <PlatformOverview data={data as PlatformOverviewData} />;
}
