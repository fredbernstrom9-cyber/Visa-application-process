'use server';

import { z } from 'zod';
import { DESTINATION_CODES } from '@/lib/countries';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from '@/lib/uploads';
import { dbError, fail, isoDate, ok, parse, uuid, withOrg, type ActionResult } from './helpers';

const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const optDate = isoDate.nullish().or(z.literal('')).transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Templates (admins)
// ---------------------------------------------------------------------------
const templateItem = z.object({
  id: uuid,
  label: z.string().trim().min(1, 'Every item needs a name').max(200),
  description: optText(2000),
  required: z.boolean(),
  due_days_before_start: z.number().int().min(0).max(730).nullable(),
});

const templateSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Give the template a name').max(160),
  destination: z.string().regex(/^[A-Z]{2}$/).refine((c) => DESTINATION_CODES.includes(c), 'Choose an EU / Schengen destination'),
  visa_type: z.enum(['C', 'D', 'other']),
  nationality: z.string().regex(/^[A-Z]{2}$/).nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  official_source_name: optText(200),
  official_source_url: z.string().trim().url('Enter a full URL starting with https://').max(1000).nullish().or(z.literal('')).transform((v) => (v ? v : null)),
  source_last_checked: optDate,
  notes: optText(5000),
  active: z.boolean().default(true),
  items: z.array(templateItem).max(100),
});

export async function saveTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = parse(templateSchema, input);
  if ('error' in p) return p.error;
  return withOrg({ admin: true }, async ({ supabase, org }) => {
    const { items, id, ...fields } = p.data;
    let templateId = id;
    if (templateId) {
      const { error } = await supabase.from('checklist_templates').update(fields).eq('id', templateId);
      if (error) return error.code === '23505' ? fail('A template for this destination, visa type and nationality already exists.', 'validation') : dbError(error);
    } else {
      const { data, error } = await supabase.from('checklist_templates').insert({ ...fields, org_id: org.id }).select('id').single();
      if (error) return error.code === '23505' ? fail('A template for this destination, visa type and nationality already exists.', 'validation') : dbError(error);
      templateId = data.id as string;
    }
    // Keep existing item ids stable so already-applied checklists keep their link to the template:
    // update the ones that exist, insert the new ones, delete the ones that were removed.
    const { data: current, error: ce } = await supabase.from('checklist_template_items').select('id').eq('template_id', templateId);
    if (ce) return dbError(ce);
    const existing = new Set(((current ?? []) as { id: string }[]).map((r) => r.id));
    const keep = new Set(items.map((i) => i.id));
    const removed = [...existing].filter((x) => !keep.has(x));
    if (removed.length) {
      const { error } = await supabase.from('checklist_template_items').delete().in('id', removed);
      if (error) return dbError(error);
    }
    const results = await Promise.all(items.map((i, idx) => {
      const { id: itemId, ...rest } = i;
      return existing.has(itemId)
        ? supabase.from('checklist_template_items').update({ ...rest, sort_order: idx }).eq('id', itemId)
        : supabase.from('checklist_template_items').insert({ ...rest, id: itemId, template_id: templateId, org_id: org.id, sort_order: idx });
    }));
    const failed = results.find((r) => r.error);
    if (failed?.error) return dbError(failed.error);
    return ok({ id: templateId! });
  });
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail('Invalid template.', 'validation');
  return withOrg({ admin: true }, async ({ supabase }) => {
    const { error } = await supabase.from('checklist_templates').delete().eq('id', id);
    return error ? dbError(error) : ok(undefined);
  });
}

/** Apply a specific template, or (no templateId) the best match for each case. */
export async function applyChecklistAction(input: { caseIds: string[]; templateId?: string | null }): Promise<ActionResult<{ added: number }>> {
  const p = parse(z.object({ caseIds: z.array(uuid).min(1).max(500), templateId: uuid.nullish() }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('apply_checklist_template', { p_cases: p.data.caseIds, p_template: p.data.templateId ?? null });
    if (error) return dbError(error);
    return ok({ added: (data as number) ?? 0 });
  });
}

/** Add every matching ClearEntry rulebook item the cases do not have yet. */
export async function applyRulebookAction(input: { caseIds: string[] }): Promise<ActionResult<{ added: number }>> {
  const p = parse(z.object({ caseIds: z.array(uuid).min(1).max(500) }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data, error } = await supabase.rpc('apply_rulebook', { p_cases: p.data.caseIds });
    if (error) return dbError(error);
    return ok({ added: (data as number) ?? 0 });
  });
}

/** Clear the "rule changed" flag after an advisor has reviewed the item against the new rule. */
export async function acknowledgeRuleChangeAction(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return fail('Invalid item.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data, error } = await supabase.from('checklist_items').update({ rule_changed_at: null }).eq('id', itemId).select('id');
    if (error) return dbError(error);
    return data?.length ? ok(undefined) : fail('Not found or no permission.', 'not_found');
  });
}

// ---------------------------------------------------------------------------
// Case checklist items
// ---------------------------------------------------------------------------
export async function addItemAction(input: { caseId: string; label: string; required?: boolean; dueDate?: string | null }): Promise<ActionResult> {
  const p = parse(z.object({ caseId: uuid, label: z.string().trim().min(1).max(200), required: z.boolean().default(true), dueDate: optDate }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase, org }) => {
    const { error } = await supabase.from('checklist_items').insert({
      org_id: org.id, case_id: p.data.caseId, label: p.data.label, required: p.data.required, due_date: p.data.dueDate, sort_order: 1000,
    });
    return error ? dbError(error) : ok(undefined);
  });
}

const itemPatch = z.object({
  status: z.enum(['missing', 'received', 'verified', 'needs_redo']).optional(),
  due_date: optDate.optional(),
  comment: optText(2000).optional(),
  label: z.string().trim().min(1).max(200).optional(),
  required: z.boolean().optional(),
});
export async function updateItemAction(itemId: string, patch: unknown): Promise<ActionResult> {
  const p = parse(itemPatch, patch);
  if ('error' in p) return p.error;
  if (!uuid.safeParse(itemId).success) return fail('Invalid item.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const clean = Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== undefined));
    const { data, error } = await supabase.from('checklist_items').update(clean).eq('id', itemId).select('id');
    if (error) return dbError(error);
    return data?.length ? ok(undefined) : fail('Not found or no permission.', 'not_found');
  });
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return fail('Invalid item.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data: files } = await supabase.from('checklist_item_files').select('storage_path').eq('item_id', itemId);
    const paths = ((files ?? []) as { storage_path: string }[]).map((f) => f.storage_path);
    if (paths.length) await supabase.storage.from('case-documents').remove(paths);
    const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
    return error ? dbError(error) : ok(undefined);
  });
}

// ---------------------------------------------------------------------------
// Files (staff uploads go browser -> Storage under RLS; this records them)
// ---------------------------------------------------------------------------

export async function registerUploadAction(input: { caseId: string; itemId: string; path: string; fileName: string; mimeType: string; size: number }): Promise<ActionResult<{ id: string }>> {
  const p = parse(z.object({
    caseId: uuid, itemId: uuid, path: z.string().max(600), fileName: z.string().trim().min(1).max(300),
    mimeType: z.string().refine((m) => ALLOWED_MIME.includes(m), 'This file type is not allowed'),
    size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, 'Files can be up to 10 MB'),
  }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase, org }) => {
    const prefix = `${org.id}/${p.data.caseId}/${p.data.itemId}/`;
    if (!p.data.path.startsWith(prefix) || p.data.path.includes('..')) return fail('Invalid upload path.', 'validation');
    const { data, error } = await supabase.from('checklist_item_files').insert({
      org_id: org.id, case_id: p.data.caseId, item_id: p.data.itemId, storage_path: p.data.path,
      file_name: p.data.fileName, mime_type: p.data.mimeType, size_bytes: p.data.size,
    }).select('id').single();
    if (error) {
      await supabase.storage.from('case-documents').remove([p.data.path]);
      return dbError(error);
    }
    return ok({ id: data.id as string });
  });
}

export async function deleteFileAction(fileId: string): Promise<ActionResult> {
  if (!uuid.safeParse(fileId).success) return fail('Invalid file.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data: f } = await supabase.from('checklist_item_files').select('storage_path').eq('id', fileId).maybeSingle();
    if (!f) return fail('Not found.', 'not_found');
    const { error: se } = await supabase.storage.from('case-documents').remove([f.storage_path as string]);
    if (se) return fail('Could not remove the stored file. Please try again.', 'error');
    const { error } = await supabase.from('checklist_item_files').delete().eq('id', fileId);
    return error ? dbError(error) : ok(undefined);
  });
}
