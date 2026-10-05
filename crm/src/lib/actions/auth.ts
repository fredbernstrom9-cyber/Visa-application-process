'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appUrl } from '@/lib/env';
import { ACTIVE_ORG_COOKIE, getSessionUser } from '@/lib/auth/session';
import { allow, clientIp, LIMITS } from '@/lib/rate-limit';
import { createSupabaseServer } from '@/lib/supabase/server';
import { dbError, fail, ok, parse, type ActionResult } from './helpers';

/** Only same-site relative paths may be used as post-login destinations (no open redirects). */
export async function safeNext(next: string | null | undefined): Promise<string> {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next;
  return '/overview';
}

const email = z.string().trim().toLowerCase().email('Enter a valid e-mail address').max(320);
const password = z.string().min(8, 'Use at least 8 characters').max(200);

async function guard(emailAddr: string): Promise<ActionResult<never> | null> {
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    allow(`auth:ip:${ip}`, LIMITS.auth.limit, LIMITS.auth.window),
    allow(`auth:email:${emailAddr}`, LIMITS.authEmail.limit, LIMITS.authEmail.window),
  ]);
  if (!byIp || !byEmail) return fail('Too many attempts. Please wait a few minutes and try again.', 'rate_limited');
  return null;
}

export async function signInWithPasswordAction(input: { email: string; password: string; next?: string }): Promise<ActionResult> {
  const p = parse(z.object({ email, password: z.string().min(1).max(200), next: z.string().optional() }), input);
  if ('error' in p) return p.error;
  const limited = await guard(p.data.email);
  if (limited) return limited;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
  if (error) return fail('E-mail or password is incorrect.', 'forbidden');
  redirect(await safeNext(p.data.next));
}

export async function signUpAction(input: { fullName: string; email: string; password: string; next?: string }): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const p = parse(z.object({ fullName: z.string().trim().min(1, 'Enter your name').max(120), email, password, next: z.string().optional() }), input);
  if ('error' in p) return p.error;
  const limited = await guard(p.data.email);
  if (limited) return limited;
  const supabase = await createSupabaseServer();
  const next = await safeNext(p.data.next);
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email,
    password: p.data.password,
    options: {
      data: { full_name: p.data.fullName },
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (/already registered|already been registered/i.test(error.message)) return fail('An account with this e-mail already exists. Try signing in.', 'validation');
    return fail(error.message, 'error');
  }
  if (data.session) redirect(next === '/overview' ? '/onboarding' : next);
  return ok({ needsConfirmation: true });
}

export async function sendMagicLinkAction(input: { email: string; next?: string }): Promise<ActionResult> {
  const p = parse(z.object({ email, next: z.string().optional() }), input);
  if ('error' in p) return p.error;
  const limited = await guard(p.data.email);
  if (limited) return limited;
  const supabase = await createSupabaseServer();
  const next = await safeNext(p.data.next);
  const { error } = await supabase.auth.signInWithOtp({
    email: p.data.email,
    options: { emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return fail('We could not send the link. Please try again in a moment.', 'error');
  return ok(undefined);
}

export async function requestPasswordResetAction(input: { email: string }): Promise<ActionResult> {
  const p = parse(z.object({ email }), input);
  if ('error' in p) return p.error;
  const limited = await guard(p.data.email);
  if (limited) return limited;
  const supabase = await createSupabaseServer();
  await supabase.auth.resetPasswordForEmail(p.data.email, { redirectTo: `${appUrl()}/auth/callback?next=/reset-password` });
  // Always succeed: never reveal whether an address has an account.
  return ok(undefined);
}

export async function updatePasswordAction(input: { password: string }): Promise<ActionResult> {
  const p = parse(z.object({ password }), input);
  if ('error' in p) return p.error;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return fail(error.message, 'error');
  return ok(undefined);
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(ACTIVE_ORG_COOKIE);
  redirect('/login');
}

export async function updateProfileAction(input: { fullName: string; emailNotifications: boolean }): Promise<ActionResult> {
  const p = parse(z.object({ fullName: z.string().trim().min(1).max(120), emailNotifications: z.boolean() }), input);
  if ('error' in p) return p.error;
  const user = await getSessionUser();
  if (!user) return fail('Please sign in again.', 'forbidden');
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('profiles').update({ full_name: p.data.fullName, email_notifications: p.data.emailNotifications }).eq('id', user.id);
  if (error) return dbError(error);
  return ok(undefined);
}
