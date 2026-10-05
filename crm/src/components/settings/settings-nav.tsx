'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, CreditCard, Gauge, ScrollText, ShieldCheck, User, Users } from 'lucide-react';
import { useOrg } from '@/components/app/org-context';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/settings', label: 'Organisation', icon: Building2, admin: false },
  { href: '/settings/profile', label: 'My profile', icon: User, admin: false },
  { href: '/settings/team', label: 'Team & roles', icon: Users, admin: false },
  { href: '/settings/processing', label: 'Processing times & risk', icon: Gauge, admin: false },
  { href: '/settings/billing', label: 'Plan & billing', icon: CreditCard, admin: false },
  { href: '/settings/audit', label: 'Audit log', icon: ScrollText, admin: true },
  { href: '/settings/privacy', label: 'Data & privacy', icon: ShieldCheck, admin: false },
];

export function SettingsNav() {
  const pathname = usePathname();
  const { isAdmin } = useOrg();
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:grid lg:content-start">
      {ITEMS.filter((i) => !i.admin || isAdmin).map(({ href, label, icon: Icon }) => {
        const active = href === '/settings' ? pathname === '/settings' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={cn('flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors', active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="size-4" aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
