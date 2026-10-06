'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, BookOpenCheck, CheckCheck, FileWarning, Flame, Gavel, ListChecks, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { NotificationRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useOrg } from '@/components/app/org-context';
import { relativeTime } from '@/lib/format';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  case_high_risk: Flame, document_overdue: FileWarning, task_overdue: ListChecks, decision_recorded: Gavel,
  case_assigned: UserPlus, task_assigned: ListChecks, rule_changed: BookOpenCheck,
};
const TONES: Record<string, string> = {
  case_high_risk: 'text-danger', document_overdue: 'text-warn', task_overdue: 'text-warn', decision_recorded: 'text-info',
  case_assigned: 'text-primary', task_assigned: 'text-primary', rule_changed: 'text-warn',
};

export function useNotifications() {
  const { org, user, canUse } = useOrg();
  return useQuery({
    queryKey: ['notifications', org.id, user.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('notifications')
        .select('id, org_id, type, title, body, case_id, read_at, created_at')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    refetchInterval: canUse('live_tracking') ? false : 60_000,
  });
}

export function NotificationsBell() {
  const { data } = useNotifications();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    const supabase = getSupabaseBrowser();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}>
          {unread ? <BellRing /> : <Bell />}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white dark:text-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="xs" disabled={unread === 0} onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up. Alerts for high-risk cases, overdue documents and tasks, decisions, assignments and rule changes appear here.</li>}
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn('flex w-full gap-3 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/60', !n.read_at && 'bg-accent/40')}
                  onClick={() => {
                    void markRead([n.id]);
                    setOpen(false);
                    if (n.case_id) router.push(`/cases/${n.case_id}`);
                    else if (n.type === 'rule_changed') router.push('/rulebook#changes');
                  }}
                >
                  <Icon className={cn('mt-0.5 size-4 shrink-0', TONES[n.type] ?? 'text-muted-foreground')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                    <span className="block text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
