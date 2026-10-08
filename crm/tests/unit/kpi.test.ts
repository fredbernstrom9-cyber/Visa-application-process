import { describe, expect, it } from 'vitest';
import { formatKpi, kpiDelta } from '@/lib/kpi';

describe('kpiDelta', () => {
  it('counts: relative change, "new" from zero, tone by direction × goodness', () => {
    expect(kpiDelta(12, 10, 'count', 'up')).toEqual({ text: '+20%', direction: 'up', tone: 'good' });
    expect(kpiDelta(8, 10, 'count', 'up')).toEqual({ text: '-20%', direction: 'down', tone: 'bad' });
    expect(kpiDelta(3, 0, 'count', 'down')).toEqual({ text: '+3 (new)', direction: 'up', tone: 'bad' });
    expect(kpiDelta(5, 5, 'count', 'up')).toEqual({ text: 'no change', direction: 'flat', tone: 'neutral' });
    expect(kpiDelta(7, 5, 'count', 'neutral')).toMatchObject({ tone: 'neutral' });
  });
  it('percentages use points; durations use days (lower is better)', () => {
    expect(kpiDelta(72.5, 68, 'pct', 'up')).toEqual({ text: '+4.5 pts', direction: 'up', tone: 'good' });
    expect(kpiDelta(30, 34.5, 'days', 'down')).toEqual({ text: '-4.5 d', direction: 'down', tone: 'good' });
  });
  it('returns null when there is nothing to compare', () => {
    expect(kpiDelta(5, null, 'count', 'up')).toBeNull();
    expect(kpiDelta(null, 5, 'count', 'up')).toBeNull();
  });
  it('formats values', () => {
    expect(formatKpi(1234, 'count')).toBe('1,234');
    expect(formatKpi(66.666, 'pct')).toBe('66.7%');
    expect(formatKpi(null, 'days')).toBe('—');
    expect(formatKpi(12.04, 'days')).toBe('12 d');
  });
});
