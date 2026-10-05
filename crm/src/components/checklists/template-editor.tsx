'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, ClipboardPaste, ExternalLink, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { PageHeader } from '@/components/app/page-header';
import { Alert, Skeleton } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { deleteTemplateAction, saveTemplateAction } from '@/lib/actions/checklists';
import { countryOptions, destinationOptions, flagEmoji } from '@/lib/countries';
import { REQUIREMENTS_NOTICE, VISA_TYPES } from '@/lib/domain';
import { todayIso } from '@/lib/format';
import { useTemplate } from '@/lib/queries/case-data';

interface Draft {
  id?: string; name: string; destination: string; visa_type: string; nationality: string;
  official_source_name: string; official_source_url: string; source_last_checked: string; notes: string; active: boolean;
  items: { id: string; label: string; description: string; required: boolean; due_days_before_start: string }[];
}

const blank = (): Draft => ({
  name: '', destination: '', visa_type: 'D', nationality: '', official_source_name: '', official_source_url: '', source_last_checked: '', notes: '', active: true, items: [],
});

export function TemplateEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const { isAdmin } = useOrg();
  const { data, isLoading } = useTemplate(isNew ? null : id);
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(isNew ? blank() : null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!data?.template) return;
    const t = data.template;
    // Initialise the editable draft once the template has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((cur) => cur ?? {
      id: t.id, name: t.name, destination: t.destination, visa_type: t.visa_type, nationality: t.nationality ?? '',
      official_source_name: t.official_source_name ?? '', official_source_url: t.official_source_url ?? '', source_last_checked: t.source_last_checked ?? '',
      notes: t.notes ?? '', active: t.active,
      items: data.items.map((i) => ({ id: i.id, label: i.label, description: i.description ?? '', required: i.required, due_days_before_start: i.due_days_before_start === null ? '' : String(i.due_days_before_start) })),
    });
  }, [data]);

  if (!isNew && isLoading) return <Skeleton className="h-96" />;
  if (!isNew && !data?.template) return <Alert tone="danger" title="Template not found">It may have been deleted.</Alert>;
  if (!draft) return <Skeleton className="h-96" />;
  const d = draft;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...d, [k]: v });
  const setItem = (idx: number, patch: Partial<Draft['items'][number]>) => set('items', d.items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= d.items.length) return;
    const items = [...d.items];
    [items[idx], items[j]] = [items[j], items[idx]];
    set('items', items);
  };
  const readOnly = !isAdmin;

  function save() {
    setError(null);
    start(async () => {
      const r = await saveTemplateAction({
        id: d.id, name: d.name, destination: d.destination, visa_type: d.visa_type, nationality: d.nationality || null,
        official_source_name: d.official_source_name, official_source_url: d.official_source_url, source_last_checked: d.source_last_checked,
        notes: d.notes, active: d.active,
        items: d.items.filter((i) => i.label.trim()).map((i) => ({
          id: i.id, label: i.label, description: i.description, required: i.required,
          due_days_before_start: i.due_days_before_start === '' ? null : Number(i.due_days_before_start),
        })),
      });
      if (!r.ok) { setError(r.error); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      toast.success('Template saved');
      void qc.invalidateQueries();
      if (isNew) router.replace(`/checklists/${r.data.id}`);
    });
  }

  return (
    <>
      <Link href="/checklists" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Checklists</Link>
      <PageHeader
        title={isNew ? 'New checklist template' : d.name || 'Checklist template'}
        description="Applied automatically to new cases with the same destination and visa type. A nationality override takes precedence over the general template."
        actions={!readOnly && (
          <>
            {!isNew && <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>}
            <Button onClick={save} loading={pending}>Save template</Button>
          </>
        )}
      />
      {readOnly && <Alert tone="info" className="mb-4" title="Read-only">Only owners and admins can edit templates.</Alert>}
      {error && <Alert tone="danger" className="mb-4" title="Could not save">{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader><CardTitle>Applies to</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Template name" htmlFor="t-name" required><Input id="t-name" value={d.name} disabled={readOnly} onChange={(e) => set('name', e.target.value)} placeholder="France · long-stay student" maxLength={160} /></Field>
              <Field label="Destination" htmlFor="t-dest" required>
                <Select id="t-dest" value={d.destination} disabled={readOnly} onChange={(e) => set('destination', e.target.value)}>
                  <option value="">Select…</option>
                  {destinationOptions().map((c) => <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>)}
                </Select>
              </Field>
              <Field label="Visa type" htmlFor="t-visa" required>
                <Select id="t-visa" value={d.visa_type} disabled={readOnly} onChange={(e) => set('visa_type', e.target.value)}>
                  {VISA_TYPES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Nationality override (optional)" htmlFor="t-nat" hint="Leave empty for all nationalities.">
                <Select id="t-nat" value={d.nationality} disabled={readOnly} onChange={(e) => set('nationality', e.target.value)}>
                  <option value="">All nationalities</option>
                  {countryOptions().map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
              </Field>
              <label className="flex items-center justify-between gap-3 text-sm">Active (applied to new cases) <Switch checked={d.active} disabled={readOnly} onCheckedChange={(v) => set('active', v)} /></label>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Official source</CardTitle><CardDescription>Where these requirements come from, and when you last confirmed them.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="Source name" htmlFor="t-src"><Input id="t-src" value={d.official_source_name} disabled={readOnly} onChange={(e) => set('official_source_name', e.target.value)} placeholder="France-Visas portal" maxLength={200} /></Field>
              <Field label="Source URL" htmlFor="t-url">
                <div className="flex gap-2">
                  <Input id="t-url" type="url" value={d.official_source_url} disabled={readOnly} onChange={(e) => set('official_source_url', e.target.value)} placeholder="https://" />
                  {d.official_source_url && <Button asChild variant="outline" size="icon" aria-label="Open source"><a href={d.official_source_url} target="_blank" rel="noopener noreferrer"><ExternalLink /></a></Button>}
                </div>
              </Field>
              <Field label="Last checked on" htmlFor="t-chk">
                <div className="flex gap-2">
                  <Input id="t-chk" type="date" value={d.source_last_checked} disabled={readOnly} onChange={(e) => set('source_last_checked', e.target.value)} />
                  {!readOnly && <Button type="button" variant="outline" onClick={() => set('source_last_checked', todayIso())}>Today</Button>}
                </div>
              </Field>
              <Field label="Internal notes" htmlFor="t-notes"><Textarea id="t-notes" rows={3} value={d.notes} disabled={readOnly} onChange={(e) => set('notes', e.target.value)} /></Field>
              <p className="text-xs text-muted-foreground">{REQUIREMENTS_NOTICE}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Documents ({d.items.length})</CardTitle><CardDescription>Order is kept. “Due” is days before the start date; it becomes each case’s due date.</CardDescription></div>
            {!readOnly && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaste(true)}><ClipboardPaste /> Paste list</Button>
                <Button size="sm" onClick={() => set('items', [...d.items, { id: crypto.randomUUID(), label: '', description: '', required: true, due_days_before_start: '' }])}><Plus /> Add</Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {d.items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No documents yet. Add them one by one or paste a list (one per line).</p>}
            {d.items.map((it, idx) => (
              <div key={it.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
                <div className="grid gap-2">
                  <Input aria-label={`Document ${idx + 1} name`} value={it.label} disabled={readOnly} onChange={(e) => setItem(idx, { label: e.target.value })} placeholder="e.g. Passport valid 3+ months beyond stay" maxLength={200} />
                  <Input aria-label={`Document ${idx + 1} description`} value={it.description} disabled={readOnly} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="Guidance for the applicant (optional)" maxLength={2000} className="text-[13px]" />
                </div>
                <div className="grid gap-2">
                  <Input aria-label={`Document ${idx + 1} due days before start`} type="number" min={0} max={730} value={it.due_days_before_start} disabled={readOnly} onChange={(e) => setItem(idx, { due_days_before_start: e.target.value })} placeholder="Due: days before start" />
                  <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">Required <Switch checked={it.required} disabled={readOnly} onCheckedChange={(v) => setItem(idx, { required: v })} /></label>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 sm:flex-col">
                    <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={idx === d.items.length - 1} onClick={() => move(idx, 1)}><ArrowDown /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => set('items', d.items.filter((_, i) => i !== idx))}><Trash2 /></Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={paste} onOpenChange={setPaste}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Paste a document list</DialogTitle><DialogDescription>One document per line. Bullets and numbering are removed.</DialogDescription></DialogHeader>
          <Textarea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Passport\nPassport photo\nProof of funds'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaste(false)}>Cancel</Button>
            <Button onClick={() => {
              const lines = pasteText.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 100);
              set('items', [...d.items, ...lines.map((label) => ({ id: crypto.randomUUID(), label: label.slice(0, 200), description: '', required: true, due_days_before_start: '' }))]);
              setPasteText(''); setPaste(false);
            }}>Add {pasteText.split('\n').filter((l) => l.trim()).length || ''} items</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete this template?</DialogTitle><DialogDescription>Checklists already applied to cases keep their items. New cases will no longer receive this template.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" loading={pending} onClick={() => start(async () => {
              const r = await deleteTemplateAction(d.id!);
              if (!r.ok) { toast.error(r.error); return; }
              void qc.invalidateQueries();
              router.replace('/checklists');
            })}>Delete template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
