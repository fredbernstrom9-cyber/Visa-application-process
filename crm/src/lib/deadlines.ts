import type { DeadlineItem } from './types';

export type Bucket = 'overdue' | 'week' | 'month' | 'later';
export const BUCKETS: { key: Bucket; label: string; hint: string }[] = [
  { key: 'overdue', label: 'Overdue', hint: 'Past due: act now' },
  { key: 'week', label: 'This week', hint: 'Today through Sunday' },
  { key: 'month', label: 'Next 30 days', hint: 'After this week' },
  { key: 'later', label: 'Later', hint: 'Beyond 30 days' },
];

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Sunday (inclusive) of the week containing `today`, weeks starting on Monday. */
export function endOfWeek(today: string): string {
  const d = new Date(utc(today));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(utc(today) + (6 - dow) * DAY).toISOString().slice(0, 10);
}

export function bucketFor(due: string, today: string): Bucket {
  if (due < today) return 'overdue';
  if (due <= endOfWeek(today)) return 'week';
  if (utc(due) - utc(today) <= 30 * DAY) return 'month';
  return 'later';
}

export function groupDeadlines(items: DeadlineItem[], today: string): Record<Bucket, DeadlineItem[]> {
  const out: Record<Bucket, DeadlineItem[]> = { overdue: [], week: [], month: [], later: [] };
  for (const i of items) out[bucketFor(i.due_date, today)].push(i);
  for (const k of Object.keys(out) as Bucket[]) out[k].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.applicant_name.localeCompare(b.applicant_name));
  return out;
}

export const KIND_LABELS: Record<DeadlineItem['kind'], string> = {
  start_date: 'Start date', appointment: 'Appointment', document: 'Document due', task: 'Task due',
};
