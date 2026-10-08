/**
 * Speed Insights reports the address of every page it measures. Some addresses in this app carry secrets
 * (applicant portal links, invitation links, password-reset and sign-in links, the owner link), so those
 * pages are never reported, and every other address is reported without its query string and fragment.
 */
const PRIVATE_PREFIXES = ['/portal', '/invite', '/owner', '/auth', '/reset-password', '/forgot-password'];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function redactVitalEvent<T extends { url: string; route?: string }>(event: T, base = 'https://app.invalid'): T | null {
  try {
    const url = new URL(event.url, base);
    if (isPrivatePath(url.pathname)) return null;
    if (event.route && isPrivatePath(event.route)) return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null; // an address we cannot parse is never worth risking
  }
}
