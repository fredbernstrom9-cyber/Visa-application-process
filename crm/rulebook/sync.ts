// Applies a compiled rulebook through the database function public.rulebook_apply (see migration
// 20261006000001), so the CLI, the app's deploy-time sync and the tests share one implementation.
import type { ClientBase } from 'pg';
import type { CompiledRulebook } from './compile';

export const NOTIFY_WINDOW_DAYS = 45; // mirrored in public.rulebook_apply

export interface SyncReport {
  version: string;
  requirementsAdded: string[];
  requirementsChanged: string[];
  requirementsRetired: string[];
  factsChanged: number;
  changesPublished: { id: string; notified: boolean }[];
}

/** The JSON payload public.rulebook_apply expects. */
export const rulebookPayload = (rb: CompiledRulebook) => rb;

export async function syncRulebook(db: ClientBase, rb: CompiledRulebook, opts: { today: string; dryRun?: boolean }): Promise<SyncReport> {
  await db.query('begin');
  try {
    const { rows } = await db.query<{ r: SyncReport }>('select public.rulebook_apply($1::jsonb, $2::date) r', [JSON.stringify(rulebookPayload(rb)), opts.today]);
    await db.query(opts.dryRun ? 'rollback' : 'commit');
    return rows[0].r;
  } catch (e) {
    await db.query('rollback').catch(() => undefined);
    throw e;
  }
}
