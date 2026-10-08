import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { sendDigests } from '@/lib/digest';
import { ensureRulebookSynced } from '@/lib/rulebook-sync';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily maintenance (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 *  - refresh risk levels and raise "became high risk" alerts,
 *  - raise overdue document / task alerts,
 *  - purge expired rate-limit rows and old read notifications,
 *  - send the opt-in e-mail digest,
 *  - make sure the database has this deployment's rulebook.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const admin = createSupabaseAdmin();
  const { data: orgs, error } = await admin.rpc('run_maintenance', { p_org: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const digest = await sendDigests(admin);
  const rulebook = await ensureRulebookSynced({ force: true });
  return NextResponse.json({ ok: true, organisations: orgs, digest, rulebook: rulebook.status });
}
