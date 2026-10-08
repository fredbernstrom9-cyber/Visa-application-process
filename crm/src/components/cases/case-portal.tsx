'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Link2, Mail, MessageCircle, ShieldOff } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { UpgradeCard } from '@/components/app/upgrade';
import { useOrg } from '@/components/app/org-context';
import { Alert, Skeleton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { createPortalLinkAction, revokePortalLinkAction } from '@/lib/actions/portal';
import { formatDate, relativeTime } from '@/lib/format';
import { usePortalLinks } from '@/lib/queries/case-data';
import type { CaseRow } from '@/lib/types';

export function CasePortal({ caseRow, canPortal }: { caseRow: CaseRow; canPortal: boolean }) {
  const { canWrite } = useOrg();
  const { data: links, isLoading } = usePortalLinks(caseRow.id);
  const qc = useQueryClient();
  const [pending, start] = useTransition();
  const [days, setDays] = useState('30');
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<{ link: string; expiresAt: string } | null>(null);
  if (!canPortal) return <UpgradeCard feature="portal" />;

  const message = (link: string) => `Hello ${caseRow.full_name.split(' ')[0]}, please upload your visa documents here: ${link}`;
  return (
    <div className="grid gap-4">
      <Alert tone="info" title="Let the applicant upload documents themselves">
        Create a personal, expiring link. They see their checklist and upload files without an account; uploads show up here instantly for you to verify. Anyone with the link can upload, so send it only to the applicant.
      </Alert>

      {canWrite && (
        <Card>
          <CardHeader><CardTitle>New link</CardTitle><CardDescription>A new link does not cancel existing ones: revoke those you no longer need.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <form className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end" onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createPortalLinkAction({ caseId: caseRow.id, days: Number(days), label });
                if (!r.ok) { toast.error(r.error); return; }
                setIssued(r.data); setLabel('');
                void qc.invalidateQueries({ queryKey: ['portal'] });
              });
            }}>
              <Field label="Valid for" htmlFor="pl-days">
                <Select id="pl-days" value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option>
                </Select>
              </Field>
              <Field label="Label (optional)" htmlFor="pl-label"><Input id="pl-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Sent via WhatsApp" /></Field>
              <Button type="submit" loading={pending}><Link2 /> Create link</Button>
            </form>
            {issued && (
              <div className="grid gap-2 rounded-lg border border-ok/40 bg-ok-bg p-3">
                <p className="text-sm font-medium">Link created. Copy it now: it is shown only once.</p>
                <div className="flex gap-2"><Input readOnly aria-label="Portal link" value={issued.link} onFocus={(e) => e.target.select()} /><Button variant="outline" size="icon" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(issued.link); toast.success('Link copied'); }}><Copy /></Button></div>
                <div className="flex flex-wrap gap-2">
                  {caseRow.phone && <Button asChild size="sm" variant="outline"><a href={`https://wa.me/${caseRow.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message(issued.link))}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></Button>}
                  {caseRow.email && <Button asChild size="sm" variant="outline"><a href={`mailto:${caseRow.email}?subject=${encodeURIComponent('Your visa documents')}&body=${encodeURIComponent(message(issued.link))}`}><Mail /> E-mail</a></Button>}
                  <Button asChild size="sm" variant="outline"><a href={issued.link} target="_blank" rel="noopener noreferrer"><ExternalLink /> Preview</a></Button>
                </div>
                <p className="text-xs text-muted-foreground">Expires {formatDate(issued.expiresAt)}.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-24" /> : (links ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Links for this case</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y">
              {(links ?? []).map((l) => {
                const expired = new Date(l.expires_at) < new Date();
                const state = l.revoked_at ? 'Revoked' : expired ? 'Expired' : 'Active';
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium"><Badge tone={state === 'Active' ? 'ok' : 'neutral'}>{state}</Badge>{l.label || 'Portal link'}</p>
                      <p className="text-xs text-muted-foreground">Created {relativeTime(l.created_at)} · {state === 'Active' ? `expires ${formatDate(l.expires_at)}` : `ended ${formatDate(l.revoked_at ?? l.expires_at)}`} · opened {l.use_count}×{l.last_used_at ? `, last ${relativeTime(l.last_used_at)}` : ''}</p>
                    </div>
                    {canWrite && state === 'Active' && (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
                        const r = await revokePortalLinkAction(l.id);
                        if (!r.ok) toast.error(r.error); else { toast.success('Link revoked'); void qc.invalidateQueries({ queryKey: ['portal'] }); }
                      })}><ShieldOff /> Revoke</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
