import 'server-only';
import { headers } from 'next/headers';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  return (fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown').slice(0, 64);
}

/**
 * Fixed-window limiter backed by Postgres (works across serverless instances).
 * Returns true when the request may proceed. Fails open if the limiter itself is unavailable
 * so an outage never locks every user out; the failure is logged.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error('[rate-limit] unavailable, failing open:', (e as Error).message);
    return true;
  }
}

export const LIMITS = {
  auth: { limit: 10, window: 600 },        // password / magic-link attempts per IP per 10 minutes
  authEmail: { limit: 5, window: 900 },    // per target e-mail per 15 minutes
  portalView: { limit: 60, window: 300 },  // portal page loads per IP+token per 5 minutes
  portalUpload: { limit: 20, window: 600 },
  portalFail: { limit: 20, window: 600 },  // invalid token guesses per IP per 10 minutes
} as const;
