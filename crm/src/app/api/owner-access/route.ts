import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { createSupabaseServer } from '@/lib/supabase/server';
import { allow, clientIp } from '@/lib/rate-limit';
import { isSameOrigin } from '@/lib/same-origin';
import { ownerAccessConfig, ownerKeyMatches } from '@/lib/owner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

/** Exchanges the owner's private key for a normal Supabase session cookie. */
export async function POST(request: NextRequest) {
  const cfg = ownerAccessConfig();
  if (!cfg) return reply({ error: 'Not available' }, 404); // the feature does not exist unless it is configured
  if (!isSameOrigin(request)) return reply({ error: 'Forbidden' }, 403);

  // 256-bit secrets cannot be guessed, but there is no reason to allow hammering either
  if (!(await allow(`owner:${await clientIp()}`, 5, 600))) return reply({ error: 'Too many attempts. Try again later.' }, 429);

  const body = (await request.json().catch(() => ({}))) as { key?: unknown };
  const key = typeof body.key === 'string' ? body.key : '';
  if (key.length < 20 || key.length > 200 || !ownerKeyMatches(key, cfg.keyHash)) return reply({ error: 'Not available' }, 404);

  // Mint a one-time sign-in token for the configured account and redeem it, exactly like an e-mailed magic link.
  const admin = createSupabaseAdmin();
  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(cfg.userId);
  const email = found?.user?.email;
  if (lookupError || !email) {
    console.error('[owner-access] the configured owner account was not found');
    return reply({ error: 'Not available' }, 404);
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error('[owner-access] could not create a sign-in token:', linkError?.message);
    return reply({ error: 'Could not sign in' }, 500);
  }
  const supabase = await createSupabaseServer();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (verifyError) {
    console.error('[owner-access] could not start the session:', verifyError.message);
    return reply({ error: 'Could not sign in' }, 500);
  }
  console.info('[owner-access] owner signed in');
  return reply({ ok: true }, 200);
}
