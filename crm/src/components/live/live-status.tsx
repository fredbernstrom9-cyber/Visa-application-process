'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Radio, WifiOff } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useOrg } from '@/components/app/org-context';
import { useLive } from './realtime-provider';

export function relativeSeconds(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** "Live · synced 3s ago" / "Reconnecting…" connection indicator. */
export function LiveStatus() {
  const { status, lastSyncedAt } = useLive();
  const { isAdmin } = useOrg();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (status === 'off') {
    return (
      <Tooltip content="Live tracking updates every screen instantly. It is part of the Premium plan.">
        <Link
          href={isAdmin ? '/settings/billing' : '#'}
          className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted sm:flex"
        >
          <WifiOff className="size-3" aria-hidden /> Live tracking off
        </Link>
      </Tooltip>
    );
  }

  const live = status === 'live';
  const label = live
    ? `Live · synced ${lastSyncedAt ? relativeSeconds(now - lastSyncedAt) : 'just now'}`
    : status === 'connecting' ? 'Connecting…' : 'Reconnecting…';
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        live ? 'border-ok/30 bg-ok-bg text-ok' : 'border-warn/30 bg-warn-bg text-warn',
      )}
    >
      {live ? (
        <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" /><span className="relative inline-flex size-2 rounded-full bg-ok" /></span>
      ) : (
        <Radio className="size-3 animate-pulse motion-reduce:animate-none" aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{live ? 'Live' : '…'}</span>
    </span>
  );
}
