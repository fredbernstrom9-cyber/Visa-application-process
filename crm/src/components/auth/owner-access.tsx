'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type State = 'checking' | 'missing' | 'failed' | 'limited';

/** Reads the private key from the address bar fragment (never sent to a server or logged) and signs the owner in. */
export function OwnerAccess() {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = new URLSearchParams(window.location.hash.slice(1)).get('key');
      window.history.replaceState(null, '', window.location.pathname); // do not leave the key in the address bar or history
      const set = (s: State) => { if (!cancelled) setState(s); };
      if (!key) { await Promise.resolve(); return set('missing'); }
      try {
        const res = await fetch('/api/owner-access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
        if (res.ok) { window.location.replace('/overview'); return; }
        set(res.status === 429 ? 'limited' : 'failed');
      } catch { set('failed'); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="grid gap-6" aria-live="polite">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Owner access</h1>
        <p className="text-sm text-muted-foreground">
          {state === 'checking' && 'Signing you in…'}
          {state === 'missing' && 'This page needs your private owner link.'}
          {state === 'failed' && 'That link did not work. Check that you used the full, current link.'}
          {state === 'limited' && 'Too many attempts. Please wait a few minutes and try again.'}
        </p>
      </div>
      {state !== 'checking' && (
        <Link href="/login" className="text-sm font-medium text-primary underline underline-offset-2 hover:no-underline">Sign in with e-mail and password instead</Link>
      )}
    </div>
  );
}
