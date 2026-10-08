import type { NextRequest } from 'next/server';

/**
 * Origin the browser used to reach us. Safe for same-site redirects (we only ever send the user back
 * to the host they came from). Do NOT use it to build links inside e-mails: those use NEXT_PUBLIC_APP_URL
 * so a forged Host header can never point a victim at another site.
 */
export function requestOrigin(request: NextRequest | Request): string {
  const h = request.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? new URL(request.url).host;
  const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(host);
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? (local ? 'http' : 'https');
  return `${proto}://${host}`;
}
