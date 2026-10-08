'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MailPlus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useOrg } from '@/components/app/org-context';
import { useLive } from '@/components/live/realtime-provider';
import { Alert, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, UserAvatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { inviteMemberAction, removeMemberAction, revokeInvitationAction, setMemberRoleAction } from '@/lib/actions/org';
import { ROLES, roleLabel, type Role } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { limitFor } from '@/lib/plans';
import { useMembers } from '@/lib/queries/cases';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { Invitation } from '@/lib/types';

function useInvitations(enabled: boolean) {
  const { org } = useOrg();
  return useQuery({
    queryKey: ['members', org.id, 'invitations'],
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from('invitations').select('*').eq('org_id', org.id)
        .is('accepted_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });
}

export function TeamSettings() {
  const { org, user, role: myRole, isAdmin } = useOrg();
  const { data: members, isLoading } = useMembers();
  const { data: invites } = useInvitations(isAdmin);
  const qc = useQueryClient();
  const router = useRouter();
  const { announce } = useLive();
  const [pending, start] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'advisor' | 'viewer'>('advisor');
  const [viewAll, setViewAll] = useState(false);
  const [issued, setIssued] = useState<{ link: string; emailed: boolean } | null>(null);
  const seats = limitFor(org, 'seats');
  const used = (members?.length ?? 0) + (invites?.length ?? 0);
  const atLimit = seats !== null && used >= seats;

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['members'] }); announce(['members']); };
  const changeRole = (uid: string, r: Role, all: boolean) => start(async () => {
    const res = await setMemberRoleAction({ userId: uid, role: r, canViewAll: all });
    if (!res.ok) toast.error(res.error); else { toast.success('Role updated'); refresh(); }
  });

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Team ({members?.length ?? 0}{seats !== null ? ` of ${seats}` : ''})</CardTitle>
            <CardDescription>
              Advisors see only the applicants assigned to them, unless you grant <em>view all</em>. Viewers are read-only.
            </CardDescription>
          </div>
          {isAdmin && <Button onClick={() => { setIssued(null); setInviteOpen(true); }} disabled={atLimit}><MailPlus /> Invite teammate</Button>}
        </CardHeader>
        <CardContent>
          {atLimit && isAdmin && (
            <Alert tone="info" className="mb-4" title="The Free plan includes one user">
              Upgrade to Premium for unlimited seats. <Link href="/settings/billing" className="font-medium text-primary underline underline-offset-2 hover:no-underline">See plans</Link>
            </Alert>
          )}
          {isLoading ? <Skeleton className="h-32" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead>Access</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {(members ?? []).map((m) => {
                  const self = m.user_id === user.id;
                  const canEdit = isAdmin && !self && (myRole === 'owner' || (m.role !== 'owner' && m.role !== 'admin'));
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={m.full_name} src={m.avatar_url} className="size-8" />
                          <div className="min-w-0"><p className="truncate font-medium">{m.full_name}{self && <span className="text-muted-foreground"> (you)</span>}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select aria-label={`Role for ${m.full_name}`} className="w-32" value={m.role} disabled={pending} onChange={(e) => changeRole(m.user_id, e.target.value as Role, m.can_view_all)}>
                            {ROLES.filter((r) => myRole === 'owner' || (r.key !== 'owner' && r.key !== 'admin')).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                          </Select>
                        ) : <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>{roleLabel(m.role)}</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.role === 'advisor' ? (
                          canEdit ? (
                            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={m.can_view_all} disabled={pending} onChange={(e) => changeRole(m.user_id, 'advisor', e.target.checked)} /> View all applicants</label>
                          ) : (m.can_view_all ? 'All applicants' : 'Assigned only')
                        ) : 'All applicants'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(canEdit || (self && m.role !== 'owner')) && (
                          <Button size="icon-sm" variant="ghost" aria-label={self ? 'Leave organisation' : `Remove ${m.full_name}`} disabled={pending} onClick={() => {
                            if (!window.confirm(self ? `Leave ${org.name}?` : `Remove ${m.full_name} from ${org.name}? Their applicants become unassigned.`)) return;
                            start(async () => { const r = await removeMemberAction(m.user_id); if (!r.ok) toast.error(r.error); else { refresh(); if (self) { router.push('/overview'); router.refresh(); } } });
                          }}><Trash2 /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (invites?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending invitations</CardTitle><CardDescription>Links expire after 14 days and only work for the invited e-mail address.</CardDescription></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites!.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span><span className="font-medium">{i.email}</span> · {roleLabel(i.role)}{i.can_view_all && ' (all applicants)'} <span className="text-muted-foreground">· expires {formatDate(i.expires_at)}</span></span>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await revokeInvitationAction(i.id); if (!r.ok) toast.error(r.error); else refresh(); })}>Revoke</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>What each role can do</CardTitle></CardHeader>
        <CardContent><ul className="grid gap-2 text-sm">{ROLES.map((r) => <li key={r.key}><strong>{r.label}.</strong> <span className="text-muted-foreground">{r.blurb}</span></li>)}</ul></CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite a teammate</DialogTitle><DialogDescription>They get an e-mail with a personal link. It only works for this address.</DialogDescription></DialogHeader>
          {issued ? (
            <div className="grid gap-3">
              <Alert tone="ok" title={issued.emailed ? 'Invitation sent' : 'Invitation created'}>
                {issued.emailed ? 'We e-mailed the link. You can also copy it:' : 'E-mail delivery is not configured, so share this link with them yourself. It is shown only once:'}
              </Alert>
              <div className="flex gap-2"><Input readOnly value={issued.link} aria-label="Invitation link" onFocus={(e) => e.target.select()} /><Button variant="outline" size="icon" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(issued.link); toast.success('Copied'); }}><Copy /></Button></div>
              <DialogFooter><Button onClick={() => { setInviteOpen(false); setEmail(''); }}>Done</Button></DialogFooter>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await inviteMemberAction({ email, role, canViewAll: viewAll });
                if (!r.ok) { toast.error(r.error); return; }
                setIssued(r.data); refresh();
              });
            }}>
              <Field label="E-mail" htmlFor="inv-email"><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
              <Field label="Role" htmlFor="inv-role">
                <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  {ROLES.filter((r) => r.key !== 'owner' && (myRole === 'owner' || r.key !== 'admin')).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </Select>
              </Field>
              {role === 'advisor' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={viewAll} onChange={(e) => setViewAll(e.target.checked)} /> Can view all applicants (not only assigned)</label>}
              <DialogFooter><Button type="submit" loading={pending}>Send invitation</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
