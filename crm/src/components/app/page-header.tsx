import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, actions, className }: {
  icon?: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center', className)}>
      {Icon && <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icon className="size-5" /></span>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {actions && <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
