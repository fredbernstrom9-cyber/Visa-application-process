import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const list = z.array(z.string().min(1).max(80)).max(60);

/**
 * One filter model for the applicants grid, the pipeline, exports, reports and every analytics
 * chart. It serialises to URL query params (drill-down links) and to the jsonb accepted by the
 * SQL function public.filtered_cases().
 */
export const caseFiltersSchema = z.object({
  intake: list.optional(),
  destination: list.optional(),
  nationality: list.optional(),
  visa_type: list.optional(),
  stage: list.optional(),
  risk: list.optional(),
  advisor: list.optional(),
  tag: list.optional(),
  opened_from: date.optional(),
  opened_to: date.optional(),
  submitted_from: date.optional(),
  submitted_to: date.optional(),
  decided_from: date.optional(),
  decided_to: date.optional(),
  reached_min: z.number().int().min(1).max(7).optional(),
  open: z.boolean().optional(),
  decided: z.boolean().optional(),
});
export type CaseFilters = z.infer<typeof caseFiltersSchema>;

export const LIST_KEYS = ['intake', 'destination', 'nationality', 'visa_type', 'stage', 'risk', 'advisor', 'tag'] as const;
export const DATE_KEYS = ['opened_from', 'opened_to', 'submitted_from', 'submitted_to', 'decided_from', 'decided_to'] as const;
export type ListKey = (typeof LIST_KEYS)[number];

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function get(src: ParamSource, key: string): string | undefined {
  if (src instanceof URLSearchParams) return src.get(key) ?? undefined;
  const v = src[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseFilters(src: ParamSource): CaseFilters {
  const out: Record<string, unknown> = {};
  for (const k of LIST_KEYS) {
    const raw = get(src, k);
    if (raw) {
      const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (items.length) out[k] = items;
    }
  }
  for (const k of DATE_KEYS) {
    const raw = get(src, k);
    if (raw && date.safeParse(raw).success) out[k] = raw;
  }
  const reached = get(src, 'reached_min');
  if (reached && /^\d+$/.test(reached)) out.reached_min = Number(reached);
  if (get(src, 'open') === '1') out.open = true;
  if (get(src, 'decided') === '1') out.decided = true;
  const parsed = caseFiltersSchema.safeParse(out);
  return parsed.success ? parsed.data : {};
}

export function filtersToParams(f: CaseFilters, into = new URLSearchParams()): URLSearchParams {
  for (const k of LIST_KEYS) {
    const v = f[k];
    if (v && v.length) into.set(k, v.join(','));
  }
  for (const k of DATE_KEYS) {
    const v = f[k];
    if (v) into.set(k, v);
  }
  if (f.reached_min) into.set('reached_min', String(f.reached_min));
  if (f.open) into.set('open', '1');
  if (f.decided) into.set('decided', '1');
  return into;
}

/** jsonb payload for the SQL functions (only keys that are set). */
export function toRpcFilters(f: CaseFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of LIST_KEYS) {
    const v = f[k];
    if (v && v.length) out[k] = v;
  }
  for (const k of DATE_KEYS) {
    const v = f[k];
    if (v) out[k] = v;
  }
  if (f.reached_min) out.reached_min = f.reached_min;
  if (f.open) out.open = 'true';
  if (f.decided) out.decided = 'true';
  return out;
}

export function countActiveFilters(f: CaseFilters): number {
  let n = 0;
  for (const k of LIST_KEYS) if (f[k]?.length) n++;
  for (const k of DATE_KEYS) if (f[k]) n++;
  if (f.reached_min) n++;
  if (f.open) n++;
  if (f.decided) n++;
  return n;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
