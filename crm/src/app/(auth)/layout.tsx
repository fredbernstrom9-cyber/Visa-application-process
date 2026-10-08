import { Brand } from '@/components/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Brand light />
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Every applicant&apos;s visa file, visible before the start date is at risk.
          </h2>
          <ul className="space-y-3 text-[15px] text-sidebar-muted">
            <li>Live pipeline and risk scoring across every EU / Schengen destination</li>
            <li>Document checklists with private uploads and an applicant portal</li>
            <li>Acceptance, bottleneck and cohort analytics your management can trust</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-muted">Requirements change often. Always confirm with the consulate or official portal.</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Brand className="mb-8 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
