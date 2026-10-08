import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeRisk, DEFAULT_RISK_SETTINGS, type RiskInput } from '@/lib/risk';
import { canUse, hasRoomFor, limitFor, PLAN_FEATURES, PLAN_LIMITS } from '@/lib/plans';
import { countActiveFilters, filtersToParams, parseFilters, toRpcFilters } from '@/lib/filters';
import { countryName, matchCountry, DESTINATIONS } from '@/lib/countries';
import { docsPercent } from '@/lib/format';

const base: RiskInput = { ...DEFAULT_RISK_SETTINGS, stage: 'documents', startDate: null, appointmentDate: null, submittedAt: null, docsTotal: 0, docsVerified: 0, today: '2026-06-01' };

describe('risk (TypeScript mirror)', () => {
  it('reproduces the spec example', () => {
    const r = computeRisk({ ...base, startDate: '2026-06-22', docsTotal: 5, docsVerified: 2 });
    expect(r.level).toBe('high');
    expect(r.reason).toBe('Starts in 21d · no appointment · 40% docs verified · needs ~44d');
  });
  it('is low when there is plenty of slack and closed cases are unscored', () => {
    expect(computeRisk({ ...base, startDate: '2027-01-01', docsTotal: 3, docsVerified: 3, appointmentDate: '2026-06-05' }).level).toBe('low');
    expect(computeRisk({ ...base, stage: 'approved', startDate: '2026-07-01' }).level).toBeNull();
    expect(computeRisk({ ...base }).reason).toBe('No start date set');
  });
  it('avoids floating point drift in document preparation time', () => {
    // 10 days prep, 30% verified -> exactly 7 days left (floats would give 7.000000000000001 -> 8)
    const r = computeRisk({ ...base, startDate: '2026-12-01', docPrepDays: 10, appointmentWaitDays: 0, docsTotal: 10, docsVerified: 3 });
    expect(r.estDaysNeeded).toBe(7 + 30);
  });
});

describe('plans', () => {
  it('Free: 1 user, 10 applicants and no premium features', () => {
    const free = { plan: 'free' };
    expect(limitFor(free, 'seats')).toBe(1);
    expect(limitFor(free, 'applicants')).toBe(10);
    for (const f of PLAN_FEATURES.premium) expect(canUse(free, f)).toBe(false);
    expect(hasRoomFor(free, 'applicants', 9)).toBe(true);
    expect(hasRoomFor(free, 'applicants', 10)).toBe(false);
  });
  it('Premium: unlimited and everything on; unknown plans fall back to Free', () => {
    const p = { plan: 'premium' };
    expect(limitFor(p, 'seats')).toBeNull();
    expect(hasRoomFor(p, 'applicants', 1_000_000)).toBe(true);
    for (const f of ['analytics', 'live_tracking', 'import', 'export', 'portal', 'reports'] as const) expect(canUse(p, f)).toBe(true);
    expect(canUse({ plan: 'enterprise' }, 'analytics')).toBe(false);
  });
  it('matches the plan tables seeded by the migrations', () => {
    const sql = readFileSync(path.join(__dirname, '../../supabase/migrations/20261005000001_core.sql'), 'utf8');
    const limits = [...sql.matchAll(/\('(\w+)', (\w+), (\w+)\)/g)].filter((m) => ['free', 'premium'].includes(m[1]) && /^(\d+|null)$/.test(m[2]));
    const parsed = Object.fromEntries(limits.map((m) => [m[1], { seats: m[2] === 'null' ? null : +m[2], applicants: m[3] === 'null' ? null : +m[3] }]));
    expect(parsed).toEqual(PLAN_LIMITS);
    const feats = [...sql.matchAll(/\('premium', '(\w+)'\)/g)].map((m) => m[1]).sort();
    expect(feats).toEqual([...PLAN_FEATURES.premium].sort());
  });
});

describe('filters', () => {
  it('round-trips through URL params and the RPC payload', () => {
    const f = parseFilters(new URLSearchParams('destination=FR,DE&risk=high&opened_from=2026-01-01&reached_min=4&open=1&bogus=1'));
    expect(f).toEqual({ destination: ['FR', 'DE'], risk: ['high'], opened_from: '2026-01-01', reached_min: 4, open: true });
    expect(filtersToParams(f).toString()).toBe('destination=FR%2CDE&risk=high&opened_from=2026-01-01&reached_min=4&open=1');
    expect(toRpcFilters(f)).toEqual({ destination: ['FR', 'DE'], risk: ['high'], opened_from: '2026-01-01', reached_min: 4, open: 'true' });
    expect(countActiveFilters(f)).toBe(5);
  });
  it('ignores malformed values', () => {
    expect(parseFilters(new URLSearchParams('opened_from=yesterday&reached_min=abc'))).toEqual({});
    expect(parseFilters({ stage: ['approved'] })).toEqual({ stage: ['approved'] });
  });
});

describe('countries', () => {
  it('resolves names, codes, aliases and demonyms', () => {
    expect(matchCountry('India')).toBe('IN');
    expect(matchCountry('in')).toBe('IN');
    expect(matchCountry('Türkiye')).toBe('TR');
    expect(matchCountry('Turkey')).toBe('TR');
    expect(matchCountry('UK')).toBe('GB');
    expect(matchCountry('Nigerian')).toBe('NG');
    expect(matchCountry('Czech Republic')).toBe('CZ');
    expect(matchCountry('Atlantis')).toBeNull();
    expect(countryName('DE')).toBe('Germany');
  });
  it('lists EU + Schengen destinations (31) and flags the two non-Schengen EU states', () => {
    expect(DESTINATIONS).toHaveLength(31);
    expect(DESTINATIONS.filter((d) => !d.schengen).map((d) => d.code).sort()).toEqual(['CY', 'IE']);
  });
});

describe('docsPercent', () => {
  it('uses the database value when present', () => {
    expect(docsPercent({ docs_pct: 40, docs_total: 5, docs_verified: 2 })).toBe(40);
    expect(docsPercent({ docs_pct: 0, docs_total: 5, docs_verified: 0 })).toBe(0);
  });
  it('falls back to the counters for decided cases (no risk score, no percentage)', () => {
    expect(docsPercent({ docs_pct: null, docs_total: 7, docs_verified: 7 })).toBe(100);
    expect(docsPercent({ docs_pct: null, docs_total: 6, docs_verified: 4 })).toBe(67);
  });
  it('is empty when there is no checklist at all', () => {
    expect(docsPercent({ docs_pct: null, docs_total: 0, docs_verified: 0 })).toBeNull();
  });
});
