'use server';

import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { DESTINATION_CODES } from '@/lib/countries';
import { dbError, fail, isoDate, ok, parse, uuid, withOrg, type ActionResult } from './helpers';

const stage = z.enum(['admitted', 'documents', 'appointment', 'submitted', 'decision_pending', 'approved', 'refused', 'withdrawn']);
const country = z.string().regex(/^[A-Z]{2}$/);
const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const optDate = isoDate.nullish().or(z.literal('')).transform((v) => (v ? v : null));
const tags = z.array(z.string().trim().min(1).max(40)).max(30).default([]);

const caseFieldsSchema = z.object({
  destination: country.refine((c) => DESTINATION_CODES.includes(c), 'Choose an EU / Schengen destination'),
  visa_type: z.enum(['C', 'D', 'other']),
  route: z.enum(['study', 'short_stay', 'work', 'research', 'traineeship', 'family']).nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  purpose: optText(200),
  programme: optText(200),
  intake: optText(80),
  start_date: optDate,
  appointment_date: optDate,
  assigned_to: uuid.nullish().transform((v) => v ?? null),
  tags,
  notes: optText(10_000),
});

const applicantFieldsSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().toLowerCase().email('Enter a valid e-mail').max(320).nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  phone: optText(40),
  nationality: country.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  residence_country: country.nullish().or(z.literal('')).transform((v) => (v ? v : null)),
});

const createSchema = applicantFieldsSchema.and(caseFieldsSchema).and(z.object({ stage: stage.default('admitted') }));

export async function createApplicantAction(input: unknown): Promise<ActionResult<{ caseId: string; applicantId: string }>> {
  const p = parse(createSchema, input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase, org }) => {
    const { data, error } = await supabase.rpc('create_applicant_with_case', { p_org: org.id, p_row: p.data });
    if (error) return dbError(error);
    const r = data as { applicant_id: string; case_id: string };
    return ok({ caseId: r.case_id, applicantId: r.applicant_id });
  });
}

const addCaseSchema = z.object({ applicantId: uuid, stage: stage.default('admitted') }).and(caseFieldsSchema);
export async function addCaseAction(input: unknown): Promise<ActionResult<{ caseId: string }>> {
  const p = parse(addCaseSchema, input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase, org }) => {
    const { applicantId, ...rest } = p.data;
    const { data, error } = await supabase.from('cases').insert({ ...rest, org_id: org.id, applicant_id: applicantId }).select('id').single();
    if (error) return dbError(error);
    return ok({ caseId: data.id as string });
  });
}

export async function updateApplicantAction(applicantId: string, input: unknown): Promise<ActionResult> {
  const p = parse(applicantFieldsSchema, input);
  if ('error' in p) return p.error;
  if (!uuid.safeParse(applicantId).success) return fail('Invalid applicant.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data, error } = await supabase.from('applicants').update(p.data).eq('id', applicantId).select('id');
    if (error) return dbError(error);
    return data?.length ? ok(undefined) : fail('Not found or no permission.', 'not_found');
  });
}

export async function updateCaseAction(caseId: string, input: unknown): Promise<ActionResult> {
  const p = parse(caseFieldsSchema.partial().extend({ decision_reason: optText(1000).optional(), opened_on: isoDate.optional() }), input);
  if ('error' in p) return p.error;
  if (!uuid.safeParse(caseId).success) return fail('Invalid case.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const patch = Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return ok(undefined);
    const { data, error } = await supabase.from('cases').update(patch).eq('id', caseId).select('id');
    if (error) return dbError(error);
    return data?.length ? ok(undefined) : fail('Not found or no permission.', 'not_found');
  });
}

const idList = z.array(uuid).min(1).max(500);

export async function changeStageAction(input: { caseIds: string[]; stage: z.infer<typeof stage>; reason?: string | null }): Promise<ActionResult<{ updated: number }>> {
  const p = parse(z.object({ caseIds: idList, stage, reason: optText(1000).optional() }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase }) => {
    const patch: Record<string, unknown> = { stage: p.data.stage };
    if (p.data.reason) patch.decision_reason = p.data.reason;
    const { data, error } = await supabase.from('cases').update(patch).in('id', p.data.caseIds).select('id');
    if (error) return dbError(error);
    return ok({ updated: data?.length ?? 0 });
  });
}

export async function assignAdvisorAction(input: { caseIds: string[]; userId: string | null }): Promise<ActionResult<{ updated: number }>> {
  const p = parse(z.object({ caseIds: idList, userId: uuid.nullable() }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data, error } = await supabase.from('cases').update({ assigned_to: p.data.userId }).in('id', p.data.caseIds).select('id');
    if (error) return dbError(error);
    return ok({ updated: data?.length ?? 0 });
  });
}

export async function tagCasesAction(input: { caseIds: string[]; tag: string; mode: 'add' | 'remove' }): Promise<ActionResult<{ updated: number }>> {
  const p = parse(z.object({ caseIds: idList, tag: z.string().trim().min(1).max(40), mode: z.enum(['add', 'remove']) }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data: rows, error: e1 } = await supabase.from('cases').select('id, tags').in('id', p.data.caseIds);
    if (e1) return dbError(e1);
    let updated = 0;
    for (const r of (rows ?? []) as { id: string; tags: string[] }[]) {
      const next = p.data.mode === 'add' ? [...new Set([...r.tags, p.data.tag])].slice(0, 30) : r.tags.filter((t) => t !== p.data.tag);
      if (next.length === r.tags.length && next.every((t, i) => t === r.tags[i])) continue;
      const { error } = await supabase.from('cases').update({ tags: next }).eq('id', r.id);
      if (error) return dbError(error);
      updated++;
    }
    return ok({ updated });
  });
}

export async function deleteApplicantsAction(input: { applicantIds: string[] }): Promise<ActionResult<{ deleted: number }>> {
  const p = parse(z.object({ applicantIds: idList }), input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase }) => {
    // Same path as a single erasure: stored files first (they are not covered by cascading deletes),
    // then the rows and the scrubbing of audit metadata.
    const admin = createSupabaseAdmin();
    let deleted = 0;
    for (const id of p.data.applicantIds) {
      const { data: paths, error: pe } = await supabase.rpc('erasure_file_paths', { p_applicant: id });
      if (pe) return dbError(pe);
      const list = (paths as string[] | null) ?? [];
      for (let i = 0; i < list.length; i += 500) {
        const { error } = await admin.storage.from('case-documents').remove(list.slice(i, i + 500));
        if (error) return fail(`Could not remove stored documents; ${deleted} applicants were deleted before the problem. Please try again.`, 'error');
      }
      const { error } = await supabase.rpc('erase_applicant', { p_applicant: id });
      if (error) return dbError(error);
      deleted++;
    }
    return ok({ deleted });
  });
}

// ---------------------------------------------------------------------------
// GDPR
// ---------------------------------------------------------------------------
export async function exportApplicantDataAction(applicantId: string): Promise<ActionResult<{ json: string; filename: string }>> {
  if (!uuid.safeParse(applicantId).success) return fail('Invalid applicant.', 'validation');
  return withOrg({}, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('export_applicant_data', { p_applicant: applicantId });
    if (error) return dbError(error);
    return ok({ json: JSON.stringify(data, null, 2), filename: `applicant-data-${applicantId.slice(0, 8)}.json` });
  });
}

/** Right to erasure: removes stored files, then every database row about the applicant. */
export async function eraseApplicantAction(applicantId: string): Promise<ActionResult> {
  if (!uuid.safeParse(applicantId).success) return fail('Invalid applicant.', 'validation');
  return withOrg({ admin: true }, async ({ supabase }) => {
    const { data: paths, error: pe } = await supabase.rpc('erasure_file_paths', { p_applicant: applicantId });
    if (pe) return dbError(pe);
    const list = (paths as string[] | null) ?? [];
    if (list.length) {
      const admin = createSupabaseAdmin();
      for (let i = 0; i < list.length; i += 500) {
        const { error } = await admin.storage.from('case-documents').remove(list.slice(i, i + 500));
        if (error) return fail('Could not remove stored documents; nothing was erased. Please try again.', 'error');
      }
    }
    const { error } = await supabase.rpc('erase_applicant', { p_applicant: applicantId });
    return error ? dbError(error) : ok(undefined);
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
const importRow = z.object({
  idx: z.number().int(),
  full_name: z.string().min(1).max(200),
  email: z.string().max(320).nullable(),
  phone: z.string().max(40).nullable(),
  nationality: country.nullable(),
  residence_country: country.nullable(),
  destination: country,
  visa_type: z.enum(['C', 'D', 'other']),
  purpose: z.string().max(200).nullable(),
  programme: z.string().max(200).nullable(),
  intake: z.string().max(80).nullable(),
  start_date: isoDate.nullable(),
  appointment_date: isoDate.nullable(),
  stage,
  assigned_to: uuid.nullable(),
  tags: z.array(z.string().max(40)).max(30),
  notes: z.string().max(10_000).nullable(),
  opened_on: isoDate.nullable(),
  submitted_at: z.string().max(40).nullable(),
  decided_at: z.string().max(40).nullable(),
});

export interface ImportChunkResult {
  cases_created: number; applicants_created: number; applicants_reused: number;
  errors: { index: number; error: string }[]; plan_limit_reached: boolean;
}

export async function importChunkAction(rows: unknown): Promise<ActionResult<ImportChunkResult>> {
  const p = parse(z.array(importRow).min(1).max(500), rows);
  if ('error' in p) return p.error;
  return withOrg({ write: true, feature: 'import' }, async ({ supabase, org }) => {
    const { data, error } = await supabase.rpc('import_rows', { p_org: org.id, p_rows: p.data });
    if (error) return dbError(error);
    return ok(data as ImportChunkResult);
  });
}

export async function finishImportAction(summary: { filename: string; created: number; skipped: number }): Promise<ActionResult> {
  return withOrg({ write: true, feature: 'import' }, async ({ supabase, org }) => {
    const { error } = await supabase.rpc('log_client_activity', {
      p_org: org.id, p_type: 'import_completed',
      p_payload: { file: summary.filename.slice(0, 120), created: summary.created, skipped: summary.skipped },
    });
    return error ? dbError(error) : ok(undefined);
  });
}

export async function logExportAction(input: { what: string; rows: number }): Promise<ActionResult> {
  return withOrg({ feature: 'export' }, async ({ supabase, org }) => {
    const { error } = await supabase.rpc('log_client_activity', {
      p_org: org.id, p_type: 'export_created', p_payload: { what: input.what.slice(0, 80), rows: input.rows },
    });
    return error ? dbError(error) : ok(undefined);
  });
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------
export async function saveViewAction(input: { name: string; page: 'applicants' | 'pipeline'; config: Record<string, unknown>; shared: boolean }): Promise<ActionResult<{ id: string }>> {
  const p = parse(z.object({ name: z.string().trim().min(1).max(80), page: z.enum(['applicants', 'pipeline']), config: z.record(z.string(), z.unknown()), shared: z.boolean() }), input);
  if ('error' in p) return p.error;
  return withOrg({}, async ({ supabase, org, user }) => {
    const { data, error } = await supabase.from('saved_views').insert({ ...p.data, org_id: org.id, user_id: user.id }).select('id').single();
    return error ? dbError(error) : ok({ id: data.id as string });
  });
}

export async function deleteViewAction(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail('Invalid view.', 'validation');
  return withOrg({}, async ({ supabase }) => {
    const { error } = await supabase.from('saved_views').delete().eq('id', id);
    return error ? dbError(error) : ok(undefined);
  });
}
