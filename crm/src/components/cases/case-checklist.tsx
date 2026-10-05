'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, CalendarClock, ExternalLink, FileText, MessageSquare, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ItemStatusBadge } from '@/components/app/badges';
import { useOrg } from '@/components/app/org-context';
import { EmptyState } from '@/components/app/page-header';
import { useLive } from '@/components/live/realtime-provider';
import { Alert, Skeleton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  addItemAction, applyChecklistAction, deleteFileAction, deleteItemAction, registerUploadAction, updateItemAction,
} from '@/lib/actions/checklists';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, safeFileName as safeName } from '@/lib/uploads';
import { ITEM_STATUSES, REQUIREMENTS_NOTICE, SOURCE_STALE_DAYS, type ItemStatus } from '@/lib/domain';
import { daysLabelFromToday, formatBytes, formatDate, todayIso } from '@/lib/format';
import { useIsHighlighted } from '@/lib/live/highlights';
import { useCaseTemplates, useFiles, useItems, useTemplates } from '@/lib/queries/case-data';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { CaseRow, ChecklistItem, ItemFile } from '@/lib/types';
import { cn } from '@/lib/utils';


function SourceNotice({ items, caseId }: { items: ChecklistItem[]; caseId: string }) {
  const { data: templates } = useCaseTemplates(items, caseId);
  const today = Date.parse(todayIso());
  return (
    <div className="grid gap-2">
      <Alert tone="warn" title="Confirm requirements with the consulate">{REQUIREMENTS_NOTICE}</Alert>
      {(templates ?? []).map((t) => {
        const age = t.source_last_checked ? Math.floor((today - Date.parse(t.source_last_checked)) / 86_400_000) : null;
        const stale = age === null || age > SOURCE_STALE_DAYS;
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="font-medium">{t.name}</span>
            {t.official_source_url ? (
              <a href={t.official_source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                {t.official_source_name || 'Official source'} <ExternalLink className="size-3" />
              </a>
            ) : <span className="text-muted-foreground">{t.official_source_name || 'No official source recorded'}</span>}
            <span className={cn('text-xs', stale ? 'font-medium text-warn' : 'text-muted-foreground')}>
              {t.source_last_checked ? `Checked ${formatDate(t.source_last_checked)}${stale ? ` · over ${SOURCE_STALE_DAYS} days ago, re-check it` : ''}` : 'Never checked, re-check against the official source'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({ item, files, caseRow }: { item: ChecklistItem; files: ItemFile[]; caseRow: CaseRow }) {
  const { org, canWrite } = useOrg();
  const qc = useQueryClient();
  const { announce } = useLive();
  const hot = useIsHighlighted(item.id);
  const [pending, start] = useTransition();
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState(item.comment ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const overdue = item.due_date && item.status !== 'verified' && item.status !== 'received' && item.due_date < todayIso();

  const refresh = () => { void qc.invalidateQueries(); announce(['items', 'files', 'cases', 'case', 'deadlines', 'analytics', 'activity']); };
  const patch = (p: Record<string, unknown>, msg?: string) => start(async () => {
    const r = await updateItemAction(item.id, p);
    if (!r.ok) toast.error(r.error); else { if (msg) toast.success(msg); refresh(); }
  });

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) { toast.error('Upload a PDF, JPG, PNG, WEBP, HEIC, DOC(X) or TXT file.'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { toast.error('Files can be up to 10 MB.'); return; }
    const id = toast.loading(`Uploading ${file.name}…`);
    const path = `${org.id}/${caseRow.id}/${item.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await getSupabaseBrowser().storage.from('case-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { toast.error(`Upload failed: ${error.message}`, { id }); return; }
    const r = await registerUploadAction({ caseId: caseRow.id, itemId: item.id, path, fileName: file.name, mimeType: file.type, size: file.size });
    if (!r.ok) { toast.error(r.error, { id }); return; }
    toast.success('Uploaded', { id });
    refresh();
  }

  async function open(f: ItemFile) {
    // Private bucket: short-lived signed URL, issued only if RLS lets this user read the object.
    const { data, error } = await getSupabaseBrowser().storage.from('case-documents').createSignedUrl(f.storage_path, 120);
    if (error || !data) { toast.error('Could not open the file. You may no longer have access.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <li className={cn('rounded-xl border bg-card p-3.5 shadow-xs', hot && 'live-flash')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.label}</span>
            {!item.required && <Badge tone="neutral">Optional</Badge>}
            <ItemStatusBadge status={item.status} />
            {item.due_date && (
              <span className={cn('inline-flex items-center gap-1 text-xs', overdue ? 'font-medium text-danger' : 'text-muted-foreground')}>
                {overdue ? <AlertTriangle className="size-3" /> : <CalendarClock className="size-3" />}
                Due {formatDate(item.due_date)} · {daysLabelFromToday(item.due_date)}
              </span>
            )}
          </div>
          {item.description && <p className="mt-0.5 text-[13px] text-muted-foreground">{item.description}</p>}
          {item.comment && !commentOpen && <p className="mt-1.5 flex items-start gap-1.5 text-[13px]"><MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><span className="whitespace-pre-wrap">{item.comment}</span></p>}
          {files.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 text-xs">
                  <button type="button" className="flex items-center gap-1.5 hover:text-primary" onClick={() => void open(f)}>
                    <FileText className="size-3.5" /> <span className="max-w-48 truncate">{f.file_name}</span>
                    <span className="text-muted-foreground">{formatBytes(f.size_bytes)}</span>
                    {f.uploaded_via === 'portal' && <Badge tone="violet" className="px-1 py-0 text-[10px]">Applicant</Badge>}
                  </button>
                  {canWrite && (
                    <button type="button" aria-label={`Delete ${f.file_name}`} className="rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => start(async () => { const r = await deleteFileAction(f.id); if (!r.ok) toast.error(r.error); else refresh(); })}>
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-1.5">
            {item.status !== 'verified' && (
              <Button size="xs" variant="outline" disabled={pending} onClick={() => patch({ status: 'verified' })} title="Mark as verified"><BadgeCheck /> Verify</Button>
            )}
            {item.status !== 'needs_redo' && item.status !== 'missing' && (
              <Button size="xs" variant="outline" disabled={pending} onClick={() => patch({ status: 'needs_redo' })}><RotateCcw /> Needs redo</Button>
            )}
            <Button size="xs" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}><Upload /> Upload</Button>
            <input ref={fileRef} type="file" hidden accept={ALLOWED_MIME.join(',')} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        )}
      </div>

      {canWrite && (
        <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-end">
          <Field label="Status" htmlFor={`st-${item.id}`}>
            <Select id={`st-${item.id}`} value={item.status} disabled={pending} onChange={(e) => patch({ status: e.target.value as ItemStatus })}>
              {ITEM_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Due date" htmlFor={`due-${item.id}`}>
            <Input id={`due-${item.id}`} type="date" defaultValue={item.due_date ?? ''} disabled={pending} onBlur={(e) => { if ((e.target.value || null) !== item.due_date) patch({ due_date: e.target.value }); }} />
          </Field>
          <div className="grid gap-1.5">
            {commentOpen ? (
              <>
                <Textarea aria-label="Comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Visible to the applicant in the portal" />
                <div className="flex gap-2">
                  <Button size="xs" loading={pending} onClick={() => { patch({ comment }); setCommentOpen(false); }}>Save comment</Button>
                  <Button size="xs" variant="ghost" onClick={() => { setComment(item.comment ?? ''); setCommentOpen(false); }}>Cancel</Button>
                </div>
              </>
            ) : (
              <Button size="xs" variant="ghost" className="justify-self-start" onClick={() => setCommentOpen(true)}><MessageSquare /> {item.comment ? 'Edit comment' : 'Add comment'}</Button>
            )}
          </div>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${item.label}`} disabled={pending} onClick={() => {
            if (window.confirm(`Remove “${item.label}” and its uploaded files from this case?`)) start(async () => { const r = await deleteItemAction(item.id); if (!r.ok) toast.error(r.error); else refresh(); });
          }}><Trash2 /></Button>
        </div>
      )}
    </li>
  );
}

export function CaseChecklist({ caseRow }: { caseRow: CaseRow }) {
  const { canWrite } = useOrg();
  const qc = useQueryClient();
  const { announce } = useLive();
  const { data: items, isLoading } = useItems(caseRow.id);
  const { data: files } = useFiles(caseRow.id);
  const { data: templates } = useTemplates();
  const [addOpen, setAddOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [pending, start] = useTransition();
  const [tplId, setTplId] = useState('');
  const [label, setLabel] = useState('');
  const [due, setDue] = useState('');

  const refresh = () => { void qc.invalidateQueries(); announce(['items', 'cases', 'case', 'deadlines', 'analytics', 'activity']); };
  const filesByItem = (id: string) => (files ?? []).filter((f) => f.item_id === id);
  const list = items ?? [];
  const verified = list.filter((i) => i.required && i.status === 'verified').length;
  const required = list.filter((i) => i.required).length;

  return (
    <div className="grid gap-4">
      <SourceNotice items={list} caseId={caseRow.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {required > 0 ? <><strong className="text-foreground">{verified}</strong> of <strong className="text-foreground">{required}</strong> required documents verified</> : 'No required documents yet'}
        </p>
        {canWrite && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)}>Apply template</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus /> Add item</Button>
          </div>
        )}
      </div>

      {isLoading ? <Skeleton className="h-40" /> : list.length === 0 ? (
        <EmptyState icon={FileText} title="No checklist on this case yet" actions={canWrite && (
          <>
            <Button onClick={() => start(async () => {
              const r = await applyChecklistAction({ caseIds: [caseRow.id] });
              if (!r.ok) toast.error(r.error); else if (r.data.added === 0) toast.info('No template matches this destination and visa type yet. Create one under Checklists.'); else { toast.success(`Added ${r.data.added} items`); refresh(); }
            })} loading={pending}>Apply matching template</Button>
            <Button variant="outline" onClick={() => setAddOpen(true)}>Add an item manually</Button>
          </>
        )}>
          Checklists come from templates for this destination and visa type. Admins create them under <strong>Checklists</strong>; a matching one is applied automatically to new cases.
        </EmptyState>
      ) : (
        <ul className="grid gap-2.5">{list.map((i) => <ItemRow key={i.id} item={i} files={filesByItem(i.id)} caseRow={caseRow} />)}</ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a document</DialogTitle><DialogDescription>For anything specific to this applicant.</DialogDescription></DialogHeader>
          <form className="grid gap-3" onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addItemAction({ caseId: caseRow.id, label, dueDate: due || null });
              if (!r.ok) { toast.error(r.error); return; }
              setAddOpen(false); setLabel(''); setDue(''); refresh();
            });
          }}>
            <Field label="Document" htmlFor="ni-label"><Input id="ni-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={200} autoFocus placeholder="e.g. Proof of accommodation" /></Field>
            <Field label="Due date" htmlFor="ni-due"><Input id="ni-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            <DialogFooter><Button type="submit" loading={pending}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply a checklist template</DialogTitle><DialogDescription>Adds any items this case does not have yet. Existing items and uploads are kept.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Field label="Template" htmlFor="ap-tpl">
              <Select id="ap-tpl" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                <option value="">Best match for this case</option>
                {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.destination} · {t.visa_type}{t.nationality ? ` · ${t.nationality}` : ''})</option>)}
              </Select>
            </Field>
            <DialogFooter>
              <Button loading={pending} onClick={() => start(async () => {
                const r = await applyChecklistAction({ caseIds: [caseRow.id], templateId: tplId || null });
                if (!r.ok) { toast.error(r.error); return; }
                toast.success(r.data.added ? `Added ${r.data.added} items` : 'Nothing new to add');
                setApplyOpen(false); refresh();
              })}>Apply</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      {list.length > 0 && <Card className="hidden"><CardContent /></Card>}
    </div>
  );
}
