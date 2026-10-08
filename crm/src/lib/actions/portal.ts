'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { appUrl } from '@/lib/env';
import { allow, clientIp, LIMITS } from '@/lib/rate-limit';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { hashToken, looksLikeToken, newToken } from '@/lib/tokens';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, safeFileName } from '@/lib/uploads';
import { dbError, fail, ok, parse, uuid, withOrg, type ActionResult } from './helpers';

// ---------------------------------------------------------------------------
// Staff: create / revoke links
// ---------------------------------------------------------------------------
export async function createPortalLinkAction(input: { caseId: string; days: number; label?: string }): Promise<ActionResult<{ link: string; expiresAt: string }>> {
  const p = parse(z.object({ caseId: uuid, days: z.number().int().min(1).max(180), label: z.string().trim().max(120).optional() }), input);
  if ('error' in p) return p.error;
  return withOrg({ write: true, feature: 'portal' }, async ({ supabase, org, user }) => {
    const token = newToken();
    const expiresAt = new Date(Date.now() + p.data.days * 86_400_000).toISOString();
    const { error } = await supabase.from('portal_links').insert({
      org_id: org.id, case_id: p.data.caseId, token_hash: hashToken(token), label: p.data.label || null, expires_at: expiresAt, created_by: user.id,
    });
    if (error) return dbError(error);
    // The raw token exists only in this response; the database keeps its hash.
    return ok({ link: `${appUrl()}/portal/${token}`, expiresAt });
  });
}

export async function revokePortalLinkAction(linkId: string): Promise<ActionResult> {
  if (!uuid.safeParse(linkId).success) return fail('Invalid link.', 'validation');
  return withOrg({ write: true }, async ({ supabase }) => {
    const { data, error } = await supabase.from('portal_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).is('revoked_at', null).select('id');
    if (error) return dbError(error);
    return data?.length ? ok(undefined) : fail('Link not found or already revoked.', 'not_found');
  });
}

// ---------------------------------------------------------------------------
// Applicant (no account): token is the credential. Everything is rate limited,
// scoped to the one case behind the token, and runs with the service role only
// after the token has been validated.
// ---------------------------------------------------------------------------
interface PortalData {
  link_id: string; org_id: string; case_id: string; expires_at: string; org_name: string; applicant_name: string;
  destination: string; visa_type: string; start_date: string | null; stage: string;
  items: { id: string; label: string; description: string | null; required: boolean; status: string; due_date: string | null; comment: string | null; files: { id: string; file_name: string; created_at: string }[] }[];
}

export async function loadPortal(token: string): Promise<{ status: 'ok'; data: PortalData } | { status: 'invalid' | 'rate_limited' }> {
  const ip = await clientIp();
  if (!looksLikeToken(token)) {
    // count malformed guesses too
    await allow(`portal:fail:${ip}`, LIMITS.portalFail.limit, LIMITS.portalFail.window);
    return { status: 'invalid' };
  }
  const hash = hashToken(token);
  if (!(await allow(`portal:view:${ip}:${hash.slice(0, 16)}`, LIMITS.portalView.limit, LIMITS.portalView.window))) return { status: 'rate_limited' };
  if (!(await allow(`portal:fail:${ip}`, LIMITS.portalFail.limit * 5, LIMITS.portalFail.window))) return { status: 'rate_limited' };
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc('portal_get', { p_token_hash: hash });
  if (error || !data) {
    await allow(`portal:fail:${ip}`, LIMITS.portalFail.limit, LIMITS.portalFail.window); // extra weight for misses
    return { status: 'invalid' };
  }
  return { status: 'ok', data: data as PortalData };
}

const uploadMeta = z.object({
  token: z.string().max(80),
  itemId: uuid,
  fileName: z.string().trim().min(1).max(300),
  mimeType: z.string().refine((m) => ALLOWED_MIME.includes(m), 'This file type is not allowed. Upload a PDF, photo or Word document.'),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, 'Files can be up to 10 MB'),
});

async function authorise(token: string, itemId: string, bucketKey: string): Promise<{ ok: true; orgId: string; caseId: string; hash: string } | { ok: false; error: string }> {
  const ip = await clientIp();
  if (!looksLikeToken(token)) return { ok: false, error: 'This link is not valid.' };
  const hash = hashToken(token);
  if (!(await allow(`portal:upload:${ip}:${hash.slice(0, 16)}:${bucketKey}`, LIMITS.portalUpload.limit, LIMITS.portalUpload.window))) {
    return { ok: false, error: 'Too many uploads in a short time. Please wait a few minutes.' };
  }
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc('portal_get', { p_token_hash: hash });
  const d = data as PortalData | null;
  if (!d || !d.items.some((i) => i.id === itemId)) return { ok: false, error: 'This link is no longer valid.' };
  return { ok: true, orgId: d.org_id, caseId: d.case_id, hash };
}

export async function portalPrepareUploadAction(input: unknown): Promise<ActionResult<{ path: string; uploadToken: string }>> {
  const p = parse(uploadMeta, input);
  if ('error' in p) return p.error;
  const a = await authorise(p.data.token, p.data.itemId, 'prepare');
  if (!a.ok) return fail(a.error, 'forbidden');
  const path = `${a.orgId}/${a.caseId}/${p.data.itemId}/${randomUUID()}-${safeFileName(p.data.fileName)}`;
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage.from('case-documents').createSignedUploadUrl(path);
  if (error || !data) return fail('Could not start the upload. Please try again.', 'error');
  return ok({ path, uploadToken: data.token });
}

export async function portalConfirmUploadAction(input: unknown & { path?: string }): Promise<ActionResult> {
  const p = parse(uploadMeta.extend({ path: z.string().max(600) }), input);
  if ('error' in p) return p.error;
  const a = await authorise(p.data.token, p.data.itemId, 'confirm');
  if (!a.ok) return fail(a.error, 'forbidden');
  const prefix = `${a.orgId}/${a.caseId}/${p.data.itemId}/`;
  if (!p.data.path.startsWith(prefix) || p.data.path.includes('..')) return fail('Invalid upload.', 'validation');
  const admin = createSupabaseAdmin();
  const name = p.data.path.slice(prefix.length);
  const { data: listed } = await admin.storage.from('case-documents').list(prefix.slice(0, -1), { search: name, limit: 5 });
  if (!listed?.some((o) => o.name === name)) return fail('The file did not arrive. Please try uploading it again.', 'error');
  const { error } = await admin.rpc('portal_register_file', {
    p_token_hash: a.hash, p_item_id: p.data.itemId, p_path: p.data.path, p_name: p.data.fileName, p_mime: p.data.mimeType, p_size: p.data.size,
  });
  if (error) {
    await admin.storage.from('case-documents').remove([p.data.path]);
    return error.message.includes('too_many_files') ? fail('This document already has the maximum of 10 files.', 'validation') : fail('Could not save the file. Please try again.', 'error');
  }
  return ok(undefined);
}
