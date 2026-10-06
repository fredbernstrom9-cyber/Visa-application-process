import { describe, expect, it } from 'vitest';
import { ALL_SOURCES, buildRulebook, GUIDES } from '../../rulebook';
import { compileRulebook } from '../../rulebook/compile';
import { EEF_RESIDENCE } from '../../rulebook/guides/fr';
import { SCHENGEN } from '../../rulebook/guides/schengen-short-stay';
import { flagsFor } from '../../rulebook/nationalities';
import { SOURCES } from '../../rulebook/sources';
import type { Guide } from '../../rulebook/types';
import { COUNTRY_CODES } from '../../src/lib/countries';

const TODAY = '2026-10-06';
const EU27 = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

describe('rulebook', () => {
  const rb = buildRulebook(TODAY);

  it('compiles without a single validation problem', () => {
    expect(rb.guides.length).toBeGreaterThan(100);
    expect(rb.requirements.length).toBeGreaterThan(1000);
  });

  it('has a full study guide for every EU state and a short-stay guide for every Schengen state', () => {
    for (const cc of EU27) {
      const g = rb.guides.find((x) => x.id === `${cc}.study`);
      expect(g, cc).toBeDefined();
      expect(g!.level, cc).toBe('full');
    }
    expect(SCHENGEN).toHaveLength(29);
    for (const cc of SCHENGEN) expect(rb.guides.find((x) => x.id === `${cc}.short_stay`), cc).toBeDefined();
  });

  it('cites only known sources, and every "official" item has an official source', () => {
    for (const r of [...rb.requirements, ...rb.facts]) {
      for (const s of r.source_ids) expect(ALL_SOURCES[s], `${r.id} → ${s}`).toBeDefined();
      if (r.confidence === 'official') expect(r.source_ids.some((s) => ALL_SOURCES[s].kind === 'official'), r.id).toBe(true);
    }
  });

  it('gives every rule a stable, unique id and a content hash', () => {
    const ids = rb.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rb.requirements.every((r) => /^[0-9a-f]{32}$/.test(r.content_hash))).toBe(true);
    expect(buildRulebook(TODAY).version).toBe(rb.version); // deterministic
  });

  it('knows who needs which visa', () => {
    expect(flagsFor('US')).not.toContain('schengen_visa');
    expect(flagsFor('IN')).toEqual(expect.arrayContaining(['schengen_visa', 'ireland_visa', 'aps']));
    expect(flagsFor('GB')).toEqual(expect.arrayContaining(['cta', 'de41', 'mvv_exempt']));
    expect(flagsFor('GE')).not.toContain('schengen_visa');       // still visa-free for ordinary passports
    expect(flagsFor('NI')).toContain('ireland_visa');            // S.I. 242/2026, from 15 June 2026
    expect(flagsFor('ZA')).toContain('ireland_visa');
    expect(flagsFor('UA')).not.toContain('ireland_visa');
    expect(flagsFor('BR')).toContain('de41_no_work');
    expect(flagsFor('SE')).toEqual(['eea']);
    expect(flagsFor('GP')).toEqual(['eea']);                     // Guadeloupe: French citizens
    expect(flagsFor('PR')).toEqual(flagsFor('US'));
  });

  it('adds consulate-specific steps by country of residence', () => {
    const r = rb.requirements.find((x) => x.id === 'DE.study.mission-in');
    expect(r?.residence_in).toEqual(['IN']);
    expect(ALL_SOURCES[r!.source_ids[0]].url).toMatch(/^https:\/\/india\.diplo\.de\//);
  });

  it('uses the 75-country Études en France list (including Pakistan and Bangladesh)', () => {
    expect(EEF_RESIDENCE).toHaveLength(75);
    expect(new Set(EEF_RESIDENCE).size).toBe(75);
    expect(EEF_RESIDENCE).toEqual(expect.arrayContaining(['PK', 'BD', 'IN', 'US', 'GB']));
    expect(EEF_RESIDENCE).not.toContain('UZ');
  });

  it('rejects a rulebook with problems', () => {
    const base = { verifiedOn: TODAY, sources: SOURCES, nationalities: [], changes: [], validCodes: COUNTRY_CODES, today: TODAY };
    const g = (patch: Partial<Guide>): Guide => ({ ...GUIDES[0], ...patch });
    const bad = (guides: Guide[]) => () => compileRulebook({ ...base, guides });
    const rule = GUIDES[0].rules[0];
    expect(bad([g({ rules: [{ ...rule, sources: ['no-such-source'] }] })])).toThrow(/unknown source "no-such-source"/);
    expect(bad([g({ rules: [{ ...rule, sources: ['fragomen-etias'], conf: 'official' }] })])).toThrow(/cites no official source/);
    expect(bad([g({ rules: [{ ...rule, conf: 'multi', sources: ['fr-cvec'] }] })])).toThrow(/fewer than two sources/);
    expect(bad([g({ lastChecked: '2099-01-01' })])).toThrow(/in the future/);
    expect(bad([g({ rules: [rule, rule] })])).toThrow(/duplicate key/);
    expect(bad([g({ rules: [{ ...rule, for: { in: ['ZZ'] } }] })])).toThrow(/unknown country code ZZ/);
    expect(bad([GUIDES[0], GUIDES[0]])).toThrow(/defined twice/);
  });
});
