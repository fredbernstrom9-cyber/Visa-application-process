'use server';

import { z } from 'zod';
import { dbError, fail, isoDate, ok, parse, uuid, withOrg, type ActionResult } from './helpers';

const optDate = isoDate.nullish().or(z.literal('')).transform((v) => (v ? v : null));

export async function createTaskAction(input: unknown): Promise<ActionResult> {
  const p = parse(z.object({
    caseId: uuid,
    title: z.string().trim().min(1, 'Describe the task').max(300),
    description: z.string().trim().max(5000).nullish().transform((v) => v || null),
    assigneeId: uuid.nullish().transform((v) => v ?? null),
    dueDate: optDate,
  }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true }, async ({ supabase, org }) => {
    const { error } = await supabase.from('tasks').insert({
      org_id: org.id, case_id: p.data.caseId, title: p.data.title, description: p.data.description,
      assignee_id: p.data.assigneeId, due_date: p.data.dueDate,
    });
    return error ? dbError(error) : ok(undefined);
  });
}

export async function updateTaskAction(taskId: string, patch: unknown): Promise<ActionResult> {
  const p = parse(z.object({
    status: z.enum(['open', 'done']).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    dueDate: optDate.optional(),
    assigneeId: uuid.nullish().optional(),
  }), patch);
  if ('error' in p) return p.error;
  if (!uuid.safeParse(taskId).success) return fail('Invalid task.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const row: Record<string, unknown> = {};
    if (p.data.status !== undefined) row.status = p.data.status;
    if (p.data.title !== undefined) row.title = p.data.title;
    if (p.data.dueDate !== undefined) row.due_date = p.data.dueDate;
    if (p.data.assigneeId !== undefined) row.assignee_id = p.data.assigneeId;
    const { data, error } = await supabase.from('tasks').update(row).eq('id', taskId).select('id');
    if (error) return dbError(error);
    return data?.length ? ok(undefined) : fail('Not found or no permission.', 'not_found');
  });
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return fail('Invalid task.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    return error ? dbError(error) : ok(undefined);
  });
}
