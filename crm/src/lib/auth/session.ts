import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { Org, OrgSettings } from '@/lib/types';
import type { Role } from '@/lib/domain';

export const ACTIVE_ORG_COOKIE = 'active_org';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  emailNotifications: boolean;
}

export interface OrgMembership {
  org: Org;
  role: Role;
  canViewAll: boolean;
}

export interface OrgContext {
  user: SessionUser;
  memberships: OrgMembership[];
  org: Org;
  role: Role;
  canViewAll: boolean;
  settings: OrgSettings | null;
}

/** Authoritative user lookup (verifies the token with Supabase Auth). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email_notifications')
    .eq('id', u.id)
    .maybeSingle();
  return {
    id: u.id,
    email: u.email ?? '',
    fullName: profile?.full_name || (u.email ?? '').split('@')[0],
    avatarUrl: profile?.avatar_url ?? null,
    emailNotifications: profile?.email_notifications ?? false,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

export const getMemberships = cache(async (userId: string): Promise<OrgMembership[]> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('memberships')
    .select('role, can_view_all, organizations(id, name, slug, plan, subscription_status, current_period_end, stripe_customer_id)')
    .eq('user_id', userId)
    .order('created_at');
  const rows = (data ?? []) as unknown as { role: Role; can_view_all: boolean; organizations: Org | Org[] | null }[];
  return rows
    .map((r) => ({ org: Array.isArray(r.organizations) ? r.organizations[0] : r.organizations, role: r.role, canViewAll: r.can_view_all }))
    .filter((r): r is OrgMembership => Boolean(r.org));
});

/** Session user + active organisation (cookie-selected, falling back to the first membership). */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await getMemberships(user.id);
  if (memberships.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.org.id === wanted) ?? memberships[0];
  const supabase = await createSupabaseServer();
  const { data: settings } = await supabase.from('org_settings').select('*').eq('org_id', active.org.id).maybeSingle();
  return { user, memberships, org: active.org, role: active.role, canViewAll: active.canViewAll, settings: (settings as OrgSettings | null) ?? null };
});

export async function requireOrgContext(): Promise<OrgContext> {
  const user = await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) {
    void user;
    redirect('/onboarding');
  }
  return ctx;
}
