'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/misc';
import { useOrg } from '@/components/app/org-context';
import { useLive } from './realtime-provider';

/** Avatars of everyone currently online in the organisation. */
export function PresenceStack() {
  const { user } = useOrg();
  const { online, status } = useLive();
  if (status === 'off' || online.length === 0) return null;
  const shown = online.slice(0, 4);
  return (
    <Popover>
      <PopoverTrigger className="flex items-center rounded-full pr-1 focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${online.length} online`}>
        <span className="flex -space-x-2">
          {shown.map((u) => (
            <UserAvatar key={u.userId} name={u.name} src={u.avatar} className="size-7 ring-2 ring-background" />
          ))}
        </span>
        {online.length > 4 && <span className="ml-1.5 text-xs font-medium text-muted-foreground">+{online.length - 4}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Users className="size-3.5" /> Online now ({online.length})</p>
        <ul className="grid gap-2">
          {online.map((u) => (
            <li key={u.userId} className="flex items-center gap-2 text-sm">
              <span className="relative"><UserAvatar name={u.name} src={u.avatar} /><span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-popover bg-ok" /></span>
              <span className="min-w-0 flex-1 truncate">{u.name}{u.userId === user.id && <span className="text-muted-foreground"> (you)</span>}</span>
              {u.caseIds[0] && <Link href={`/cases/${u.caseIds[0]}`} className="text-xs text-primary hover:underline">viewing a case</Link>}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Registers this tab as "viewing case X" and lists teammates looking at the same case. */
export function CaseViewers({ caseId }: { caseId: string }) {
  const { viewersOf, setViewingCase, status } = useLive();
  useEffect(() => {
    setViewingCase(caseId);
    return () => setViewingCase(null);
  }, [caseId, setViewingCase]);
  const viewers = viewersOf(caseId);
  if (status === 'off' || viewers.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-accent/60 py-1 pl-1 pr-3 text-xs" role="status">
      <span className="flex -space-x-1.5">
        {viewers.slice(0, 3).map((v) => <UserAvatar key={v.userId} name={v.name} src={v.avatar} className="size-6 ring-2 ring-background" />)}
      </span>
      <span>{viewers.length === 1 ? `${viewers[0].name} is also viewing` : `${viewers.length} teammates are also viewing`}</span>
    </div>
  );
}
