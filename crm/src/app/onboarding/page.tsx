import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateOrgForm } from '@/components/auth/onboarding';
import { Brand } from '@/components/brand';
import { SignOutButton } from '@/components/app/sign-out-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMemberships, requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Welcome' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const memberships = await getMemberships(user.id);
  const sp = await searchParams;
  if (memberships.length > 0 && !sp.new) redirect('/overview');
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <Brand />
        <SignOutButton variant="ghost" />
      </div>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.fullName.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">Set up a workspace for your team, or join one you were invited to.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create an organisation</CardTitle>
          <CardDescription>Starts empty: we&apos;ll guide you through processing times, checklists and importing applicants.</CardDescription>
        </CardHeader>
        <CardContent><CreateOrgForm /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Joining an existing team?</CardTitle>
          <CardDescription>
            Open the invitation link from your e-mail while signed in as <strong>{user.email}</strong>. Invitations are tied to the address they were sent to.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
