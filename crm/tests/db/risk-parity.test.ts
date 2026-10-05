import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeRisk, type RiskInput } from '@/lib/risk';
import { createTestDb, DB_URL, type TestDb } from './helpers';

let db: TestDb;
beforeAll(async () => { if (DB_URL) db = await createTestDb(); }, 120_000);
afterAll(async () => { if (db) await db.drop(); });

// Small deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
const STAGES = ['admitted', 'documents', 'appointment', 'submitted', 'decision_pending', 'approved', 'refused', 'withdrawn'];

describe.skipIf(!DB_URL)('risk: SQL and TypeScript implementations agree', () => {
  it('produces identical level, reason and numbers for 600 random cases', async () => {
    const r = rng(42);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const day = (offset: number) => new Date(Date.UTC(2026, 5, 1) + offset * 86_400_000).toISOString().slice(0, 10);
    for (let i = 0; i < 600; i++) {
      const total = pick([0, 0, 1, 3, 5, 7, 10, 13]);
      const input: RiskInput = {
        stage: pick(STAGES),
        startDate: r() < 0.1 ? null : day(Math.floor(r() * 260) - 40),
        appointmentDate: r() < 0.5 ? null : day(Math.floor(r() * 120) - 30),
        submittedAt: r() < 0.3 ? null : `${day(-Math.floor(r() * 60))}T${pick(['00:30', '12:00', '23:45'])}:00Z`,
        docsTotal: total,
        docsVerified: total === 0 ? 0 : Math.floor(r() * (total + 1)),
        processingDays: pick([0, 5, 15, 30, 45, 90]),
        appointmentWaitDays: pick([0, 3, 14, 30]),
        docPrepDays: pick([0, 7, 10, 21, 45]),
        highBufferDays: pick([-5, 0, 7]),
        mediumBufferDays: pick([7, 14, 30]),
        today: '2026-06-01',
      };
      if (input.mediumBufferDays < input.highBufferDays) continue;
      const [sql] = await db.admin<{ level: string | null; reason: string | null; days_to_start: number | null; est_days_needed: number | null; slack_days: number | null; docs_pct: number | null }>(
        `select * from private.risk_calc($1::case_stage,$2::date,$3::date,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11,$12::date)`,
        [input.stage, input.startDate, input.appointmentDate, input.submittedAt, input.docsTotal, input.docsVerified,
          input.processingDays, input.appointmentWaitDays, input.docPrepDays, input.highBufferDays, input.mediumBufferDays, input.today]);
      const ts = computeRisk(input);
      expect({ level: ts.level, reason: ts.reason, d: ts.daysToStart, n: ts.estDaysNeeded, s: ts.slackDays, p: ts.docsPct }, JSON.stringify(input))
        .toEqual({ level: sql.level, reason: sql.reason, d: sql.days_to_start, n: sql.est_days_needed, s: sql.slack_days, p: sql.docs_pct });
    }
  });
});
