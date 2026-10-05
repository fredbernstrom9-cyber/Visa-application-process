'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, CalendarClock, ClipboardList, FileBarChart, KanbanSquare, LayoutDashboard, ListChecks, Menu, Settings, Sparkles, Users,
} from 'lucide-react';
import { useState } from 'react';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/misc';
import { signOutAction } from '@/lib/actions/auth';
import { roleLabel } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { OrgSwitcher } from './org-switcher';
import { useOrg } from './org-context';
import { ThemeToggle } from './theme-toggle';
import { LiveStatus } from '@/components/live/live-status';
import { NotificationsBell } from '@/components/live/notifications';
import { PresenceStack } from '@/components/live/presence';

export const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/applicants', label: 'Applicants', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/deadlines', label: 'Deadlines', icon: CalendarClock },
  { href: '/tasks', label: 'My tasks', icon: ListChecks },
  { href: '/activity', label: 'Live activity', icon: Activity },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`) || (href === '/applicants' && pathname.startsWith('/cases'));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-sidebar-accent text-white' : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { org, isAdmin } = useOrg();
  return (
    <div className="flex h-full flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground">
      <div className="px-1 pt-1"><Brand light /></div>
      <OrgSwitcher />
      <div className="flex-1 overflow-y-auto"><NavList onNavigate={onNavigate} /></div>
      {org.plan === 'free' && (
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs">
          <p className="font-medium text-white">Free plan</p>
          <p className="mt-0.5 text-sidebar-muted">1 user · 10 applicants. Unlock analytics, live tracking, import, portal links and reports.</p>
          {isAdmin && (
            <Button asChild size="xs" className="mt-2 w-full"><Link href="/settings/billing" onClick={onNavigate}><Sparkles /> Upgrade</Link></Button>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu({ platformAdmin }: { platformAdmin: boolean }) {
  const { user, role, org } = useOrg();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
        <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 normal-case">
          <span className="text-sm font-medium text-foreground">{user.fullName}</span>
          <span className="text-xs font-normal">{user.email}</span>
          <span className="text-xs font-normal">{roleLabel(role)} · {org.name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/settings/profile">Profile &amp; notifications</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/settings">Organisation settings</Link></DropdownMenuItem>
        {platformAdmin && <DropdownMenuItem asChild><Link href="/platform">Platform overview</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { void signOutAction(); }}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children, platformAdmin = false }: { children: React.ReactNode; platformAdmin?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
        <Sheet open={open} onOpenChange={setOpen}>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button>
          <SheetContent side="left" className="gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand className="text-sm lg:hidden" />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <PresenceStack />
          <LiveStatus />
          <NotificationsBell />
          <ThemeToggle />
          <UserMenu platformAdmin={platformAdmin} />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
