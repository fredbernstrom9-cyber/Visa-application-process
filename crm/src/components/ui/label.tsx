import * as React from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn('flex items-center gap-2 text-sm font-medium leading-none select-none peer-disabled:opacity-50', className)}
      {...props}
    />
  );
}

/** Label + control + hint/error, used by every form. */
function Field({ label, htmlFor, hint, error, required, className, children }: {
  label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; error?: string | null; required?: boolean;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export { Label, Field };
