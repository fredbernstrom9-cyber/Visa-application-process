const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function relativeTime(iso: string | number | Date, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.round((t - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (!rtf) return new Date(iso).toLocaleString();
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'today';
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
}

export function pct(n: number | null | undefined, digits = 0): string {
  return n === null || n === undefined ? '—' : `${Number(n).toFixed(digits)}%`;
}

/**
 * Share of required documents verified. The database leaves docs_pct empty for decided cases (they have no risk
 * score), so fall back to the counters instead of showing "null%" or an empty bar for a fully verified file.
 */
export function docsPercent(c: { docs_pct: number | null; docs_total: number; docs_verified: number }): number | null {
  if (c.docs_pct !== null && c.docs_pct !== undefined) return c.docs_pct;
  return c.docs_total > 0 ? Math.round((c.docs_verified / c.docs_total) * 100) : null;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** "in 3d" / "2d ago" / "today" relative to today's date. */
export function daysLabelFromToday(iso: string): string {
  const d = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86_400_000);
  return daysLabel(d);
}
