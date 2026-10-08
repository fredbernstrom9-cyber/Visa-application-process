import * as React from 'react';
import { cn } from '@/lib/utils';

export const fieldClass =
  'w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(fieldClass, 'h-9 py-1', className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(fieldClass, 'min-h-20 py-2', className)} {...props} />;
}

/** Native select: best-in-class on phones, fully accessible, zero JS. */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(fieldClass, 'h-9 appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat py-1 pr-8',
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238a93a6%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        className)}
      {...props}
    >
      {children}
    </select>
  );
}

export { Input, Textarea, Select };
