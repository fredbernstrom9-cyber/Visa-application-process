import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getOrgContext, type OrgContext } from '@/lib/auth/session';
import { createSupabaseServer } from '@/lib/supabase/server';
import { canUse, type Feature } from '@/lib/plans';
import { isAdmin, canWrite } from '@/lib/domain';

export type ActionCode = 'plan_limit' | 'feature' | 'forbidden' | 'validation' | 'not_found' | 'rate_limited' | 'error';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ActionCode; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, code: ActionCode = 'error', fieldErrors?: Record<string, string[]>): ActionResult<never> => ({
  ok: false, error, code, fieldErrors,
});

interface DbErr { message?: string; code?: string; details?: string }

/** Turn Postgres / PostgREST errors into messages a customer can act on. */
export function dbError(e: DbErr | null | undefined): ActionResult<never> {
  const msg = e?.message ?? 'Unknown error';
  if (msg.startsWith('plan_limit:applicants')) return fail('Your Free plan includes 10 applicants. Upgrade to Premium for unlimited applicants.', 'plan_limit');
  if (msg.startsWith('plan_limit:seats')) return fail('Your Free plan includes 1 user. Upgrade to Premium to invite teammates.', 'plan_limit');
  if (msg.startsWith('feature_not_available')) return fail('This feature is part of the Premium plan.', 'feature');
  if (msg.includes('row-level security') || msg.includes('permission denied') || msg === 'forbidden') return fail('You do not have permission to do that.', 'forbidden');
  if (msg === 'invalid_assignee') return fail('That person is not a member of this organisation.', 'validation');
  if (msg === 'last_owner') return fail('An organisation must keep at least one owner.', 'validation');
  if (msg === 'org_limit') return fail('You already own the maximum number of organisations.', 'validation');
  if (msg === 'invalid_invitation') return fail('This invitation is invalid, expired or already used.', 'validation');
  if (msg === 'invitation_email_mismatch') return fail('This invitation was sent to a different e-mail address. Sign in with the invited address.', 'forbidden');
  if (msg === 'not_found') return fail('Not found.', 'not_found');
  if (e?.code === '23505') return fail('That already exists.', 'validation');
  if (e?.code === '23503') return fail('A related record no longer exists. Refresh and try again.', 'validation');
  if (e?.code === '23514') return fail('One of the values is not allowed.', 'validation');
  console.error('[db]', msg, e?.details ?? '');
  return fail('Something went wrong. Please try again.', 'error');
}

export interface ActionCtx extends OrgContext {
  supabase: SupabaseClient;
}

type Need = { write?: boolean; admin?: boolean; owner?: boolean; feature?: Feature };

/** Resolve session + active org, enforce role / plan, and hand the RLS-bound client to `fn`. */
export async function withOrg<T>(need: Need, fn: (ctx: ActionCtx) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const ctx = await getOrgContext();
    if (!ctx) return fail('Please sign in again.', 'forbidden');
    if (need.owner && ctx.role !== 'owner') return fail('Only owners can do that.', 'forbidden');
    if (need.admin && !isAdmin(ctx.role)) return fail('Only owners and admins can do that.', 'forbidden');
    if (need.write && !canWrite(ctx.role)) return fail('Viewers have read-only access.', 'forbidden');
    if (need.feature && !canUse(ctx.org, need.feature)) return fail('This feature is part of the Premium plan.', 'feature');
    const supabase = await createSupabaseServer();
    return await fn({ ...ctx, supabase });
  } catch (e) {
    console.error('[action]', e);
    return fail('Something went wrong. Please try again.', 'error');
  }
}

export function parse<S extends z.ZodType>(schema: S, input: unknown): { data: z.infer<S> } | { error: ActionResult<never> } {
  const r = schema.safeParse(input);
  if (r.success) return { data: r.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = r.error.issues[0];
  return { error: fail(first ? `${first.path.join('.') || 'Input'}: ${first.message}` : 'Invalid input', 'validation', fieldErrors) };
}

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const country2 = z.string().regex(/^[A-Za-z]{2}$/, 'Use a 2-letter country code').transform((s) => s.toUpperCase());
