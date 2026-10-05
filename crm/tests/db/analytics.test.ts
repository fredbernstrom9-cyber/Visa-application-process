import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, DB_URL, rejects, type TestDb } from './helpers';

const d = describe.skipIf(!DB_URL);
let db: TestDb;
let owner: string, advisor: string, org: string;

const day = async (offset: number) => (await db.admin<{ d: string }>(`select (current_date + $1::int)::text d`, [offset]))[0].d;
const ts = async (offset: number) => `${await day(offset)}T12:00:00Z`;

async function rpc<T = unknown>(fn: string, filters: Record<string, unknown> = {}, extra: unknown[] = [], as = owner): Promise<T> {
  const params = [org, JSON.stringify(filters), ...extra];
  const placeholders = params.map((_, i) => `$${i + 1}`).join(',');
  const rows = await db.as(as, (q) => q(`select * from public.${fn}(${placeholders.replace('$2', '$2::jsonb')})`, params));
  return rows as T;
}

beforeAll(async () => {
  if (!DB_URL) return;
  db = await createTestDb();
  owner = await db.user('o@an.test', 'Olga');
  advisor = await db.user('a@an.test', 'Pia');
  org = await db.org(owner, 'Analytics Org', 'premium');
  await db.addMember(org, advisor, 'advisor');

  const rows = [
    // decided history
    { idx: 1, full_name: 'C1', email: 'c1@a.t', nationality: 'IN', destination: 'FR', visa_type: 'D', intake: '2026-09', stage: 'approved', assigned_to: advisor,
      opened_on: await day(-100), submitted_at: await ts(-60), decided_at: await ts(-30), start_date: await day(-20) },
    { idx: 2, full_name: 'C2', email: 'c2@a.t', nationality: 'IN', destination: 'FR', visa_type: 'D', intake: '2026-09', stage: 'refused', assigned_to: advisor,
      opened_on: await day(-90), submitted_at: await ts(-50), decided_at: await ts(-20), start_date: await day(-20) },
    { idx: 3, full_name: 'C3', email: 'c3@a.t', nationality: 'NG', destination: 'DE', visa_type: 'D', intake: '2026-01', stage: 'approved',
      opened_on: await day(-80), submitted_at: await ts(-40), decided_at: await ts(-10), start_date: await day(-5) },
    // open
    { idx: 4, full_name: 'C4', email: 'c4@a.t', nationality: 'NG', destination: 'DE', visa_type: 'D', intake: '2026-09', stage: 'documents', assigned_to: advisor, start_date: await day(20), opened_on: await day(-5) },
    { idx: 5, full_name: 'C5', email: 'c5@a.t', nationality: 'IN', destination: 'FR', visa_type: 'C', stage: 'submitted', submitted_at: await ts(-5), start_date: await day(10), opened_on: await day(-30) },
    { idx: 6, full_name: 'C6', email: 'c6@a.t', nationality: 'US', destination: 'ES', visa_type: 'C', stage: 'admitted', start_date: await day(200), opened_on: await day(-2) },
  ];
  const [res] = await db.as(owner, (q) => q<{ r: { cases_created: number; errors: unknown[] } }>(`select public.import_rows($1,$2::jsonb) r`, [org, JSON.stringify(rows)]));
  if (res.r.cases_created !== 6) throw new Error('fixture failed: ' + JSON.stringify(res.r.errors));
}, 120_000);

afterAll(async () => { if (db) await db.drop(); });

d('analytics functions', () => {
  it('KPIs for all cases', async () => {
    const [{ analytics_kpis: k }] = await rpc<{ analytics_kpis: { current: Record<string, number | null>; previous: unknown } }[]>('analytics_kpis');
    expect(k.current).toMatchObject({
      total: 6, active: 3, approved: 2, refused: 1, acceptance_rate: 66.7, high_risk: 2,
      median_admission_to_decision_days: 70, median_submission_to_decision_days: 30,
    });
    expect(k.previous).toBeNull(); // no date range -> no comparison
  });

  it('compares with the previous period when a date range is set', async () => {
    const from = await day(-95);
    const to = await day(0);
    const [{ analytics_kpis: k }] = await rpc<{ analytics_kpis: { current: Record<string, number>; previous: Record<string, number> } }[]>('analytics_kpis', { opened_from: from, opened_to: to });
    // cases opened in the last 96 days: everything except C1 (100d ago)
    expect(k.current.total).toBe(5);
    expect(k.previous.total).toBe(1); // C1 sits in the preceding window
    expect(k.previous.approved).toBe(1);
  });

  it('honours dimension filters', async () => {
    const [{ analytics_kpis: k }] = await rpc<{ analytics_kpis: { current: Record<string, number> } }[]>('analytics_kpis', { destination: ['FR'], visa_type: ['D'] });
    expect(k.current).toMatchObject({ total: 2, approved: 1, refused: 1, acceptance_rate: 50 });
    const [{ analytics_kpis: k2 }] = await rpc<{ analytics_kpis: { current: Record<string, number> } }[]>('analytics_kpis', { risk: ['high'] });
    expect(k2.current.total).toBe(2);
    const [{ analytics_kpis: k3 }] = await rpc<{ analytics_kpis: { current: Record<string, number> } }[]>('analytics_kpis', { nationality: ['NG'], intake: ['2026-09'] });
    expect(k3.current.total).toBe(1);
  });

  it('funnel counts how far cases got', async () => {
    const rows = await rpc<{ step: string; ord: number; reached: string }[]>('analytics_funnel');
    expect(rows.map((r) => [r.step, Number(r.reached)])).toEqual([
      ['admitted', 6], ['documents', 5], ['appointment', 4], ['submitted', 4], ['decision_pending', 3], ['decided', 3], ['approved', 2],
    ]);
  });

  it('weekly throughput covers every submission and decision', async () => {
    const rows = await rpc<{ week: string; submissions: string; approvals: string; refusals: string }[]>('analytics_throughput');
    const sum = (k: 'submissions' | 'approvals' | 'refusals') => rows.reduce((a, r) => a + Number(r[k]), 0);
    expect(sum('submissions')).toBe(4);
    expect(sum('approvals')).toBe(2);
    expect(sum('refusals')).toBe(1);
    expect(rows.length).toBeGreaterThan(5);
    // weeks are contiguous
    for (let i = 1; i < rows.length; i++) {
      const gap = (Date.parse(String(rows[i].week)) - Date.parse(String(rows[i - 1].week))) / 86_400_000;
      expect(gap).toBe(7);
    }
  });

  it('acceptance by destination and nationality includes sample sizes', async () => {
    const dest = await rpc<{ key: string; decided: string; approved: string; refused: string; rate: string }[]>('analytics_acceptance', {}, ['destination']);
    expect(dest.map((r) => [r.key, Number(r.decided), Number(r.approved), Number(r.rate)])).toEqual([['FR', 2, 1, 50], ['DE', 1, 1, 100]]);
    const nat = await rpc<{ key: string; decided: string; rate: string }[]>('analytics_acceptance', {}, ['nationality']);
    expect(nat.map((r) => [r.key, Number(r.decided)])).toEqual([['IN', 2], ['NG', 1]]);
    await rejects(db.as(owner, (q) => q(`select * from public.analytics_acceptance($1,'{}','email')`, [org])), /invalid_dimension/);
  });

  it('stage times use real stage history', async () => {
    const [c] = await db.admin<{ id: string }>(`select c.id from cases c join applicants a on a.id = c.applicant_id where a.full_name = 'C4'`);
    await db.as(owner, (q) => q(`update cases set stage = 'appointment' where id = $1`, [c.id]));
    // the case sat in 'documents' (its imported stage) for 10 days before moving on
    await db.admin(`update case_stage_history set entered_at = now() - interval '10 days' where case_id = $1 and stage = 'documents'`, [c.id]);
    await db.admin(`update case_stage_history set exited_at = now() where case_id = $1 and stage = 'documents'`, [c.id]);
    const rows = await rpc<{ stage: string; ord: number; finished: string; avg_days: string | null; median_days: string | null; open_now: string }[]>('analytics_stage_times');
    expect(rows.map((r) => r.stage)).toEqual(['admitted', 'documents', 'appointment', 'submitted', 'decision_pending']);
    const docs = rows[1];
    expect(Number(docs.finished)).toBe(1);
    expect(Number(docs.avg_days)).toBeCloseTo(10, 0);
    expect(Number(docs.median_days)).toBeCloseTo(10, 0);
    expect(Number(rows[2].open_now)).toBe(1);
    expect(Number(rows[3].open_now)).toBe(1); // C5 is still 'submitted'
    await db.as(owner, (q) => q(`update cases set stage = 'documents' where id = $1`, [c.id]));
  });

  it('start-date horizon lists open cases only, nearest first, with risk', async () => {
    const rows = await rpc<{ full_name: string; days_to_start: number; risk_level: string | null; docs_pct: number }[]>('analytics_horizon');
    expect(rows.map((r) => r.full_name)).toEqual(['C5', 'C4', 'C6']);
    expect(rows[0].days_to_start).toBe(10);
    expect(rows[0].risk_level).toBe('high');
    expect(rows[2].risk_level).toBe('low');
  });

  it('cohort progression is observed only for dates in the past', async () => {
    const rows = await rpc<{ intake: string; weeks_before: number; total: string; documents_plus: string; submitted_plus: string; decided_plus: string }[]>('analytics_cohorts', { intake: ['2026-09'] });
    expect(new Set(rows.map((r) => r.intake))).toEqual(new Set(['2026-09']));
    const w0 = rows.find((r) => r.weeks_before === 0)!;
    // C1 and C2 started 20 days ago and were decided before then; C4 starts in the future (not observable)
    expect(Number(w0.total)).toBe(2);
    expect(Number(w0.decided_plus)).toBe(2);
    const w8 = rows.find((r) => r.weeks_before === 8)!;
    expect(Number(w8.submitted_plus)).toBe(0);
    expect(rows.every((r) => Number(r.total) <= 3)).toBe(true);
  });

  it('advisor workload and performance', async () => {
    await db.as(owner, (q) => q(`insert into tasks (org_id, case_id, title, assignee_id, due_date) select $1, id, 'late', $2, current_date - 3 from cases where org_id = $1 limit 1`, [org, advisor]));
    const rows = await rpc<{ advisor_name: string | null; open_cases: string; high_risk: string; overdue_tasks: string; decided: string; approved: string; acceptance_rate: string | null }[]>('analytics_advisors');
    const pia = rows.find((r) => r.advisor_name === 'Pia')!;
    expect(Number(pia.open_cases)).toBe(1);
    expect(Number(pia.decided)).toBe(2);
    expect(Number(pia.approved)).toBe(1);
    expect(Number(pia.acceptance_rate)).toBe(50);
    expect(Number(pia.overdue_tasks)).toBe(1);
    const unassigned = rows.find((r) => r.advisor_name === null)!;
    expect(Number(unassigned.open_cases)).toBe(2);
  });

  it('advisors only ever see analytics for their own cases', async () => {
    const [{ analytics_kpis: k }] = await rpc<{ analytics_kpis: { current: Record<string, number> } }[]>('analytics_kpis', {}, [], advisor);
    expect(k.current.total).toBe(3); // C1, C2, C4
    const funnel = await rpc<{ reached: string }[]>('analytics_funnel', {}, [], advisor);
    expect(Number(funnel[0].reached)).toBe(3);
  });

  it('filter_options and filtered_cases support drill-down parameters', async () => {
    const [{ o }] = await db.as(owner, (q) => q<{ o: { intakes: string[]; destinations: string[]; nationalities: string[] } }>(`select public.filter_options($1) o`, [org]));
    expect(o.intakes).toEqual(['2026-01', '2026-09']);
    expect(o.destinations).toEqual(['DE', 'ES', 'FR']);
    const reached = await db.as(owner, (q) => q(`select id from public.filtered_cases($1, '{"reached_min": 4}')`, [org]));
    expect(reached).toHaveLength(4);
    const since = await day(-25);
    const decidedFr = await db.as(owner, (q) => q(`select id from public.filtered_cases($1, $2::jsonb)`, [org, JSON.stringify({ decided: 'true', destination: ['FR'], decided_from: since })]));
    expect(decidedFr).toHaveLength(1);
    const unassigned = await db.as(owner, (q) => q(`select id from public.filtered_cases($1, '{"advisor":["unassigned"]}')`, [org]));
    expect(unassigned).toHaveLength(3);
    const tagless = await db.as(owner, (q) => q(`select id from public.filtered_cases($1, '{"risk":["none"]}')`, [org]));
    expect(tagless).toHaveLength(3); // the three decided cases are unscored
  });
});
