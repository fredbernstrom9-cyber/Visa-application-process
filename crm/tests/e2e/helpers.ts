import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { expect, type Page } from '@playwright/test';

export const STACK_DB = process.env.STACK_DB_URL || 'postgresql://postgres@127.0.0.1:54329/clearentry_dev';
export const GATEWAY = `http://127.0.0.1:${process.env.GATEWAY_PORT || 54321}`;

export const uniqueEmail = (label = 'user') => `${label}-${randomUUID().slice(0, 8)}@e2e.test`;
export const PASSWORD = 'correct-horse-battery';

/** Direct SQL as the database owner (service-role style): plan upgrades and assertions on stored data. */
export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: STACK_DB });
  await client.connect();
  try { return (await client.query(query, params)).rows as T[]; } finally { await client.end(); }
}

export async function signUp(page: Page, email: string, name = 'Test Person') {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Work e-mail').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
}

export async function createOrg(page: Page, name: string) {
  await page.getByLabel('Organisation name').fill(name);
  await page.getByRole('button', { name: 'Create organisation' }).click();
  await page.waitForURL('**/overview');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
}

export async function upgradeOrg(name: string) {
  await sql(`update organizations set plan = 'premium' where name = $1`, [name]);
}

/** Sign up + create an organisation, return its name. */
export async function bootstrap(page: Page, opts: { premium?: boolean; label?: string } = {}) {
  const email = uniqueEmail(opts.label ?? 'owner');
  const org = `E2E ${randomUUID().slice(0, 6)}`;
  await signUp(page, email, 'Olivia Owner');
  await createOrg(page, org);
  if (opts.premium) { await upgradeOrg(org); await page.reload(); }
  return { email, org };
}
