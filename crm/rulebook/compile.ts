// Turns the authored rulebook into database rows and checks it on the way.
// Any problem throws: a rulebook that does not validate is never synced.
import { createHash } from 'node:crypto';
import type { Change, Fact, Flag, Guide, Iso2, Nationality, Route, Rule, Source, Target } from './types';

export interface RequirementRow {
  id: string; guide_id: string; kind: Rule['kind']; label: string; detail: string | null; required: boolean;
  due_days_before_start: number | null; sort_order: number;
  nat_in: Iso2[] | null; nat_not_in: Iso2[]; residence_in: Iso2[] | null; residence_not_in: Iso2[];
  confidence: Rule['conf']; source_ids: string[]; last_checked: string; content_hash: string;
}
export interface FactRow {
  id: string; guide_id: string; kind: Fact['kind']; label: string; value: string; amount_eur: number | null; sort_order: number;
  nat_in: Iso2[] | null; nat_not_in: Iso2[]; residence_in: Iso2[] | null; residence_not_in: Iso2[];
  confidence: Fact['conf']; source_ids: string[]; last_checked: string; content_hash: string;
}
export interface GuideRow {
  id: string; destination: Iso2; route: Route; level: Guide['level']; title: string; summary: string;
  permit: string | null; links: { label: string; url: string }[]; last_checked: string;
}
export interface ChangeRow {
  id: string; effective_on: string; destinations: Iso2[]; routes: Route[] | null; nat_in: Iso2[] | null;
  summary: string; detail: string | null; severity: Change['severity']; source_ids: string[]; requirement_ids: string[];
}
export interface SourceRow { id: string; kind: Source['kind']; publisher: string; published: string; title: string; url: string }
export interface NationalityRow { code: Iso2; name: string; schengen_visa: boolean; ireland_visa: boolean; flags: Flag[]; coverage: Nationality['coverage'] }

export interface CompiledRulebook {
  version: string;
  verifiedOn: string;
  sources: SourceRow[];
  nationalities: NationalityRow[];
  guides: GuideRow[];
  requirements: RequirementRow[];
  facts: FactRow[];
  changes: ChangeRow[];
}

export interface RulebookInput {
  verifiedOn: string;
  sources: Record<string, Source>;
  nationalities: Nationality[];
  guides: Guide[];
  changes: Change[];
  /** Every code the CRM accepts (used to validate targets). */
  validCodes: readonly Iso2[];
  /** Today's date (YYYY-MM-DD), so tests are deterministic. */
  today: string;
}

const ROUTES: readonly Route[] = ['study', 'short_stay', 'work', 'research', 'traineeship', 'family'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z0-9][a-z0-9_.-]*$/;

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32);
const sortUniq = (a: Iso2[]) => [...new Set(a)].sort();

export function compileRulebook(input: RulebookInput): CompiledRulebook {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const valid = new Set(input.validCodes);
  const sourceIds = new Set(Object.keys(input.sources));

  // ---- sources
  for (const [id, s] of Object.entries(input.sources)) {
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(id)) err(`source id "${id}" is not a valid id`);
    if (!s.url.startsWith('https://')) err(`source ${id}: URL must use https`);
    if (!s.title.trim() || !s.publisher.trim()) err(`source ${id}: title and publisher are required`);
  }

  // ---- nationalities
  const byFlag = new Map<Flag, Iso2[]>();
  for (const n of input.nationalities) {
    if (!valid.has(n.code)) err(`nationality ${n.code} is not a valid code`);
    for (const f of n.flags) byFlag.set(f, [...(byFlag.get(f) ?? []), n.code]);
  }
  const codesWith = (f: Flag) => byFlag.get(f) ?? [];

  const resolve = (t: Target | undefined, where: string) => {
    let natIn: Iso2[] | null = null;
    let natNotIn: Iso2[] = [];
    const residenceIn = t?.residenceIn ? sortUniq(t.residenceIn) : null;
    const residenceNotIn = sortUniq(t?.residenceNotIn ?? []);
    if (t?.flag) natIn = codesWith(t.flag);
    if (t?.in) natIn = natIn ? natIn.filter((c) => t.in!.includes(c)) : [...t.in];
    if (t?.notFlag) natNotIn = natNotIn.concat(codesWith(t.notFlag));
    if (t?.notIn) natNotIn = natNotIn.concat(t.notIn);
    for (const c of [...(t?.in ?? []), ...(t?.notIn ?? []), ...(t?.residenceIn ?? []), ...residenceNotIn]) {
      if (!valid.has(c)) err(`${where}: unknown country code ${c}`);
    }
    if (natIn && natIn.length === 0) err(`${where}: targets no nationality at all`);
    if (residenceIn && residenceIn.length === 0) err(`${where}: residenceIn is empty`);
    if (natIn) natIn = sortUniq(natIn.filter((c) => !natNotIn.includes(c)));
    return { nat_in: natIn, nat_not_in: sortUniq(natNotIn), residence_in: residenceIn, residence_not_in: residenceNotIn };
  };

  const checkCitations = (ids: string[], conf: Rule['conf'], where: string) => {
    if (ids.length === 0) err(`${where}: cites no source`);
    for (const id of ids) if (!sourceIds.has(id)) err(`${where}: unknown source "${id}"`);
    if (conf === 'official' && !ids.some((id) => input.sources[id]?.kind === 'official')) {
      err(`${where}: marked "official" but cites no official source`);
    }
    if (conf === 'multi' && new Set(ids).size < 2) err(`${where}: marked "multi" but cites fewer than two sources`);
  };

  const checkDate = (d: string, where: string) => {
    if (!DATE.test(d) || Number.isNaN(Date.parse(d))) err(`${where}: "${d}" is not a YYYY-MM-DD date`);
    else if (d > input.today) err(`${where}: date ${d} is in the future`);
  };

  // ---- guides, requirements, facts
  const guides: GuideRow[] = [];
  const requirements: RequirementRow[] = [];
  const facts: FactRow[] = [];
  const guideIds = new Set<string>();
  const ruleIds = new Set<string>();

  for (const g of input.guides) {
    const gid = `${g.destination}.${g.route}`;
    if (guideIds.has(gid)) err(`guide ${gid} is defined twice`);
    guideIds.add(gid);
    if (!valid.has(g.destination)) err(`guide ${gid}: unknown destination`);
    if (!ROUTES.includes(g.route)) err(`guide ${gid}: unknown route`);
    checkDate(g.lastChecked, `guide ${gid}`);
    if (g.summary.length > 2000) err(`guide ${gid}: summary too long`);
    for (const l of g.links) if (!l.url.startsWith('https://')) err(`guide ${gid}: link "${l.label}" must use https`);
    if (g.level === 'full' && g.rules.filter((r) => r.kind === 'document').length === 0) err(`guide ${gid}: a full guide needs documents`);

    guides.push({
      id: gid, destination: g.destination, route: g.route, level: g.level, title: g.title, summary: g.summary,
      permit: g.permit ?? null, links: g.links, last_checked: g.lastChecked,
    });

    const keys = new Set<string>();
    g.rules.forEach((r, i) => {
      const id = `${gid}.${r.key}`;
      const where = `rule ${id}`;
      if (!KEY.test(r.key)) err(`${where}: key must be lowercase letters, digits, "_", "-" or "."`);
      if (keys.has(r.key)) err(`${where}: duplicate key`);
      keys.add(r.key);
      ruleIds.add(id);
      if (!r.label.trim() || r.label.length > 200) err(`${where}: label must be 1–200 characters`);
      if (r.detail && r.detail.length > 2000) err(`${where}: detail is over 2,000 characters`);
      if (r.dueDaysBeforeStart != null && (r.dueDaysBeforeStart < 0 || r.dueDaysBeforeStart > 730)) err(`${where}: dueDaysBeforeStart out of range`);
      checkCitations(r.sources, r.conf, where);
      const target = resolve(r.for, where);
      const row = {
        id, guide_id: gid, kind: r.kind, label: r.label.trim(), detail: r.detail?.trim() || null,
        // Steps done after arrival (no due date) are shown but do not count toward documents verified / risk.
        required: !r.optional && !(r.kind === 'step' && r.dueDaysBeforeStart == null),
        due_days_before_start: r.dueDaysBeforeStart ?? null, sort_order: (i + 1) * 10, ...target,
        confidence: r.conf, source_ids: r.sources, last_checked: g.lastChecked,
      };
      const { last_checked: _lc, sort_order: _so, ...content } = row;
      requirements.push({ ...row, content_hash: hash(content) });
    });

    const factKeys = new Set<string>();
    g.facts.forEach((f, i) => {
      const id = `${gid}.${f.key}`;
      const where = `fact ${id}`;
      if (!KEY.test(f.key)) err(`${where}: invalid key`);
      if (factKeys.has(f.key)) err(`${where}: duplicate key`);
      factKeys.add(f.key);
      if (f.label.length > 200 || f.value.length > 1000) err(`${where}: label or value too long`);
      if (f.amountEur != null && !(f.amountEur >= 0)) err(`${where}: amountEur must be a positive number`);
      checkCitations(f.sources, f.conf, where);
      const target = resolve(f.for, where);
      const row = {
        id, guide_id: gid, kind: f.kind, label: f.label, value: f.value,
        amount_eur: f.amountEur == null ? null : Math.round(f.amountEur * 100) / 100,
        sort_order: (i + 1) * 10, ...target, confidence: f.conf, source_ids: f.sources, last_checked: g.lastChecked,
      };
      const { last_checked: _lc, sort_order: _so, ...content } = row;
      facts.push({ ...row, content_hash: hash(content) });
    });
  }

  // ---- changes
  const changes: ChangeRow[] = [];
  const changeIds = new Set<string>();
  for (const c of input.changes) {
    const where = `change ${c.id}`;
    if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(c.id)) err(`${where}: invalid id`);
    if (changeIds.has(c.id)) err(`${where}: duplicate id`);
    changeIds.add(c.id);
    checkDate(c.effectiveOn, where);
    if (!c.summary.trim() || c.summary.length > 300) err(`${where}: summary must be 1–300 characters`);
    for (const d of c.destinations) if (!valid.has(d)) err(`${where}: unknown destination ${d}`);
    for (const r of c.routes ?? []) if (!ROUTES.includes(r)) err(`${where}: unknown route ${r}`);
    for (const r of c.rules ?? []) if (!ruleIds.has(r)) err(`${where}: refers to unknown rule ${r}`);
    for (const id of c.sources) if (!sourceIds.has(id)) err(`${where}: unknown source "${id}"`);
    if (c.sources.length === 0) err(`${where}: cites no source`);
    changes.push({
      id: c.id, effective_on: c.effectiveOn, destinations: c.destinations, routes: c.routes ?? null,
      nat_in: resolve(c.for, where).nat_in, summary: c.summary, detail: c.detail ?? null, severity: c.severity,
      source_ids: c.sources, requirement_ids: c.rules ?? [],
    });
  }

  if (errors.length) throw new Error(`The rulebook has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);

  const sources: SourceRow[] = Object.entries(input.sources).map(([id, s]) => ({ id, ...s }));
  const nationalities: NationalityRow[] = input.nationalities.map((n) => ({
    code: n.code, name: n.name, schengen_visa: n.flags.includes('schengen_visa'), ireland_visa: n.flags.includes('ireland_visa'),
    flags: n.flags, coverage: n.coverage,
  }));
  const version = hash({ guides, requirements, facts, changes, sources, nationalities }).slice(0, 12);
  return { version, verifiedOn: input.verifiedOn, sources, nationalities, guides, requirements, facts, changes };
}
