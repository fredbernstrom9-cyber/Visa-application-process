import { describe, expect, it } from 'vitest';
import { bucketFor, endOfWeek, groupDeadlines } from '@/lib/deadlines';
import type { DeadlineItem } from '@/lib/types';

describe('deadline buckets', () => {
  // 2026-10-07 is a Wednesday; the week ends on Sunday the 11th.
  const today = '2026-10-07';
  it('finds the end of the Monday-based week', () => {
    expect(endOfWeek(today)).toBe('2026-10-11');
    expect(endOfWeek('2026-10-11')).toBe('2026-10-11'); // Sunday
    expect(endOfWeek('2026-10-12')).toBe('2026-10-18'); // Monday
  });
  it.each([
    ['2026-10-06', 'overdue'], ['2026-10-07', 'week'], ['2026-10-11', 'week'], ['2026-10-12', 'month'],
    ['2026-11-06', 'month'], ['2026-11-07', 'later'], ['2027-01-01', 'later'],
  ] as const)('%s is %s', (due, bucket) => expect(bucketFor(due, today)).toBe(bucket));
  it('groups and sorts items', () => {
    const mk = (due: string, name: string): DeadlineItem => ({ org_id: 'o', kind: 'task', ref_id: due + name, case_id: 'c', applicant_name: name, title: null, due_date: due, owner_id: null, stage: 'documents' });
    const g = groupDeadlines([mk('2026-10-20', 'B'), mk('2026-10-01', 'A'), mk('2026-10-09', 'C')], today);
    expect(g.overdue.map((i) => i.applicant_name)).toEqual(['A']);
    expect(g.week.map((i) => i.applicant_name)).toEqual(['C']);
    expect(g.month.map((i) => i.applicant_name)).toEqual(['B']);
    expect(g.later).toEqual([]);
  });
});
