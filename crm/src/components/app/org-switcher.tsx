'use client';

import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { switchOrganizationAction } from '@/lib/actions/org';
import { roleLabel } from '@/lib/domain';
import { useOrg } from './org-context';

export function OrgSwitcher() {
  const { org, memberships } = useOrg();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        disabled={pending}
        aria-label="Switch organisation"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Building2 className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium leading-tight">{org.name}</span>
          <span className="block text-[11px] capitalize leading-tight text-sidebar-muted">{org.plan} plan</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organisations</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.orgId}
            onSelect={() => start(async () => {
              const res = await switchOrganizationAction(m.orgId);
              if (!res.ok) toast.error(res.error);
              else router.refresh();
            })}
          >
            <span className="min-w-0 flex-1 truncate">{m.orgName}</span>
            <span className="text-xs text-muted-foreground">{roleLabel(m.role)}</span>
            {m.orgId === org.id && <Check />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/onboarding?new=1')}><Plus /> New organisation</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
