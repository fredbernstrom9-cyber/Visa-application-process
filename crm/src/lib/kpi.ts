export type KpiUnit = 'count' | 'pct' | 'days';
export type Better = 'up' | 'down' | 'neutral';
export type Tone = 'good' | 'bad' | 'neutral';

export interface Delta {
  /** Signed text, e.g. "+12%", "-3.5 pts", "+2 (new)". */
  text: string;
  direction: 'up' | 'down' | 'flat';
  tone: Tone;
}

/**
 * Change versus the previous period. Counts show relative change (or "new" from zero),
 * percentages show percentage-point change, durations show absolute days.
 */
export function kpiDelta(cur: number | null | undefined, prev: number | null | undefined, unit: KpiUnit, better: Better): Delta | null {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null;
  const diff = cur - prev;
  const direction = diff === 0 ? 'flat' : diff > 0 ? 'up' : 'down';
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const abs = Math.abs(diff);
  let text: string;
  if (direction === 'flat') text = 'no change';
  else if (unit === 'count') text = prev === 0 ? `${sign}${abs} (new)` : `${sign}${Math.round((abs / prev) * 100)}%`;
  else if (unit === 'pct') text = `${sign}${round1(abs)} pts`;
  else text = `${sign}${round1(abs)} d`;
  const tone: Tone = direction === 'flat' || better === 'neutral' ? 'neutral' : (direction === 'up') === (better === 'up') ? 'good' : 'bad';
  return { text, direction, tone };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function formatKpi(v: number | null | undefined, unit: KpiUnit): string {
  if (v === null || v === undefined) return '—';
  if (unit === 'pct') return `${round1(v)}%`;
  if (unit === 'days') return `${round1(v)} d`;
  return v.toLocaleString('en-GB');
}
