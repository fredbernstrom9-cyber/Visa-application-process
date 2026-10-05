'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updatePasswordAction, updateProfileAction } from '@/lib/actions/auth';

export function ProfileSettings() {
  const { user } = useOrg();
  const [name, setName] = useState(user.fullName);
  const [email, setEmail] = useState(user.emailNotifications);
  const [pw, setPw] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Signed in as {user.email}.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid max-w-md gap-4" onSubmit={(e) => {
            e.preventDefault();
            start(async () => { const r = await updateProfileAction({ fullName: name, emailNotifications: email }); if (r.ok) toast.success('Profile saved'); else toast.error(r.error); });
          }}>
            <Field label="Your name" htmlFor="p-name"><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></Field>
            <label className="flex items-start justify-between gap-4 text-sm">
              <span><span className="font-medium">E-mail me notifications</span><span className="block text-muted-foreground">A daily digest of high-risk cases, overdue documents and tasks, decisions and assignments. In-app alerts are always on.</span></span>
              <Switch checked={email} onCheckedChange={setEmail} aria-label="E-mail notifications" />
            </label>
            <Button type="submit" loading={pending} className="justify-self-start">Save</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Password</CardTitle><CardDescription>Choose a new password, or keep signing in with magic links.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid max-w-md gap-3" onSubmit={(e) => {
            e.preventDefault();
            start(async () => { const r = await updatePasswordAction({ password: pw }); if (r.ok) { toast.success('Password updated'); setPw(''); } else toast.error(r.error); });
          }}>
            <Field label="New password" htmlFor="p-pw" hint="At least 8 characters."><Input id="p-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoComplete="new-password" /></Field>
            <Button type="submit" variant="outline" loading={pending} className="justify-self-start">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
