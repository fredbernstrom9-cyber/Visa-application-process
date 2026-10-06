// Writes a compiled rulebook to the database in one transaction.
// Unchanged rows are not touched; changed requirements bump their version (a database trigger flags
// them on open cases); rows no longer in the rulebook are deactivated, never deleted, so existing
// checklist items keep their link. New change-log entries notify affected organisations when they
// are recent (see NOTIFY_WINDOW_DAYS).
import type { ClientBase } from 'pg';
import type { CompiledRulebook } from './compile';

export const NOTIFY_WINDOW_DAYS = 45;

export interface SyncReport {
  version: string;
  sources: number;
  nationalities: number;
  guides: number;
  requirementsChanged: string[];
  requirementsAdded: string[];
  requirementsRetired: string[];
  factsChanged: number;
  changesPublished: { id: string; notified: boolean }[];
}

const json = (v: unknown) => JSON.stringify(v);

export async function syncRulebook(db: ClientBase, rb: CompiledRulebook, opts: { today: string; dryRun?: boolean }): Promise<SyncReport> {
  const cutoff = new Date(Date.parse(opts.today) - NOTIFY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  await db.query('begin');
  try {
    const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

    await q(
      `insert into public.rulebook_sources (id, kind, publisher, published, title, url)
       select id, kind, publisher, published, title, url from jsonb_populate_recordset(null::public.rulebook_sources, $1::jsonb)
       on conflict (id) do update set kind = excluded.kind, publisher = excluded.publisher, published = excluded.published,
         title = excluded.title, url = excluded.url, updated_at = now()
       where (rulebook_sources.kind, rulebook_sources.publisher, rulebook_sources.published, rulebook_sources.title, rulebook_sources.url)
             is distinct from (excluded.kind, excluded.publisher, excluded.published, excluded.title, excluded.url)`,
      [json(rb.sources)],
    );

    await q(
      `insert into public.rulebook_nationalities (code, name, schengen_visa, ireland_visa, flags, coverage)
       select code, name, schengen_visa, ireland_visa, flags, coverage from jsonb_populate_recordset(null::public.rulebook_nationalities, $1::jsonb)
       on conflict (code) do update set name = excluded.name, schengen_visa = excluded.schengen_visa, ireland_visa = excluded.ireland_visa,
         flags = excluded.flags, coverage = excluded.coverage, updated_at = now()
       where (rulebook_nationalities.name, rulebook_nationalities.schengen_visa, rulebook_nationalities.ireland_visa, rulebook_nationalities.flags, rulebook_nationalities.coverage)
             is distinct from (excluded.name, excluded.schengen_visa, excluded.ireland_visa, excluded.flags, excluded.coverage)`,
      [json(rb.nationalities)],
    );

    await q(
      `insert into public.rulebook_guides (id, destination, route, level, title, summary, permit, links, last_checked, active)
       select id, destination, route, level, title, summary, permit, links, last_checked, true
         from jsonb_populate_recordset(null::public.rulebook_guides, $1::jsonb)
       on conflict (id) do update set destination = excluded.destination, route = excluded.route, level = excluded.level,
         title = excluded.title, summary = excluded.summary, permit = excluded.permit, links = excluded.links,
         last_checked = excluded.last_checked, active = true, updated_at = now()`,
      [json(rb.guides)],
    );
    const retiredGuides = await q<{ id: string }>(
      `update public.rulebook_guides set active = false, updated_at = now()
        where active and not (id = any ($1::text[])) returning id`,
      [rb.guides.map((g) => g.id)],
    );
    void retiredGuides;

    const before = new Map(
      (await q<{ id: string; content_hash: string; active: boolean }>('select id, content_hash, active from public.rulebook_requirements'))
        .map((r) => [r.id, r]),
    );
    const requirementsAdded = rb.requirements.filter((r) => !before.has(r.id)).map((r) => r.id);
    const requirementsChanged = rb.requirements
      .filter((r) => before.has(r.id) && (before.get(r.id)!.content_hash !== r.content_hash || !before.get(r.id)!.active))
      .map((r) => r.id);

    await q(
      `insert into public.rulebook_requirements (id, guide_id, kind, label, detail, required, due_days_before_start, sort_order,
          nat_in, nat_not_in, residence_in, residence_not_in, confidence, source_ids, last_checked, content_hash, active)
       select id, guide_id, kind, label, detail, required, due_days_before_start, sort_order,
          nat_in, nat_not_in, residence_in, residence_not_in, confidence, source_ids, last_checked, content_hash, true
         from jsonb_populate_recordset(null::public.rulebook_requirements, $1::jsonb)
       on conflict (id) do update set guide_id = excluded.guide_id, kind = excluded.kind, label = excluded.label, detail = excluded.detail,
         required = excluded.required, due_days_before_start = excluded.due_days_before_start, sort_order = excluded.sort_order,
         nat_in = excluded.nat_in, nat_not_in = excluded.nat_not_in, residence_in = excluded.residence_in,
         residence_not_in = excluded.residence_not_in, confidence = excluded.confidence, source_ids = excluded.source_ids,
         last_checked = excluded.last_checked, content_hash = excluded.content_hash, active = true
       where rulebook_requirements.content_hash is distinct from excluded.content_hash
          or rulebook_requirements.last_checked is distinct from excluded.last_checked
          or rulebook_requirements.sort_order is distinct from excluded.sort_order
          or not rulebook_requirements.active`,
      [json(rb.requirements)],
    );
    const retired = await q<{ id: string }>(
      `update public.rulebook_requirements set active = false
        where active and not (id = any ($1::text[])) returning id`,
      [rb.requirements.map((r) => r.id)],
    );

    const factsBefore = new Map((await q<{ id: string; content_hash: string }>('select id, content_hash from public.rulebook_facts')).map((r) => [r.id, r.content_hash]));
    const factsChanged = rb.facts.filter((f) => factsBefore.has(f.id) && factsBefore.get(f.id) !== f.content_hash).length;
    await q(
      `insert into public.rulebook_facts (id, guide_id, kind, label, value, amount_eur, sort_order, nat_in, nat_not_in, residence_in,
          residence_not_in, confidence, source_ids, last_checked, content_hash, active)
       select id, guide_id, kind, label, value, amount_eur, sort_order, nat_in, nat_not_in, residence_in,
          residence_not_in, confidence, source_ids, last_checked, content_hash, true
         from jsonb_populate_recordset(null::public.rulebook_facts, $1::jsonb)
       on conflict (id) do update set guide_id = excluded.guide_id, kind = excluded.kind, label = excluded.label, value = excluded.value,
         amount_eur = excluded.amount_eur, sort_order = excluded.sort_order, nat_in = excluded.nat_in, nat_not_in = excluded.nat_not_in,
         residence_in = excluded.residence_in, residence_not_in = excluded.residence_not_in, confidence = excluded.confidence,
         source_ids = excluded.source_ids, last_checked = excluded.last_checked, content_hash = excluded.content_hash, active = true
       where rulebook_facts.content_hash is distinct from excluded.content_hash
          or rulebook_facts.last_checked is distinct from excluded.last_checked
          or rulebook_facts.sort_order is distinct from excluded.sort_order
          or not rulebook_facts.active`,
      [json(rb.facts)],
    );
    await q(`update public.rulebook_facts set active = false where active and not (id = any ($1::text[]))`, [rb.facts.map((f) => f.id)]);

    // Change log: insert-only. A published change is never rewritten (its notifications already went out).
    const existing = new Set((await q<{ id: string }>('select id from public.rulebook_changes')).map((r) => r.id));
    const fresh = rb.changes.filter((c) => !existing.has(c.id)).sort((a, b) => a.effective_on.localeCompare(b.effective_on));
    const changesPublished: SyncReport['changesPublished'] = [];
    for (const c of fresh) {
      const notify = c.effective_on >= cutoff;
      await q(
        `insert into public.rulebook_changes (id, effective_on, destinations, routes, nat_in, summary, detail, severity, source_ids, requirement_ids, notify)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [c.id, c.effective_on, c.destinations, c.routes, c.nat_in, c.summary, c.detail, c.severity, c.source_ids, c.requirement_ids, notify],
      );
      changesPublished.push({ id: c.id, notified: notify });
    }

    await q(
      `insert into public.rulebook_meta (id, version, verified_on, synced_at) values (true, $1, $2, now())
       on conflict (id) do update set version = excluded.version, verified_on = excluded.verified_on, synced_at = now()`,
      [rb.version, rb.verifiedOn],
    );

    await db.query(opts.dryRun ? 'rollback' : 'commit');
    return {
      version: rb.version, sources: rb.sources.length, nationalities: rb.nationalities.length, guides: rb.guides.length,
      requirementsAdded, requirementsChanged, requirementsRetired: retired.map((r) => r.id), factsChanged, changesPublished,
    };
  } catch (e) {
    await db.query('rollback').catch(() => undefined);
    throw e;
  }
}
