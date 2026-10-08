import { createHash } from 'node:crypto';

// Fixed identity for the owner quick-access tests; the app under test is started with these (playwright.config.ts)
export const OWNER_ID = '00000000-0000-4000-8000-0000000000a1';
export const OWNER_EMAIL = 'owner-quick-access@e2e.test';
export const OWNER_KEY = 'e2e-owner-key-0123456789abcdefghijklmnopqrstuvwxyz';
export const OWNER_KEY_HASH = createHash('sha256').update(OWNER_KEY).digest('hex');
