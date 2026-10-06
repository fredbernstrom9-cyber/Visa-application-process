'use server';

import { z } from 'zod';
import { DESTINATION_CODES } from '@/lib/countries';
import { dbError, ok, parse, uuid, withOrg, type ActionResult } from './helpers';

const days = z.number().int().min(0).max(365);

export async function saveRiskSettingsAction(input: unknown): Promise<ActionResult> {
  const p = parse(z.object({
    default_processing_days: days, default_appointment_wait_days: days, default_doc_prep_days: days,
    high_buffer_days: z.number().int().min(-90).max(365), medium_buffer_days: z.number().int().min(-90).max(365),
    confirm: z.boolean().optional(),
  }).refine((v) => v.medium_buffer_days >= v.high_buffer_days, { message: 'Medium threshold must be at least the high threshold', path: ['medium_buffer_days'] }), input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase, org }) => {
    const { confirm, ...vals } = p.data;
    const { error } = await supabase.from('org_settings').update({ ...vals, ...(confirm ? { processing_times_confirmed: true } : {}) }).eq('org_id', org.id);
    return error ? dbError(error) : ok(undefined);
  });
}

const row = z.object({
  id: uuid.optional(),
  destination: z.string().regex(/^[A-Z]{2}$/).refine((c) => DESTINATION_CODES.includes(c), 'Choose an EU / Schengen destination'),
  visa_type: z.enum(['any', 'C', 'D', 'other']),
  processing_days: days, appointment_wait_days: days, doc_prep_days: days,
  source_note: z.string().trim().max(300).nullish().transform((v) => v || null),
});

/** Replace the organisation's per-destination processing assumptions with the submitted set. */
export async function saveProcessingTimesAction(input: unknown): Promise<ActionResult> {
  const p = parse(z.array(row).max(200), input);
  if ('error' in p) return p.error;
  const seen = new Set<string>();
  for (const r of p.data) {
    const k = `${r.destination}:${r.visa_type}`;
    if (seen.has(k)) return { ok: false, error: `${r.destination} / ${r.visa_type} appears twice. Each destination and visa type can have one row.`, code: 'validation' };
    seen.add(k);
  }
  return withOrg({ admin: true }, async ({ supabase, org }) => {
    const { data: existing, error: e0 } = await supabase.from('processing_times').select('id, destination, visa_type').eq('org_id', org.id);
    if (e0) return dbError(e0);
    const keep = new Set(p.data.map((r) => `${r.destination}:${r.visa_type}`));
    const remove = ((existing ?? []) as { id: string; destination: string; visa_type: string }[]).filter((e) => !keep.has(`${e.destination}:${e.visa_type}`)).map((e) => e.id);
    if (remove.length) {
      const { error } = await supabase.from('processing_times').delete().in('id', remove);
      if (error) return dbError(error);
    }
    if (p.data.length) {
      const { error } = await supabase.from('processing_times').upsert(
        p.data.map(({ id: _id, ...r }) => ({ ...r, org_id: org.id })), { onConflict: 'org_id,destination,visa_type' });
      if (error) return dbError(error);
    }
    return ok(undefined);
  });
}

/** Turn automatic ClearEntry rulebook checklists on or off for new cases. */
export async function setUseRulebookAction(input: unknown): Promise<ActionResult> {
  const p = parse(z.object({ enabled: z.boolean() }), input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase, org }) => {
    const { error } = await supabase.from('org_settings').update({ use_rulebook: p.data.enabled }).eq('org_id', org.id);
    return error ? dbError(error) : ok(undefined);
  });
}
