'use client';

import { Bot, CheckCircle2, FileText, Gavel, Link2, ListPlus, PlusCircle, Repeat, Upload, UserCog, Download, FileUp, Circle } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { UserAvatar } from '@/components/ui/misc';
import { describeEvent, type IconKey } from '@/lib/activity';
import { relativeTime, formatDateTime } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { useMembers } from '@/lib/queries/cases';
import type { ActivityRow } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  plus: PlusCircle, stage: Repeat, gavel: Gavel, user: UserCog, file: FileText, upload: Upload, task: ListPlus,
  check: CheckCircle2, import: FileUp, export: Download, link: Link2, dot: Circle,
};

export function useNameResolver() {
  const { data: members } = useMembers();
  return useMemo(() => {
    const map = new Map((members ?? []).map((m) => [m.user_id, m.full_name]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? 'a teammate' : 'nobody');
  }, [members]);
}

export function EventRow({ e, showCase = true }: { e: ActivityRow; showCase?: boolean }) {
  const name = useNameResolver();
  const hot = useIsHighlighted(e.id);
  const d = describeEvent(e, name);
  const Icon = ICONS[d.icon];
  const actor = e.actor_type === 'applicant' ? 'The applicant' : e.actor_type === 'system' ? 'System' : (e.actor_name ?? 'A former teammate');
  return (
    <li className={cn('flex gap-3 py-3', hot && 'live-flash')}>
      <div className="relative">
        {e.actor_type === 'user' ? <UserAvatar name={e.actor_name} src={e.actor_avatar} className="size-8" /> : (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground" title={actor}>{e.actor_type === 'applicant' ? <Upload className="size-4" /> : <Bot className="size-4" />}</span>
        )}
        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border bg-card"><Icon className="size-2.5 text-muted-foreground" /></span>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="leading-snug">
          <span className="font-medium">{actor}</span>{e.actor_type === 'applicant' && <span className="text-muted-foreground"> (portal)</span>} {d.before}{' '}
          {d.withCase && showCase && e.case_id && <Link href={`/cases/${e.case_id}`} className="font-medium text-primary hover:underline">{e.applicant_name ?? 'a case'}</Link>}
          {d.after && <span> {d.after}</span>}
        </p>
        <time dateTime={e.created_at} title={formatDateTime(e.created_at)} className="text-xs text-muted-foreground">{relativeTime(e.created_at)}</time>
      </div>
    </li>
  );
}
