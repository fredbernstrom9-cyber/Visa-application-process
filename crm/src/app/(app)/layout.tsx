import { AppShell } from '@/components/app/shell';
import { OrgProvider } from '@/components/app/org-context';
import { RealtimeProvider } from '@/components/live/realtime-provider';
import { requireOrgContext } from '@/lib/auth/session';
import { isPlatformAdmin } from '@/lib/platform-admin';
import type { Plan } from '@/lib/plans';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();
  return (
    <OrgProvider
      value={{
        user: ctx.user,
        org: ctx.org,
        role: ctx.role,
        canViewAll: ctx.canViewAll,
        settings: ctx.settings,
        memberships: ctx.memberships.map((m) => ({ orgId: m.org.id, orgName: m.org.name, role: m.role, plan: m.org.plan as Plan })),
      }}
    >
      <RealtimeProvider>
        <AppShell platformAdmin={isPlatformAdmin(ctx.user.id)}>{children}</AppShell>
      </RealtimeProvider>
    </OrgProvider>
  );
}
