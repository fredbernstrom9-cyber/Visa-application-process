/** Mutating API routes that rely on cookies only accept requests that originate from our own pages. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients (curl, server-to-server) carry no Origin and no ambient cookies worth abusing
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}
