'use client';

import { createContext, useContext, useMemo } from 'react';
import { canWrite, isAdmin, type Role } from '@/lib/domain';
import { canUse as planCanUse, type Feature, type Plan } from '@/lib/plans';
import type { Org, OrgSettings } from '@/lib/types';

export interface ClientUser { id: string; email: string; fullName: string; avatarUrl: string | null; emailNotifications: boolean }
export interface ClientMembership { orgId: string; orgName: string; role: Role; plan: Plan }

interface OrgState {
  user: ClientUser;
  org: Org;
  role: Role;
  canViewAll: boolean;
  settings: OrgSettings | null;
  memberships: ClientMembership[];
  /** Can this role modify data? (viewers are read-only) */
  canWrite: boolean;
  isAdmin: boolean;
  canUse: (feature: Feature) => boolean;
  /** Advisors without "view all" only see their own applicants. */
  scopedToOwn: boolean;
}

const Ctx = createContext<OrgState | null>(null);

export function OrgProvider({ value, children }: {
  value: { user: ClientUser; org: Org; role: Role; canViewAll: boolean; settings: OrgSettings | null; memberships: ClientMembership[] };
  children: React.ReactNode;
}) {
  const state = useMemo<OrgState>(() => ({
    ...value,
    canWrite: canWrite(value.role),
    isAdmin: isAdmin(value.role),
    canUse: (f) => planCanUse(value.org, f),
    scopedToOwn: value.role === 'advisor' && !value.canViewAll,
  }), [value]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useOrg(): OrgState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOrg must be used inside <OrgProvider>');
  return v;
}
