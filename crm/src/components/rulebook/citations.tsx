'use client';

import { BadgeCheck, ExternalLink, Layers, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CONFIDENCE, type Confidence } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import type { RuleSource } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICON: Record<Confidence, React.ComponentType<{ className?: string }>> = { official: BadgeCheck, multi: Layers, check: TriangleAlert };

/** Confidence is shown with colour, an icon and text, never colour alone. */
export function ConfidenceBadge({ value, className }: { value: Confidence; className?: string }) {
  const c = CONFIDENCE[value];
  const Icon = ICON[value];
  return <Badge tone={c.tone} className={className} title={c.blurb}><Icon aria-hidden /> {c.label}</Badge>;
}

/** Compact list of sources, each opening the publisher's page. */
export function SourceLinks({ ids, sources, lastChecked, className }: {
  ids: string[]; sources: Record<string, RuleSource> | undefined; lastChecked?: string | null; className?: string;
}) {
  return (
    <span className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      {ids.map((id) => {
        const s = sources?.[id];
        if (!s) return <span key={id}>{id}</span>;
        return (
          <a key={id} href={s.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
            title={`${s.publisher} (${s.published}): ${s.title}`}>
            <span className="truncate">{s.publisher}</span>
            {s.kind === 'secondary' && <span className="text-muted-foreground">(secondary)</span>}
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        );
      })}
      {lastChecked && <span>Checked {formatDate(lastChecked)}</span>}
    </span>
  );
}
