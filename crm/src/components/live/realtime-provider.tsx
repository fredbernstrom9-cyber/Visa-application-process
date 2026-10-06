'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { markChanged } from '@/lib/live/highlights';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { NotificationRow } from '@/lib/types';

export type LiveStatus = 'off' | 'connecting' | 'live' | 'reconnecting';

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  caseIds: string[];
  paths: string[];
  onlineAt: number;
}

export interface DragInfo { userId: string; name: string }

interface LiveCtx {
  status: LiveStatus;
  lastSyncedAt: number | null;
  online: PresenceUser[];
  viewersOf: (caseId: string) => PresenceUser[];
  /** Tell teammates which case this tab is looking at (null to clear). */
  setViewingCase: (caseId: string | null) => void;
  dragging: Record<string, DragInfo>;
  announceDrag: (caseId: string, active: boolean) => void;
  /** Ask other clients to refetch (used after deletes, which Postgres changes cannot filter by org). */
  announce: (keys: string[]) => void;
}

const Ctx = createContext<LiveCtx | null>(null);

type TableName =
  | 'cases' | 'applicants' | 'checklist_items' | 'checklist_item_files' | 'tasks' | 'activity_events'
  | 'memberships' | 'org_settings' | 'processing_times' | 'portal_links';

const TABLES: TableName[] = [
  'cases', 'applicants', 'checklist_items', 'checklist_item_files', 'tasks', 'activity_events',
  'memberships', 'org_settings', 'processing_times', 'portal_links',
];

/** Which cached queries each table feeds. Query keys always start with one of these prefixes. */
const INVALIDATES: Record<TableName, string[]> = {
  cases: ['cases', 'case', 'analytics', 'deadlines', 'filter-options', 'pipeline'],
  applicants: ['cases', 'case', 'filter-options'],
  checklist_items: ['items', 'case', 'deadlines', 'cases'],
  checklist_item_files: ['files', 'items'],
  tasks: ['tasks', 'deadlines', 'analytics'],
  activity_events: ['activity'],
  memberships: ['members'],
  org_settings: ['cases', 'case', 'analytics', 'settings', 'pipeline'],
  processing_times: ['cases', 'case', 'analytics', 'settings', 'pipeline'],
  portal_links: ['portal'],
};

interface ChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { org, user, canUse } = useOrg();
  const qc = useQueryClient();
  const router = useRouter();
  const enabled = canUse('live_tracking');

  const [rawStatus, setStatus] = useState<LiveStatus>('connecting');
  const status: LiveStatus = enabled ? rawStatus : 'off';
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [dragging, setDragging] = useState<Record<string, DragInfo>>({});
  const [nonce, setNonce] = useState(0);

  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null>(null);
  const viewingRef = useRef<string | null>(null);
  const pendingKeys = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedOnce = useRef(false);
  const lastHiddenAt = useRef<number | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const keys = [...pendingKeys.current];
    pendingKeys.current.clear();
    for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
  }, [qc]);

  const queue = useCallback((keys: string[]) => {
    keys.forEach((k) => pendingKeys.current.add(k));
    flushTimer.current ??= setTimeout(flush, 250);
  }, [flush]);

  const track = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    void ch.track({
      userId: user.id, name: user.fullName, avatar: user.avatarUrl,
      caseId: viewingRef.current,
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      onlineAt: Date.now(),
    });
  }, [user.id, user.fullName, user.avatarUrl]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseBrowser();
    const channel = supabase.channel(`org:${org.id}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const onChange = (table: TableName) => (payload: ChangePayload) => {
      setLastSyncedAt(Date.now());
      queue(INVALIDATES[table]);
      const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
      if (payload.eventType === 'DELETE' || !row) return;
      const actor = (payload.eventType === 'INSERT' ? (row.created_by ?? row.uploaded_by) : (row.updated_by ?? null)) as string | null | undefined;
      // Rows changed by teammates, the applicant portal or the system flash briefly.
      if (table === 'activity_events' && payload.eventType === 'INSERT' && row.actor_id !== user.id) markChanged([row.id as string]);
      if (actor !== user.id && (table === 'cases' || table === 'checklist_items' || table === 'tasks' || table === 'checklist_item_files')) {
        markChanged([row.id as string, (row.case_id as string | undefined) ?? undefined]);
        if (table === 'cases') markChanged([row.applicant_id as string]);
      }
    };

    for (const t of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `org_id=eq.${org.id}` }, onChange(t) as never);
    }
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'organizations', filter: `id=eq.${org.id}` }, (() => {
      router.refresh(); // plan / name changed: re-render server components
    }) as never);
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, ((p: { new: NotificationRow }) => {
      setLastSyncedAt(Date.now());
      const n = p.new;
      queue(n.type === 'rule_changed' ? ['notifications', 'rulebook', 'items'] : ['notifications']);
      toast(n.title, {
        description: n.body ?? undefined,
        action: n.case_id
          ? { label: 'Open', onClick: () => router.push(`/cases/${n.case_id}`) }
          : n.type === 'rule_changed' ? { label: 'Review', onClick: () => router.push('/rulebook#changes') } : undefined,
        duration: 8000,
      });
    }) as never);

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, { userId: string; name: string; avatar: string | null; caseId: string | null; path: string; onlineAt: number }[]>;
      const users: PresenceUser[] = Object.entries(state).map(([key, metas]) => ({
        userId: key,
        name: metas[metas.length - 1]?.name ?? 'Teammate',
        avatar: metas[metas.length - 1]?.avatar ?? null,
        caseIds: [...new Set(metas.map((m) => m.caseId).filter((x): x is string => Boolean(x)))],
        paths: [...new Set(metas.map((m) => m.path).filter(Boolean))],
        onlineAt: Math.min(...metas.map((m) => m.onlineAt)),
      }));
      setOnline(users);
    });

    channel.on('broadcast', { event: 'drag' }, ({ payload }: { payload: { caseId: string; active: boolean; userId: string; name: string } }) => {
      setDragging((d) => {
        const next = { ...d };
        if (payload.active) next[payload.caseId] = { userId: payload.userId, name: payload.name };
        else delete next[payload.caseId];
        return next;
      });
      if (payload.active) {
        setTimeout(() => setDragging((d) => { const n = { ...d }; delete n[payload.caseId]; return n; }), 20_000);
      }
    });
    channel.on('broadcast', { event: 'invalidate' }, ({ payload }: { payload: { keys: string[] } }) => {
      queue(payload.keys.filter((k) => typeof k === 'string'));
    });

    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        setStatus('live');
        setLastSyncedAt(Date.now());
        track();
        // After a (re)connect we may have missed events: refetch everything once.
        if (subscribedOnce.current) void qc.invalidateQueries();
        subscribedOnce.current = true;
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        setStatus('reconnecting');
      }
    });

    // Health check: the label says "synced Ns ago", so verify the channel is actually joined.
    const health = setInterval(() => {
      const joined = (channel as unknown as { state?: string }).state === 'joined';
      if (joined && supabase.realtime.isConnected()) {
        setStatus('live');
        setLastSyncedAt(Date.now());
      } else {
        setStatus('reconnecting');
      }
    }, 15_000);

    // If the channel stays down, rebuild it with a fresh socket subscription.
    const watchdog = setInterval(() => {
      if ((channel as unknown as { state?: string }).state !== 'joined' && navigator.onLine) setNonce((n) => n + 1);
    }, 45_000);

    const onVisible = () => {
      if (document.visibilityState === 'hidden') { lastHiddenAt.current = Date.now(); return; }
      if (lastHiddenAt.current && Date.now() - lastHiddenAt.current > 30_000) void qc.invalidateQueries();
      lastHiddenAt.current = null;
      track();
    };
    const onOnline = () => { void qc.invalidateQueries(); setNonce((n) => n + 1); };
    const onOffline = () => setStatus('reconnecting');
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearInterval(health);
      clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [enabled, org.id, user.id, nonce, qc, queue, router, track]);

  const setViewingCase = useCallback((caseId: string | null) => {
    viewingRef.current = caseId;
    track();
  }, [track]);

  const announceDrag = useCallback((caseId: string, active: boolean) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'drag', payload: { caseId, active, userId: user.id, name: user.fullName } });
  }, [user.id, user.fullName]);

  const announce = useCallback((keys: string[]) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'invalidate', payload: { keys } });
  }, []);

  const value = useMemo<LiveCtx>(() => ({
    status, lastSyncedAt, online,
    viewersOf: (caseId) => online.filter((u) => u.userId !== user.id && u.caseIds.includes(caseId)),
    setViewingCase, dragging, announceDrag, announce,
  }), [status, lastSyncedAt, online, user.id, setViewingCase, dragging, announceDrag, announce]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive(): LiveCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLive must be used inside <RealtimeProvider>');
  return v;
}
