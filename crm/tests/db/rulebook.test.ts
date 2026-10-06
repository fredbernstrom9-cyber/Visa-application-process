import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRulebook } from '../../rulebook';
import type { CompiledRulebook } from '../../rulebook/compile';
import { syncRulebook } from '../../rulebook/sync';
import { createTestDb, DB_URL, rejects, type TestDb } from './helpers';

const d = describe.skipIf(!DB_URL);
const TODAY = '2026-10-06';

let db: TestDb;
let rb: CompiledRulebook;
let owner: string, advisor: string, outsider: string, org: string, otherOrg: string;

async function sync(book: CompiledRulebook, today = TODAY) {
  const c = await db.pool.connect();
  try { return await syncRulebook(c, book, { today }); } finally { c.release(); }
}

async function newCase(o: { org?: string; user?: string; nat?: string | null; res?: string | null; dest: string; visa?: string; route?: string; assigned?: string | null; stage?: string }) {
  const user = o.user ?? owner;
  const orgId = o.org ?? org;
  const [ap] = await db.as(user, (q) => q<{ id: string }>(
    `insert into applicants (org_id, full_name, nationality, residence_country) values ($1, 'Test Person', $2, $3) returning id`,
    [orgId, o.nat === undefined ? 'IN' : o.nat, o.res === undefined ? 'IN' : o.res]));
  const [c] = await db.as(user, (q) => q<{ id: string }>(
    `insert into cases (org_id, applicant_id, destination, visa_type, route, start_date, assigned_to, stage)
     values ($1, $2, $3, $4, $5, current_date + 120, $6, coalesce($7, 'admitted')::case_stage) returning id`,
    [orgId, ap.id, o.dest, o.visa ?? 'D', o.route ?? null, o.assigned ?? null, o.stage ?? null]));
  return c.id;
}

const rules = async (caseId: string) =>
  (await db.admin<{ rule_id: string | null; label: string }>(
    `select rule_id, label from checklist_items where case_id = $1 order by sort_order`, [caseId])).map((r) => r.rule_id);

beforeAll(async () => {
  if (!DB_URL) return;
  db = await createTestDb();
  rb = buildRulebook(TODAY);
  owner = await db.user('owner@rb.test', 'Ola Owner');
  advisor = await db.user('advisor@rb.test', 'Ada Advisor');
  outsider = await db.user('out@rb.test', 'Otto Outsider');
  org = await db.org(owner, 'Rulebook Org', 'premium');
  otherOrg = await db.org(outsider, 'Other Org', 'premium');
  await db.addMember(org, advisor, 'advisor');
  await sync(rb);
}, 180_000);

afterAll(async () => { if (db) await db.drop(); });

d('rulebook sync', () => {
  it('loads every guide, rule, fact, source and nationality', async () => {
    const [n] = await db.admin<{ g: number; r: number; f: number; s: number; n: number; v: string }>(
      `select (select count(*)::int from rulebook_guides where active) g,
              (select count(*)::int from rulebook_requirements where active) r,
              (select count(*)::int from rulebook_facts where active) f,
              (select count(*)::int from rulebook_sources) s,
              (select count(*)::int from rulebook_nationalities) n,
              (select version from rulebook_meta) v`);
    expect(n).toEqual({ g: rb.guides.length, r: rb.requirements.length, f: rb.facts.length, s: rb.sources.length, n: rb.nationalities.length, v: rb.version });
  });

  it('is idempotent: a second sync changes nothing and publishes nothing', async () => {
    const r = await sync(rb);
    expect(r.requirementsAdded).toEqual([]);
    expect(r.requirementsChanged).toEqual([]);
    expect(r.requirementsRetired).toEqual([]);
    expect(r.factsChanged).toBe(0);
    expect(r.changesPublished).toEqual([]);
  });

  it('customers can read the rulebook but never write it', async () => {
    const [row] = await db.as(owner, (q) => q<{ n: number }>(`select count(*)::int n from rulebook_requirements`));
    expect(row.n).toBe(rb.requirements.length);
    await rejects(db.as(owner, (q) => q(`update rulebook_requirements set label = 'x'`)), /permission denied/);
    await rejects(db.anon((q) => q(`select count(*) from rulebook_requirements`)), /permission denied/);
    await rejects(db.anon((q) => q(`select public.apply_rulebook('{}')`)), /permission denied/);
    await rejects(db.as(owner, (q) => q(
      `insert into rulebook_changes (id, effective_on, destinations, summary, source_ids) values ('evil', current_date, '{FR}', 'x', '{a}')`)), /permission denied/);
  });
});

d('rulebook checklists on cases', () => {
  it('fills a new case from the rulebook, targeted by nationality and residence', async () => {
    const india = await newCase({ dest: 'FR', nat: 'IN', res: 'IN' });
    const ids = await rules(india);
    expect(ids).toContain('FR.study.eef-apply');          // India is an Études en France country
    expect(ids).toContain('FR.study.eef-confirmation');
    expect(ids).not.toContain('FR.study.direct-apply');
    expect(ids).toContain('FR.study.funds');
    const de = await rules(await newCase({ dest: 'DE', nat: 'PK', res: 'IN' }));
    expect(de).toContain('DE.study.mission-in');         // consulate follows residence, not nationality
    expect(de).not.toContain('DE.study.aps');             // APS is for Chinese, Indian and Vietnamese records

    const uzbek = await newCase({ dest: 'FR', nat: 'UZ', res: 'UZ' });
    const ids2 = await rules(uzbek);
    expect(ids2).toContain('FR.study.direct-apply');      // Uzbekistan is not
    expect(ids2).not.toContain('FR.study.eef-apply');
  });

  it('uses nationality flags: APS for India in Germany, §41 option for Americans', async () => {
    const india = await rules(await newCase({ dest: 'DE', nat: 'IN', res: 'IN' }));
    expect(india).toContain('DE.study.aps');
    expect(india).toContain('DE.study.visa');
    expect(india).not.toContain('DE.study.visa-or-in-germany');
    const us = await rules(await newCase({ dest: 'DE', nat: 'US', res: 'US' }));
    expect(us).not.toContain('DE.study.aps');
    expect(us).not.toContain('DE.study.visa');
    expect(us).toContain('DE.study.visa-or-in-germany');
  });

  it('short stays split visa-required and visa-exempt nationalities', async () => {
    const ng = await rules(await newCase({ dest: 'IT', visa: 'C', nat: 'NG', res: 'NG' }));
    expect(ng).toContain('IT.short_stay.insurance');
    expect(ng).not.toContain('IT.short_stay.passport-free');
    const br = await rules(await newCase({ dest: 'IT', visa: 'C', nat: 'BR', res: 'BR' }));
    expect(br).toContain('IT.short_stay.passport-free');
    expect(br).not.toContain('IT.short_stay.insurance');
  });

  it('gives EU/EEA citizens no checklist, and an unknown nationality only universal rules', async () => {
    expect(await rules(await newCase({ dest: 'FR', nat: 'SE', res: 'SE' }))).toEqual([]);
    const unknown = await rules(await newCase({ dest: 'DE', nat: null, res: null }));
    expect(unknown).toContain('DE.study.funds');
    expect(unknown).not.toContain('DE.study.aps');
    expect(unknown).not.toContain('DE.study.visa');      // targeted (notIn) rules need a known nationality
  });

  it('defaults the route from the visa type and lets other routes be chosen', async () => {
    const c = await newCase({ dest: 'DE', visa: 'D', route: 'work', nat: 'IN' });
    const [row] = await db.admin<{ route: string }>(`select route from cases where id = $1`, [c]);
    expect(row.route).toBe('work');
    expect(await rules(c)).toContain('DE.work.salary');
    const [ov] = await db.as(owner, (q) => q<{ route: string }>(`select route from case_overview where id = $1`, [c]));
    expect(ov.route).toBe('work');
  });

  it('lets the organisation\'s own template win, and respects the use_rulebook switch', async () => {
    const [t] = await db.as(owner, (q) => q<{ id: string }>(
      `insert into checklist_templates (org_id, name, destination, visa_type) values ($1, 'Our Spain list', 'ES', 'D') returning id`, [org]));
    await db.as(owner, (q) => q(`insert into checklist_template_items (org_id, template_id, label) values ($1, $2, 'Our own item')`, [org, t.id]));
    const own = await newCase({ dest: 'ES', nat: 'IN' });
    expect(await rules(own)).toEqual([null]);

    await db.as(owner, (q) => q(`update org_settings set use_rulebook = false where org_id = $1`, [org]));
    expect(await rules(await newCase({ dest: 'PL', nat: 'IN' }))).toEqual([]);
    await db.as(owner, (q) => q(`update org_settings set use_rulebook = true where org_id = $1`, [org]));
  });

  it('apply_rulebook adds missing rules idempotently and only for cases the caller can write', async () => {
    await db.as(owner, (q) => q(`update org_settings set use_rulebook = false where org_id = $1`, [org]));
    const c = await newCase({ dest: 'NL', nat: 'IN' });
    await db.as(owner, (q) => q(`update org_settings set use_rulebook = true where org_id = $1`, [org]));
    expect(await rules(c)).toEqual([]);
    const [a] = await db.as(owner, (q) => q<{ n: number }>(`select public.apply_rulebook($1) n`, [[c]]));
    expect(a.n).toBeGreaterThan(3);
    const [b] = await db.as(owner, (q) => q<{ n: number }>(`select public.apply_rulebook($1) n`, [[c]]));
    expect(b.n).toBe(0);
    await rejects(db.as(outsider, (q) => q(`select public.apply_rulebook($1)`, [[c]])), /forbidden/);
  });

  it('returns the key facts for a case', async () => {
    const c = await newCase({ dest: 'DE', nat: 'IN' });
    const facts = await db.as(owner, (q) => q<{ id: string; amount_eur: string | null }>(`select id, amount_eur from public.case_rule_facts($1)`, [c]));
    expect(facts.map((f) => f.id)).toContain('DE.study.funds');
    expect(Number(facts.find((f) => f.id === 'DE.study.funds')!.amount_eur)).toBe(992);
    expect(facts.map((f) => f.id)).toContain('DE.study.fee-visa');
    const us = await newCase({ dest: 'DE', nat: 'US' });
    const usFacts = await db.as(owner, (q) => q<{ id: string }>(`select id from public.case_rule_facts($1)`, [us]));
    expect(usFacts.map((f) => f.id)).not.toContain('DE.study.fee-visa');
    expect(await db.as(outsider, (q) => q(`select id from public.case_rule_facts($1)`, [c]))).toEqual([]);
  });
});

d('rule changes', () => {
  it('flags checklist items on open cases when a rule\'s content changes', async () => {
    const open = await newCase({ dest: 'SE', nat: 'IN' });
    const closed = await newCase({ dest: 'SE', nat: 'IN', stage: 'approved' });
    const edited: CompiledRulebook = {
      ...rb,
      requirements: rb.requirements.map((r) => (r.id === 'SE.study.funds' ? { ...r, label: 'Proof of funds: SEK 11,000 a month', content_hash: 'changed-hash' } : r)),
    };
    const rep = await sync(edited);
    expect(rep.requirementsChanged).toEqual(['SE.study.funds']);
    const items = await db.admin<{ case_id: string; rule_changed_at: string | null; rule_version: number }>(
      `select case_id, rule_changed_at from checklist_items where rule_id = 'SE.study.funds' and case_id = any ($1)`, [[open, closed]]);
    expect(items.find((i) => i.case_id === open)!.rule_changed_at).not.toBeNull();
    expect(items.find((i) => i.case_id === closed)!.rule_changed_at).toBeNull();
    const [v] = await db.admin<{ version: number }>(`select version from rulebook_requirements where id = 'SE.study.funds'`);
    expect(v.version).toBe(2);
    // staff can acknowledge the change
    await db.as(owner, (q) => q(`update checklist_items set rule_changed_at = null where case_id = $1 and rule_id = 'SE.study.funds'`, [open]));
    await sync(rb); // restore
  });

  it('notifies admins once per organisation and the assigned advisor per case', async () => {
    const c1 = await newCase({ dest: 'PT', nat: 'BR', assigned: advisor });
    const c2 = await newCase({ dest: 'PT', nat: 'IN', assigned: advisor });
    await newCase({ dest: 'PT', nat: 'IN', stage: 'refused' });
    await newCase({ org: otherOrg, user: outsider, dest: 'AT', nat: 'IN' });

    const withChange: CompiledRulebook = {
      ...rb,
      changes: [...rb.changes, {
        id: 'pt-test-change', effective_on: '2026-10-01', destinations: ['PT'], routes: ['study'], nat_in: null,
        summary: 'Portugal: test rule change', detail: null, severity: 'action', source_ids: ['b-prt'], requirement_ids: [],
      }],
    };
    const rep = await sync(withChange);
    expect(rep.changesPublished).toEqual([{ id: 'pt-test-change', notified: true }]);

    const ownerN = await db.admin<{ body: string; case_id: string | null }>(
      `select body, case_id from notifications where user_id = $1 and type = 'rule_changed'`, [owner]);
    expect(ownerN).toHaveLength(1);
    expect(ownerN[0].body).toMatch(/^2 open cases are affected/);
    expect(ownerN[0].case_id).toBeNull();
    const advN = await db.admin<{ case_id: string }>(`select case_id from notifications where user_id = $1 and type = 'rule_changed'`, [advisor]);
    expect(advN.map((n) => n.case_id).sort()).toEqual([c1, c2].sort());
    expect(await db.admin(`select 1 from notifications where user_id = $1 and type = 'rule_changed'`, [outsider])).toEqual([]);
    const ev = await db.admin<{ case_id: string }>(`select case_id from activity_events where type = 'rule_changed'`);
    expect(ev.map((e) => e.case_id).sort()).toEqual([c1, c2].sort());

    const affected = await db.as(owner, (q) => q<{ id: string }>(`select id from public.rule_change_cases('pt-test-change')`));
    expect(affected.map((a) => a.id).sort()).toEqual([c1, c2].sort());
    expect(await db.as(outsider, (q) => q(`select id from public.rule_change_cases('pt-test-change')`))).toEqual([]);
    const counts = await db.as(owner, (q) => q<{ change_id: string; open_cases: number }>(`select * from public.rule_change_counts($1)`, [org]));
    expect(counts.find((x) => x.change_id === 'pt-test-change')!.open_cases).toBe(2);
  });

  it('imports old changes as history without notifying anyone', async () => {
    const [n] = await db.admin<{ n: number }>(`select count(*)::int n from notifications where dedupe_key like 'rule:fr-funds-2026%'`);
    expect(n.n).toBe(0);
    const [ch] = await db.admin<{ notify: boolean }>(`select notify from rulebook_changes where id = 'fr-funds-2026'`);
    expect(ch.notify).toBe(false);
  });
});
