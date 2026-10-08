import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, DB_URL, rejects, type TestDb } from './helpers';

const d = describe.skipIf(!DB_URL);
let db: TestDb;
let alice: string, bob: string, orgA: string;

interface Overview {
  generated_at: string;
  totals: Record<string, number>;
  weekly_signups: { week_start: string; organisations: number; users: number }[];
  organisations: { id: string; name: string; plan: string; members: number; applicants: number; cases: number; open_cases: number; approved: number; refused: number; last_activity_at: string | null }[];
}
const overview = async () => (await db.service((q) => q<{ r: Overview }>(`select public.platform_overview() r`)))[0].r;

beforeAll(async () => {
  if (!DB_URL) return;
  db = await createTestDb();
  alice = await db.user('alice@platform.test', 'Alice Secretname');
  bob = await db.user('bob@platform.test', 'Bob Secretname');
  orgA = await db.org(alice, 'Alpha University', 'premium');
  await db.org(bob, 'Beta Agency', 'free');
  await db.as(alice, (q) => q(
    `select public.import_rows($1, $2::jsonb)`,
    [orgA, JSON.stringify([
      { idx: 1, full_name: 'Hidden Applicant One', email: 'hidden1@x.test', nationality: 'IN', destination: 'FR', visa_type: 'D', stage: 'approved', decided_at: new Date().toISOString(), submitted_at: new Date().toISOString() },
      { idx: 2, full_name: 'Hidden Applicant Two', email: 'hidden2@x.test', nationality: 'NG', destination: 'DE', visa_type: 'D', stage: 'documents' },
    ])],
  ));
  // a case created by hand (not imported) is what produces activity; bulk imports deliberately do not
  await db.as(alice, (q) => q(
    `select public.create_applicant_with_case($1, $2::jsonb)`,
    [orgA, JSON.stringify({ full_name: 'Hidden Applicant Three', email: 'hidden3@x.test', nationality: 'GH', destination: 'ES', visa_type: 'C' })],
  ));
});
afterAll(async () => { if (db) await db.drop(); });

d('platform overview (product-owner view)', () => {
  it('summarises every organisation, with correct counts', async () => {
    const o = await overview();
    expect(o.totals).toMatchObject({ organisations: 2, premium_organisations: 1, free_organisations: 1, users: 2, applicants: 3, cases: 3, open_cases: 2, new_organisations_7d: 2, new_users_7d: 2 });
    const alpha = o.organisations.find((x) => x.name === 'Alpha University')!;
    expect(alpha).toMatchObject({ plan: 'premium', members: 1, applicants: 3, cases: 3, open_cases: 2, approved: 1, refused: 0 });
    expect(alpha.last_activity_at).toBeTruthy();
    const beta = o.organisations.find((x) => x.name === 'Beta Agency')!;
    expect(beta).toMatchObject({ plan: 'free', applicants: 0, cases: 0, last_activity_at: null });
    expect(o.weekly_signups).toHaveLength(12);
    expect(o.weekly_signups.at(-1)).toMatchObject({ organisations: 2, users: 2 }); // both created this week
  });

  it('contains no personal data', async () => {
    const text = JSON.stringify(await overview());
    for (const secret of ['Hidden Applicant', 'hidden1@x.test', 'hidden2@x.test', 'hidden3@x.test', 'Secretname', 'alice@platform.test', 'bob@platform.test', 'IN', 'FR']) {
      if (secret.length > 2) expect(text).not.toContain(secret);
    }
    const keys = new Set<string>();
    const walk = (v: unknown) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
    walk(JSON.parse(text));
    for (const forbidden of ['email', 'full_name', 'phone', 'notes', 'nationality']) expect(keys.has(forbidden)).toBe(false);
  });

  it('can be called by the service role only, never by customers', async () => {
    await rejects(db.as(alice, (q) => q(`select public.platform_overview()`)), /permission denied/i);
    await rejects(db.as(bob, (q) => q(`select public.platform_overview()`)), /permission denied/i);
    await rejects(db.anon((q) => q(`select public.platform_overview()`)), /permission denied/i);
    const [p] = await db.admin<{ authed: boolean; anon: boolean; service: boolean }>(
      `select has_function_privilege('authenticated','public.platform_overview()','execute') authed,
              has_function_privilege('anon','public.platform_overview()','execute') anon,
              has_function_privilege('service_role','public.platform_overview()','execute') service`);
    expect(p).toEqual({ authed: false, anon: false, service: true });
  });

  it('is read-only', async () => {
    const before = (await db.admin<{ n: string }>(`select (select count(*) from organizations)::text || '/' || (select count(*) from cases)::text n`))[0].n;
    await overview();
    expect((await db.admin<{ n: string }>(`select (select count(*) from organizations)::text || '/' || (select count(*) from cases)::text n`))[0].n).toBe(before);
    const [f] = await db.admin<{ volatility: string }>(`select provolatile::text volatility from pg_proc where proname = 'platform_overview'`);
    expect(f.volatility).toBe('s'); // declared STABLE: the database itself refuses writes inside it
  });
});
