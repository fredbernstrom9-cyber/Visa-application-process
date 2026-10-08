'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { fieldClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function TagInput({ value, onChange, id, placeholder = 'Add a tag and press Enter' }: { value: string[]; onChange: (v: string[]) => void; id?: string; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim().slice(0, 40);
    if (t && !value.includes(t) && value.length < 30) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className={cn(fieldClass, 'flex min-h-9 flex-wrap items-center gap-1.5 py-1.5')}>
      {value.map((t) => (
        <Badge key={t} tone="info" className="gap-1 pr-1">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-sm hover:bg-black/10"><X /></button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
