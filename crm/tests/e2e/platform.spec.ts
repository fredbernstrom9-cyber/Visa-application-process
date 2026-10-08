import { expect, test, type Page } from '@playwright/test';
import { OWNER_EMAIL, OWNER_ID, OWNER_KEY } from './owner-constants';
import { bootstrap, sql } from './helpers';

async function signInAsOwner(page: Page) {
  await sql('delete from rate_limits');
  await sql(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), '{"full_name":"Owner Quick"}') on conflict (id) do nothing`,
    [OWNER_ID, OWNER_EMAIL],
  );
  await page.goto(`/owner#key=${OWNER_KEY}`);
  await page.waitForURL(/\/(onboarding|overview)/);
}

test.describe('platform overview (product owner, read-only)', () => {
  test('customers get a plain 404 and no menu entry; signed-out visitors are sent to sign in', async ({ page }) => {
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/login/);

    await bootstrap(page);
    const res = await page.goto('/platform');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Platform overview' })).toHaveCount(0);

    await page.goto('/overview');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Organisation settings' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Platform overview' })).toHaveCount(0);
  });

  test('the owner sees usage across all organisations, without any personal data', async ({ page, browser }) => {
    // a customer organisation with an applicant whose details must never appear on the platform page
    const { org } = await bootstrap(page, { label: 'cust' });
    const [{ id }] = await sql<{ id: string }>(`select id from organizations where name = $1`, [org]);
    const [applicant] = await sql<{ id: string }>(
      `insert into applicants (org_id, full_name, email, nationality) values ($1, 'Zelda Privatename', 'zelda.private@e2e.test', 'IN') returning id`, [id]);
    await sql(`insert into cases (org_id, applicant_id, destination, visa_type) values ($1, $2, 'FR', 'D')`, [id, applicant.id]);

    const ctx = await browser.newContext();
    const owner = await ctx.newPage();
    await signInAsOwner(owner);
    const res = await owner.goto('/platform');
    expect(res?.status()).toBe(200);
    await expect(owner.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
    await expect(owner.getByText('Platform · read-only')).toBeVisible();
    await expect(owner.getByText('Organisations', { exact: true }).first()).toBeVisible();

    await owner.getByLabel('Search organisations').fill(org);
    const row = owner.getByRole('row', { name: new RegExp(org) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Free');
    const cells = row.getByRole('cell');
    await expect(cells.nth(2)).toHaveText('1'); // members
    await expect(cells.nth(3)).toHaveText('1'); // applicants
    await expect(cells.nth(4)).toHaveText('1'); // open cases
    await owner.getByLabel('Search organisations').fill('no-such-organisation-xyz');
    await expect(owner.getByText(/No organisation matches/)).toBeVisible();

    // never any personal data, anywhere on the page
    await owner.getByLabel('Search organisations').fill('');
    const text = await owner.locator('main').innerText();
    expect(text).not.toContain('Zelda');
    expect(text).not.toContain('zelda.private');
    await ctx.close();
  });

  test('the platform page only reads: it offers no way to change anything', async ({ browser }) => {
    const ctx = await browser.newContext();
    const owner = await ctx.newPage();
    await signInAsOwner(owner);
    await owner.goto('/platform');
    await expect(owner.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
    await expect(owner.locator('main').getByRole('button')).toHaveCount(0); // no buttons (search and sort are not buttons)
    await expect(owner.locator('main form')).toHaveCount(0);
    await ctx.close();
  });
});
