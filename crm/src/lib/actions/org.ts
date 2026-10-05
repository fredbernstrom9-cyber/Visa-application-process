'use server';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ACTIVE_ORG_COOKIE, getMemberships, getSessionUser } from '@/lib/auth/session';
import { appUrl, APP_NAME } from '@/lib/env';
import { inviteEmail, sendEmail } from '@/lib/email';
import { allow, clientIp } from '@/lib/rate-limit';
import { createSupabaseServer } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { dbError, fail, ok, parse, uuid, withOrg, type ActionResult } from './helpers';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const setActiveOrg = async (id: string) => {
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
};

export async function createOrganizationAction(input: { name: string }): Promise<ActionResult> {
  const p = parse(z.object({ name: z.string().trim().min(2, 'Enter at least 2 characters').max(120) }), input);
  if ('error' in p) return p.error;
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.', 'forbidden');
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('create_organization', { p_name: p.data.name });
  if (error) return dbError(error);
  await setActiveOrg(data as string);
  redirect('/overview');
}

export async function switchOrganizationAction(orgId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.', 'forbidden');
  const memberships = await getMemberships(user.id);
  if (!memberships.some((m) => m.org.id === orgId)) return fail('You are not a member of that organisation.', 'forbidden');
  await setActiveOrg(orgId);
  return ok(undefined);
}

export async function renameOrganizationAction(input: { name: string }): Promise<ActionResult> {
  const p = parse(z.object({ name: z.string().trim().min(2).max(120) }), input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase, org }) => {
    const { error } = await supabase.from('organizations').update({ name: p.data.name }).eq('id', org.id);
    return error ? dbError(error) : ok(undefined);
  });
}

export async function inviteMemberAction(input: { email: string; role: 'admin' | 'advisor' | 'viewer'; canViewAll?: boolean }): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const p = parse(z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid e-mail address').max(320),
    role: z.enum(['admin', 'advisor', 'viewer']),
    canViewAll: z.boolean().optional(),
  }), input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase, org, user, role }) => {
    if (role === 'admin' && p.data.role === 'admin') return fail('Only owners can invite admins.', 'forbidden');
    const token = randomBytes(32).toString('base64url');
    const { error } = await supabase.from('invitations').insert({
      org_id: org.id, email: p.data.email, role: p.data.role,
      can_view_all: p.data.role === 'advisor' && Boolean(p.data.canViewAll),
      token_hash: hashToken(token), invited_by: user.id,
    });
    if (error) {
      if (error.code === '23505') return fail('There is already a pending invitation for that address.', 'validation');
      return dbError(error);
    }
    const link = `${appUrl()}/invite/${token}`;
    const msg = inviteEmail({ orgName: org.name, inviter: user.fullName, role: p.data.role, link });
    const sent = await sendEmail({ ...msg, to: p.data.email });
    return ok({ link, emailed: sent.ok && (process.env.EMAIL_PROVIDER || 'console') !== 'console' });
  });
}

export async function revokeInvitationAction(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail('Invalid invitation.', 'validation');
  return withOrg({ admin: true }, async ({ supabase }) => {
    const { error } = await supabase.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    return error ? dbError(error) : ok(undefined);
  });
}

export async function setMemberRoleAction(input: { userId: string; role: 'owner' | 'admin' | 'advisor' | 'viewer'; canViewAll: boolean }): Promise<ActionResult> {
  const p = parse(z.object({ userId: uuid, role: z.enum(['owner', 'admin', 'advisor', 'viewer']), canViewAll: z.boolean() }), input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase, org }) => {
    const { error } = await supabase.rpc('set_member_role', { p_org: org.id, p_user: p.data.userId, p_role: p.data.role, p_can_view_all: p.data.canViewAll });
    return error ? dbError(error) : ok(undefined);
  });
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) return fail('Invalid member.', 'validation');
  return withOrg({}, async ({ supabase, org, user }) => {
    const { error } = await supabase.rpc('remove_member', { p_org: org.id, p_user: userId });
    if (error) return dbError(error);
    if (userId === user.id) {
      const store = await cookies();
      store.delete(ACTIVE_ORG_COOKIE);
    }
    return ok(undefined);
  });
}

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  const ip = await clientIp();
  if (!(await allow(`invite-accept:${ip}`, 20, 600))) return fail('Too many attempts. Please wait a few minutes.', 'rate_limited');
  const user = await getSessionUser();
  if (!user) return fail('Please sign in first.', 'forbidden');
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) return dbError(error);
  await setActiveOrg(data as string);
  redirect('/overview');
}

/** Public, rate-limited lookup used by the invite landing page. */
export async function lookupInvitation(token: string) {
  const ip = await clientIp();
  if (!(await allow(`invite-view:${ip}`, 40, 600))) return { status: 'rate_limited' as const };
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from('invitations')
    .select('email, role, expires_at, accepted_at, revoked_at, organizations(name)')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!data) return { status: 'invalid' as const };
  const org = (data as unknown as { organizations: { name: string } | { name: string }[] | null }).organizations;
  const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
  if (data.revoked_at || data.accepted_at || new Date(data.expires_at) < new Date()) return { status: 'invalid' as const };
  return { status: 'ok' as const, email: data.email as string, role: data.role as string, orgName: orgName ?? APP_NAME };
}

export async function deleteOrganizationAction(input: { confirmName: string }): Promise<ActionResult> {
  return withOrg({ owner: true }, async ({ supabase, org }) => {
    if (input.confirmName.trim() !== org.name) return fail('Type the organisation name exactly to confirm.', 'validation');
    const { data: paths, error: pe } = await supabase.rpc('org_file_paths', { p_org: org.id });
    if (pe) return dbError(pe);
    const admin = createSupabaseAdmin();
    const list = (paths as string[] | null) ?? [];
    for (let i = 0; i < list.length; i += 500) {
      const { error } = await admin.storage.from('case-documents').remove(list.slice(i, i + 500));
      if (error) return fail('Could not remove stored documents. Nothing was deleted; please try again.', 'error');
    }
    const { error } = await supabase.rpc('delete_organization', { p_org: org.id });
    if (error) return dbError(error);
    const store = await cookies();
    store.delete(ACTIVE_ORG_COOKIE);
    return ok(undefined);
  });
}
