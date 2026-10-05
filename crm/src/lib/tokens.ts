import { createHash, randomBytes } from 'node:crypto';

/** 256-bit URL-safe bearer token. Only its SHA-256 hash is ever stored. */
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const looksLikeToken = (t: string) => /^[A-Za-z0-9_-]{40,64}$/.test(t);
