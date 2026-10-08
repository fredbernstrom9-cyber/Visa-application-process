'use client';

import { BadgeCheck, CalendarClock, CircleDashed, FileCheck2, FileText, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '@/components/brand';
import { Alert, Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { portalConfirmUploadAction, portalPrepareUploadAction } from '@/lib/actions/portal';
import { countryName } from '@/lib/countries';
import { formatDate, todayIso } from '@/lib/format';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from '@/lib/uploads';
import { cn } from '@/lib/utils';

type Item = { id: string; label: string; description: string | null; required: boolean; status: string; due_date: string | null; comment: string | null; files: { id: string; file_name: string; created_at: string }[] };
interface Data { org_name: string; applicant_name: string; destination: string; start_date: string | null; expires_at: string; items: Item[] }

const STATUS: Record<string, { label: string; help: string; tone: string; icon: typeof BadgeCheck }> = {
  missing: { label: 'Needed', help: 'Please upload this document.', tone: 'bg-neutral-bg text-neutral', icon: CircleDashed },
  received: { label: 'Received', help: 'Thank you. Your advisor will check it.', tone: 'bg-info-bg text-info', icon: FileCheck2 },
  verified: { label: 'Checked', help: 'Your advisor has verified this document.', tone: 'bg-ok-bg text-ok', icon: BadgeCheck },
  needs_redo: { label: 'Please send again', help: 'There was a problem with this document. See the note and upload a new copy.', tone: 'bg-danger-bg text-danger', icon: CircleDashed },
};

function ItemCard({ item, token }: { item: Item; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const st = STATUS[item.status] ?? STATUS.missing;
  const Icon = st.icon;
  const overdue = item.due_date && item.status !== 'verified' && item.status !== 'received' && item.due_date < todayIso();

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null); setDone(null);
    if (!ALLOWED_MIME.includes(file.type)) { setError('Please upload a PDF, a photo (JPG, PNG, HEIC) or a Word document.'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setError('That file is larger than 10 MB. Please upload a smaller one or a scan at lower resolution.'); return; }
    setBusy(true);
    try {
      const meta = { token, itemId: item.id, fileName: file.name, mimeType: file.type, size: file.size };
      const prep = await portalPrepareUploadAction(meta);
      if (!prep.ok) throw new Error(prep.error);
      const { error: upErr } = await getSupabaseBrowser().storage.from('case-documents').uploadToSignedUrl(prep.data.path, prep.data.uploadToken, file, { contentType: file.type });
      if (upErr) throw new Error('The upload failed. Check your connection and try again.');
      const conf = await portalConfirmUploadAction({ ...meta, path: prep.data.path });
      if (!conf.ok) throw new Error(conf.error);
      setDone(file.name);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <li className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', st.tone)}><Icon className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium leading-snug">{item.label}</h3>
            <Badge className={st.tone}>{st.label}</Badge>
            {!item.required && <Badge tone="neutral">Optional</Badge>}
          </div>
          {item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{st.help}</p>
          {item.due_date && item.status !== 'verified' && (
            <p className={cn('mt-1 flex items-center gap-1 text-xs', overdue ? 'font-medium text-danger' : 'text-muted-foreground')}><CalendarClock className="size-3" /> Please send by {formatDate(item.due_date)}{overdue && ' (overdue)'}</p>
          )}
          {item.comment && <p className="mt-2 rounded-lg bg-muted p-2.5 text-sm"><span className="font-medium">Note from your advisor:</span> {item.comment}</p>}
          {item.files.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {item.files.map((f) => <li key={f.id} className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5 shrink-0" /><span className="truncate">{f.file_name}</span></li>)}
            </ul>
          )}
          {error && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>}
          {done && !busy && <p role="status" className="mt-2 text-sm font-medium text-ok">Uploaded “{done}”. Thank you!</p>}
          {item.status !== 'verified' && (
            <div className="mt-3">
              <Button variant={item.status === 'missing' || item.status === 'needs_redo' ? 'default' : 'outline'} size="lg" className="w-full sm:w-auto" disabled={busy} onClick={() => ref.current?.click()}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? 'Uploading…' : item.files.length ? 'Upload another file' : 'Upload document'}
              </Button>
              <input ref={ref} type="file" className="sr-only" accept={ALLOWED_MIME.join(',')} aria-label={`Upload file for ${item.label}`} onChange={(e) => void upload(e.target.files)} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function PortalClient({ token, data }: { token: string; data: Data }) {
  const router = useRouter();
  // The advisor's checks appear without the applicant reloading.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 30_000);
    return () => clearInterval(t);
  }, [router]);
  const required = data.items.filter((i) => i.required);
  const sent = required.filter((i) => i.status === 'received' || i.status === 'verified').length;
  const pct = required.length ? Math.round((sent / required.length) * 100) : 0;
  const first = data.applicant_name.split(' ')[0];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3"><Brand className="text-sm" /><span className="truncate text-sm text-muted-foreground">{data.org_name}</span></div></header>
      <main className="mx-auto grid max-w-2xl gap-5 px-4 py-6">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Hello {first}</h1>
          <p className="text-muted-foreground">
            {data.org_name} needs these documents for your {countryName(data.destination)} visa application{data.start_date ? ` (start date ${formatDate(data.start_date)})` : ''}.
          </p>
        </div>
        <Card>
          <CardContent className="grid gap-2 py-4">
            <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{sent} of {required.length} required documents sent</span><span className="text-muted-foreground">{pct}%</span></div>
            <Progress value={pct} label="Documents sent" />
          </CardContent>
        </Card>
        {data.items.length === 0 ? (
          <Alert tone="info" title="Nothing to upload yet">Your advisor has not added a document list. Check back soon.</Alert>
        ) : (
          <ul className="grid gap-3">{data.items.map((i) => <ItemCard key={i.id} item={i} token={token} />)}</ul>
        )}
        <div className="grid gap-2 rounded-xl border bg-card p-4 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground"><ShieldCheck className="size-4 text-ok" /> Your files are private</p>
          <p>Documents are stored encrypted and are visible only to {data.org_name}. This link is personal to you; do not share it. It stops working on {formatDate(data.expires_at)} or sooner if your advisor cancels it.</p>
          <p>Visa requirements change and differ by consulate. Your advisor will confirm exactly what is needed.</p>
        </div>
      </main>
    </div>
  );
}
