import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { PortalClient } from '@/components/portal/portal-client';
import { loadPortal } from '@/lib/actions/portal';

export const metadata: Metadata = { title: 'Your documents', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await loadPortal(token);
  if (res.status !== 'ok') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-warn-bg text-warn"><ShieldAlert className="size-6" /></span>
        <h1 className="text-xl font-semibold">{res.status === 'rate_limited' ? 'Too many requests' : 'This link is not available'}</h1>
        <p className="text-sm text-muted-foreground">
          {res.status === 'rate_limited'
            ? 'Please wait a few minutes and try again.'
            : 'It may have expired or been replaced. Ask your advisor to send you a new link.'}
        </p>
      </main>
    );
  }
  return <PortalClient token={token} data={res.data} />;
}
