'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { Alert } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { deleteOrganizationAction, renameOrganizationAction } from '@/lib/actions/org';

export function OrgSettings() {
  const { org, isAdmin, role } = useOrg();
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [pending, start] = useTransition();
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState('');
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>Organisation</CardTitle><CardDescription>Shown to teammates and on applicant portal pages.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid max-w-md gap-3" onSubmit={(e) => {
            e.preventDefault();
            start(async () => { const r = await renameOrganizationAction({ name }); if (!r.ok) toast.error(r.error); else { toast.success('Saved'); router.refresh(); } });
          }}>
            <Field label="Name" htmlFor="org-name"><Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} maxLength={120} required minLength={2} /></Field>
            {isAdmin && <Button type="submit" loading={pending} className="justify-self-start" disabled={name.trim() === org.name}>Save</Button>}
          </form>
        </CardContent>
      </Card>
      {role === 'owner' && (
        <Card className="border-destructive/30">
          <CardHeader><CardTitle className="text-destructive">Delete organisation</CardTitle><CardDescription>Permanently deletes every applicant, document, task and log. Cancel your subscription first in Plan &amp; billing.</CardDescription></CardHeader>
          <CardContent><Button variant="destructive" onClick={() => setDel(true)}>Delete organisation…</Button></CardContent>
        </Card>
      )}
      <Dialog open={del} onOpenChange={setDel}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete {org.name}?</DialogTitle><DialogDescription>All data and uploaded files are erased immediately and cannot be recovered.</DialogDescription></DialogHeader>
          {org.plan === 'premium' && <Alert tone="warn">This organisation has an active Premium plan. Cancel it in billing first so you are not charged again.</Alert>}
          <Field label={`Type “${org.name}” to confirm`} htmlFor="del-confirm"><Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(false)}>Cancel</Button>
            <Button variant="destructive" disabled={confirm.trim() !== org.name} loading={pending} onClick={() => start(async () => {
              const r = await deleteOrganizationAction({ confirmName: confirm });
              if (!r.ok) { toast.error(r.error); return; }
              router.replace('/onboarding');
              router.refresh();
            })}>Delete everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
