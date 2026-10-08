import { describe, expect, it } from 'vitest';
import { redactVitalEvent } from '@/lib/speed-insights';

const ev = (url: string, route?: string) => ({ type: 'vital' as const, url, route });

describe('Speed Insights privacy filter', () => {
  it('never reports pages whose address contains a secret', () => {
    for (const path of ['/portal/abc123secret', '/portal', '/invite/tok-en', '/owner', '/auth/confirm', '/auth/callback', '/reset-password', '/forgot-password']) {
      expect(redactVitalEvent(ev(`https://clearentry-crm.vercel.app${path}`)), path).toBeNull();
    }
    expect(redactVitalEvent(ev('https://x.test/portal/abc', undefined))).toBeNull();
    expect(redactVitalEvent(ev('https://x.test/anything', '/portal/[token]'))).toBeNull();
  });

  it('reports ordinary pages without the query string or fragment', () => {
    expect(redactVitalEvent(ev('https://x.test/applicants?q=jane%20doe&stage=documents#row-3'))).toEqual(ev('https://x.test/applicants'));
    expect(redactVitalEvent(ev('https://x.test/cases/8f3c?tab=timeline', '/cases/[id]'))).toEqual(ev('https://x.test/cases/8f3c', '/cases/[id]'));
  });

  it('is not fooled by look-alike paths or odd input', () => {
    expect(redactVitalEvent(ev('https://x.test/portals-overview'))).not.toBeNull(); // only /portal and /portal/…
    expect(redactVitalEvent(ev('https://x.test/PORTAL/abc'))).not.toBeNull(); // paths are case sensitive here; the app only serves lower case
    expect(redactVitalEvent(ev('/portal/abc'))).toBeNull(); // relative addresses are resolved first
    expect(redactVitalEvent(ev('http://['))).toBeNull(); // unparsable: dropped
  });
});
