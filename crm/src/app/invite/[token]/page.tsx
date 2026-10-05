import type { Metadata } from 'next';
import Link from 'next/link';
import { AcceptInvite } from '@/components/auth/accept-invite';
import { Brand } from '@/components/brand';
import { Alert } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { lookupInvitation } from '@/lib/actions/org';
import { getSessionUser } from '@/lib/auth/session';
import { roleLabel } from '@/lib/domain';

export const metadata: Metadata = { title: 'Invitation', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([lookupInvitation(token), getSessionUser()]);
  const next = `/invite/${token}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <Brand />
      {invite.status !== 'ok' ? (
        <Alert tone="danger" title={invite.status === 'rate_limited' ? 'Too many attempts' : 'This invitation is no longer valid'}>
          {invite.status === 'rate_limited' ? 'Please wait a few minutes and try again.' : 'It may have expired, been revoked or already been used. Ask your administrator to send a new one.'}
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Join {invite.orgName}</CardTitle>
            <CardDescription>You&apos;ve been invited as <strong>{roleLabel(invite.role)}</strong>. This invitation is for <strong>{invite.email}</strong>.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!user ? (
              <>
                <Button asChild><Link href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`}>Create an account</Link></Button>
                <Button asChild variant="outline"><Link href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`}>I already have an account</Link></Button>
              </>
            ) : user.email.toLowerCase() !== invite.email.toLowerCase() ? (
              <Alert tone="warn" title={`You are signed in as ${user.email}`}>
                Sign out and continue as <strong>{invite.email}</strong> to accept this invitation.
              </Alert>
            ) : (
              <AcceptInvite token={token} />
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
