'use client';

import { ChevronDown, Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface Option { value: string; label: string; hint?: string }

export function MultiSelect({ label, options, value, onChange, className, searchable }: {
  label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void; className?: string; searchable?: boolean;
}) {
  const [q, setQ] = useState('');
  const id = useId();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const showSearch = searchable ?? options.length > 8;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('font-normal', value.length > 0 && 'border-primary/50 bg-accent/60', className)}>
          {label}
          {value.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{value.length}</span>}
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {showSearch && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}`} className="h-8 pl-8 text-[13px]" aria-label={`Search ${label}`} />
          </div>
        )}
        <ul className="max-h-60 overflow-y-auto" role="group" aria-label={label}>
          {shown.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">No options yet</li>}
          {shown.map((o) => {
            const cid = `${id}-${o.value}`;
            return (
              <li key={o.value}>
                <label htmlFor={cid} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <Checkbox id={cid} checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        {value.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <Button variant="ghost" size="xs" onClick={() => onChange([])}>Clear selection</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
