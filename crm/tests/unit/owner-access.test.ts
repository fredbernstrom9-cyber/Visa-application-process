import { afterEach, describe, expect, it } from 'vitest';
import { hashOwnerKey, ownerAccessConfig, ownerKeyMatches } from '@/lib/owner-access';

const ID = '34979c08-259a-4b99-8e0b-3c978264c1d6';
const KEY = 'a-long-random-owner-secret-0123456789';

describe('owner quick access', () => {
  afterEach(() => { delete process.env.OWNER_ACCESS_USER_ID; delete process.env.OWNER_ACCESS_KEY_HASH; });

  it('is off unless both settings are present and well formed', () => {
    expect(ownerAccessConfig()).toBeNull();
    process.env.OWNER_ACCESS_USER_ID = ID;
    expect(ownerAccessConfig()).toBeNull();
    process.env.OWNER_ACCESS_KEY_HASH = 'not-a-hash';
    expect(ownerAccessConfig()).toBeNull();
    process.env.OWNER_ACCESS_KEY_HASH = hashOwnerKey(KEY);
    expect(ownerAccessConfig()).toEqual({ userId: ID, keyHash: hashOwnerKey(KEY) });
    process.env.OWNER_ACCESS_USER_ID = 'owner@example.com'; // must be the account id, never an e-mail address
    expect(ownerAccessConfig()).toBeNull();
  });

  it('accepts only the exact secret', () => {
    const hash = hashOwnerKey(KEY);
    expect(ownerKeyMatches(KEY, hash)).toBe(true);
    expect(ownerKeyMatches(`${KEY} `, hash)).toBe(false);
    expect(ownerKeyMatches(KEY.toUpperCase(), hash)).toBe(false);
    expect(ownerKeyMatches('', hash)).toBe(false);
    expect(ownerKeyMatches(hash, hash)).toBe(false); // knowing the stored hash is not enough
  });
});
