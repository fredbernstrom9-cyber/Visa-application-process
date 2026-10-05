import * as React from 'react';
import { Avatar as AvatarPrimitive, Separator as SeparatorPrimitive, Progress as ProgressPrimitive } from 'radix-ui';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
      {...props}
    />
  );
}

function UserAvatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
  return (
    <AvatarPrimitive.Root className={cn('relative flex size-7 shrink-0 overflow-hidden rounded-full', className)} title={name ?? undefined}>
      {src && <AvatarPrimitive.Image src={src} alt="" className="aspect-square size-full object-cover" />}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center bg-accent text-[10px] font-semibold text-accent-foreground">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      aria-label={label}
      value={v}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full transition-all', v >= 100 ? 'bg-ok' : 'bg-primary')}
        style={{ width: `${v}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

const alertTones = {
  info: { cls: 'border-info/30 bg-info-bg text-foreground', icon: Info, iconCls: 'text-info' },
  warn: { cls: 'border-warn/30 bg-warn-bg text-foreground', icon: TriangleAlert, iconCls: 'text-warn' },
  danger: { cls: 'border-danger/30 bg-danger-bg text-foreground', icon: AlertCircle, iconCls: 'text-danger' },
  ok: { cls: 'border-ok/30 bg-ok-bg text-foreground', icon: CheckCircle2, iconCls: 'text-ok' },
};
function Alert({ tone = 'info', title, children, className }: { tone?: keyof typeof alertTones; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const t = alertTones[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={cn('flex gap-3 rounded-lg border p-3 text-sm', t.cls, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', t.iconCls)} aria-hidden />
      <div className="grid gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-[13px] text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
const TableHeader = (p: React.ComponentProps<'thead'>) => <thead {...p} className={cn('[&_tr]:border-b', p.className)} />;
const TableBody = (p: React.ComponentProps<'tbody'>) => <tbody {...p} className={cn('[&_tr:last-child]:border-0', p.className)} />;
const TableRow = (p: React.ComponentProps<'tr'>) => <tr {...p} className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-accent', p.className)} />;
const TableHead = (p: React.ComponentProps<'th'>) => (
  <th {...p} className={cn('h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground', p.className)} />
);
const TableCell = (p: React.ComponentProps<'td'>) => <td {...p} className={cn('px-3 py-2.5 align-middle', p.className)} />;

export { Skeleton, Separator, UserAvatar, Progress, Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell };

/** Toggle between a few views of the same content (not tabs: there is no separate panel per option). */
function SegmentedControl<T extends string>({ value, onChange, options, label, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-[3px]', className)}>
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring/40',
            value === o.value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { SegmentedControl };
