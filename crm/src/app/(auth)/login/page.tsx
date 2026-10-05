import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Pick up where your team left off.</p>
      </div>
      {sp.error && <p role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">{sp.error}</p>}
      <LoginForm next={sp.next} defaultEmail={sp.email} />
      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href={`/signup${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ''}`} className="font-medium text-primary underline underline-offset-2 hover:no-underline">Create an account</Link>
      </p>
    </div>
  );
}
