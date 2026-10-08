import Link from 'next/link';
import { Alert } from '@/components/ui/misc';

/**
 * Shown after sign-up. For privacy, the authentication service answers "success" without sending anything when
 * the address already has an account, so this message must not promise an e-mail it may not have sent.
 */
export function SignupSent({ email, next }: { email: string; next?: string }) {
  const q = new URLSearchParams({ email, ...(next ? { next } : {}) }).toString();
  return (
    <div className="grid gap-3">
      <Alert tone="ok" title="Check your inbox">
        If <strong>{email}</strong> is a new address, we have sent a confirmation link. It can take a minute, and it may land in spam.
      </Alert>
      <p className="text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Already have an account with this address?</strong> Then no e-mail is sent.{' '}
        <Link href={`/login?${q}`} className="font-medium text-primary underline underline-offset-2 hover:no-underline">Sign in</Link>
        {' '}or{' '}
        <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2 hover:no-underline">reset your password</Link>.
      </p>
    </div>
  );
}
