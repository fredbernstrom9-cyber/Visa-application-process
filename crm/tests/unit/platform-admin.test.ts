import { describe, expect, it } from 'vitest';
import { isPlatformAdmin, platformAdminIds } from '@/lib/platform-admin';

const A = '34979c08-259a-4b99-8e0b-3c978264c1d6';
const B = '11111111-2222-4333-8444-555555555555';

describe('platform admin check', () => {
  it('is nobody unless configured', () => {
    expect(platformAdminIds({})).toEqual([]);
    expect(isPlatformAdmin(A, {})).toBe(false);
    expect(isPlatformAdmin(null, { PLATFORM_ADMIN_USER_IDS: A })).toBe(false);
  });
  it('uses the explicit list, or falls back to the owner-link account', () => {
    expect(isPlatformAdmin(A, { PLATFORM_ADMIN_USER_IDS: `${A}, ${B}` })).toBe(true);
    expect(isPlatformAdmin(B, { PLATFORM_ADMIN_USER_IDS: `${A}, ${B}` })).toBe(true);
    expect(isPlatformAdmin(A, { OWNER_ACCESS_USER_ID: A })).toBe(true);
    expect(isPlatformAdmin(B, { OWNER_ACCESS_USER_ID: A })).toBe(false);
    expect(isPlatformAdmin(B, { PLATFORM_ADMIN_USER_IDS: A, OWNER_ACCESS_USER_ID: B })).toBe(false); // the explicit list wins
  });
  it('ignores anything that is not a user id (e-mail addresses, junk)', () => {
    expect(platformAdminIds({ PLATFORM_ADMIN_USER_IDS: 'me@example.com, *, ' })).toEqual([]);
    expect(isPlatformAdmin('me@example.com', { PLATFORM_ADMIN_USER_IDS: 'me@example.com' })).toBe(false);
  });
  it('compares ids case-insensitively', () => {
    expect(isPlatformAdmin(A.toUpperCase(), { PLATFORM_ADMIN_USER_IDS: A })).toBe(true);
  });
});
