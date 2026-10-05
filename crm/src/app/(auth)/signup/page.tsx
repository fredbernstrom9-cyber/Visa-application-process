import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Then create an organisation or accept your team&apos;s invitation.</p>
      </div>
      <SignupForm next={sp.next} defaultEmail={sp.email} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ''}`} className="font-medium text-primary underline underline-offset-2 hover:no-underline">Sign in</Link>
      </p>
    </div>
  );
}
