import { expect, test } from '@playwright/test';
import { OWNER_EMAIL, OWNER_ID, OWNER_KEY } from './owner-constants';
import { sql } from './helpers';

test.describe('owner quick access', () => {
  test.beforeEach(async () => {
    await sql('delete from rate_limits'); // all tests share one IP
    await sql(
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), '{"full_name":"Owner Quick"}') on conflict (id) do nothing`,
      [OWNER_ID, OWNER_EMAIL],
    );
  });

  test('the private link signs the owner in without a password and leaves no key behind', async ({ page }) => {
    await page.goto(`/owner#key=${OWNER_KEY}`);
    await page.waitForURL(/\/(onboarding|overview)/);
    expect(page.url()).not.toContain(OWNER_KEY);
    // a real session for the configured owner account (it has no organisation yet, so the app offers to create one)
    await expect(page.getByText(OWNER_EMAIL)).toBeVisible();
    await page.goto('/overview');
    await expect(page).not.toHaveURL(/\/login/);
    await page.reload();
    await expect(page.getByText('Welcome, Owner')).toBeVisible();
  });

  test('a wrong or missing key never signs anyone in', async ({ page, request }) => {
    await page.goto('/owner#key=this-is-not-the-right-key-at-all');
    await expect(page.getByText('That link did not work')).toBeVisible();
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/owner');
    await expect(page.getByText('needs your private owner link')).toBeVisible();

    // the API itself answers every bad request the same way and sets no session
    const res = await request.post('/api/owner-access', { data: { key: 'x'.repeat(40) } });
    expect(res.status()).toBe(404);
    expect(res.headers()['set-cookie'] ?? '').not.toContain('sb-');
    const forged = await request.post('/api/owner-access', { data: { key: OWNER_KEY }, headers: { Origin: 'https://evil.example' } });
    expect(forged.status()).toBe(403);
  });

  test('repeated guesses are throttled', async ({ request }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await request.post('/api/owner-access', { data: { key: `wrong-key-${i}`.padEnd(30, 'x') } })).status());
    expect(statuses.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
