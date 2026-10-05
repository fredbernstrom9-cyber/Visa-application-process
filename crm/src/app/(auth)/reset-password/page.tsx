import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/forms';
import { getSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?error=' + encodeURIComponent('That reset link has expired. Request a new one.'));
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
