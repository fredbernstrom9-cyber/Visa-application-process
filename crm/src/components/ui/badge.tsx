import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-bg text-neutral',
        ok: 'bg-ok-bg text-ok',
        warn: 'bg-warn-bg text-warn',
        danger: 'bg-danger-bg text-danger',
        info: 'bg-info-bg text-info',
        violet: 'bg-violet-bg text-violet',
        orange: 'bg-orange-bg text-orange',
        outline: 'border-border text-foreground',
        primary: 'bg-primary text-primary-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

function Badge({ className, tone, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
export { Badge, badgeVariants };
