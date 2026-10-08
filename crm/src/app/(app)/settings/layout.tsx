import { SettingsNav } from '@/components/settings/settings-nav';
import { PageHeader } from '@/components/app/page-header';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Your organisation, team, risk assumptions, billing and privacy." />
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
