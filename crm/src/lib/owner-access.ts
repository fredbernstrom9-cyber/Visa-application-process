import crypto from 'node:crypto';

/**
 * Owner quick access: a private link that signs the site owner in without typing a password.
 * Off unless BOTH variables are set. Only the one configured account can ever be signed in this way.
 *   OWNER_ACCESS_USER_ID   id (uuid) of the owner's account in Supabase Auth
 *   OWNER_ACCESS_KEY_HASH  SHA-256 (hex) of the secret in the link; the secret itself is never stored
 */
export function ownerAccessConfig(): { userId: string; keyHash: string } | null {
  const userId = process.env.OWNER_ACCESS_USER_ID?.trim();
  const keyHash = process.env.OWNER_ACCESS_KEY_HASH?.trim().toLowerCase();
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  if (!keyHash || !/^[0-9a-f]{64}$/.test(keyHash)) return null;
  return { userId, keyHash };
}

export const hashOwnerKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

/** Constant-time comparison of the presented secret with the stored hash. */
export function ownerKeyMatches(candidate: string, keyHash: string): boolean {
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = Buffer.from(keyHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
