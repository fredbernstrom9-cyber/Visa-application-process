import 'server-only';
import { buildRulebook } from '../../rulebook';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Keeps the database's rulebook in step with the one bundled in this deployment. Called from the
 * daily cron and, in the background, from the signed-in app layout, so a new deploy loads its
 * rulebook on first use without anyone running a script. Checks once per server instance; the
 * database function takes an advisory lock, so concurrent instances cannot double-apply.
 */
let inflight: Promise<SyncOutcome> | null = null;

export type SyncOutcome =
  | { status: 'current'; version: string }
  | { status: 'synced'; version: string; report: unknown }
  | { status: 'skipped' | 'error'; reason: string };

async function run(): Promise<SyncOutcome> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: 'skipped', reason: 'no service role key' };
  const rb = buildRulebook();
  const admin = createSupabaseAdmin();
  const { data: meta, error } = await admin.from('rulebook_meta').select('version').maybeSingle();
  if (error) return { status: 'error', reason: error.message };
  if (meta?.version === rb.version) return { status: 'current', version: rb.version };
  const { data, error: e2 } = await admin.rpc('rulebook_apply', { p: rb, p_today: new Date().toISOString().slice(0, 10) });
  if (e2) return { status: 'error', reason: e2.message };
  console.info(`[rulebook] synced ${rb.version}`);
  return { status: 'synced', version: rb.version, report: data };
}

export function ensureRulebookSynced(opts: { force?: boolean } = {}): Promise<SyncOutcome> {
  if (!inflight || opts.force) {
    inflight = run().catch((e: unknown) => ({ status: 'error' as const, reason: e instanceof Error ? e.message : String(e) }));
    // retry on a later request if it failed
    void inflight.then((r) => { if (r.status === 'error') { console.error(`[rulebook] sync failed: ${r.reason}`); inflight = null; } });
  }
  return inflight;
}
