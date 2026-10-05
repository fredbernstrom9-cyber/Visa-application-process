'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { Alert } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  requestPasswordResetAction, sendMagicLinkAction, signInWithPasswordAction, signUpAction, updatePasswordAction,
} from '@/lib/actions/auth';
import { getSupabaseBrowser } from '@/lib/supabase/client';

function useSubmit() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return { pending, start, error, setError };
}

export function LoginForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const { pending, start, error, setError } = useSubmit();
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [password, setPassword] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      if (mode === 'password') {
        const res = await signInWithPasswordAction({ email, password, next });
        if (res && !res.ok) setError(res.error);
      } else {
        const res = await sendMagicLinkAction({ email, next });
        if (!res.ok) setError(res.error);
        else setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <Alert tone="ok" title="Check your inbox">
        We sent a sign-in link to <strong>{email}</strong>. It works once and expires shortly.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Work e-mail" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.com" />
      </Field>
      {mode === 'password' && (
        <Field label={<span className="flex w-full items-center justify-between">Password <Link href="/forgot-password" className="text-xs font-normal text-primary underline underline-offset-2 hover:no-underline">Forgot?</Link></span>} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {mode === 'password' ? 'Sign in' : (<><Mail /> Email me a sign-in link</>)}
      </Button>
      <button
        type="button"
        className="text-center text-sm text-primary underline underline-offset-2 hover:no-underline"
        onClick={() => { setMode(mode === 'password' ? 'magic' : 'password'); setError(null); }}
      >
        {mode === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
      </button>
    </form>
  );
}

export function SignupForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const { pending, start, error, setError } = useSubmit();
  const [done, setDone] = useState(false);
  const [v, setV] = useState({ fullName: '', email: defaultEmail ?? '', password: '' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signUpAction({ ...v, next });
      if (res && !res.ok) setError(res.error);
      else if (res?.ok && res.data.needsConfirmation) setDone(true);
    });
  }

  if (done) {
    return (
      <Alert tone="ok" title="Confirm your e-mail">
        We sent a confirmation link to <strong>{v.email}</strong>. Open it to finish creating your account.
      </Alert>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Your name" htmlFor="name">
        <Input id="name" autoComplete="name" required value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />
      </Field>
      <Field label="Work e-mail" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">Create account</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { pending, start, error, setError } = useSubmit();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  if (sent) {
    return <Alert tone="ok" title="Check your inbox">If an account exists for <strong>{email}</strong>, a reset link is on its way.</Alert>;
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await requestPasswordResetAction({ email });
          if (!res.ok) setError(res.error);
          else setSent(true);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="E-mail" htmlFor="email">
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const { pending, start, error, setError } = useSubmit();
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState('');
  if (done) {
    return (
      <div className="grid gap-4">
        <Alert tone="ok" title="Password updated"><CheckCircle2 className="hidden" />You can now continue to your workspace.</Alert>
        <Button asChild><Link href="/overview">Continue</Link></Button>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await updatePasswordAction({ password });
          if (!res.ok) setError(res.error);
          else setDone(true);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">Update password</Button>
    </form>
  );
}

/** Used by the sign-out button where a server action redirect is not needed. */
export async function browserSignOut() {
  await getSupabaseBrowser().auth.signOut();
}
