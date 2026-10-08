import { expect, test } from '@playwright/test';
import { bootstrap, GATEWAY, PASSWORD, signUp, sql, uniqueEmail } from './helpers';

test.describe('authentication', () => {
  test.beforeEach(async () => { await sql('delete from rate_limits'); });

  test('private pages redirect to sign-in and remember where you were going', async ({ page }) => {
    await page.goto('/applicants');
    await expect(page).toHaveURL(/\/login\?next=%2Fapplicants/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('wrong password shows a generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work e-mail').fill('nobody@e2e.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'incorrect' })).toBeVisible();
  });

  test('sign up, create an organisation, sign out and back in with a password', async ({ page }) => {
    const email = uniqueEmail('pw');
    await signUp(page, email, 'Pat Password');
    await page.getByLabel('Organisation name').fill('Password Org');
    await page.getByRole('button', { name: 'Create organisation' }).click();
    await page.waitForURL('**/overview');
    await expect(page.getByText('Get your organisation ready')).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForURL('**/login');

    await page.getByLabel('Work e-mail').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/overview');
  });

  test('magic link signs a user in', async ({ page, request }) => {
    const email = uniqueEmail('magic');
    await page.goto('/login');
    await page.getByLabel('Work e-mail').fill(email);
    await page.getByRole('button', { name: 'Use a magic link instead' }).click();
    await page.getByRole('button', { name: /Email me a sign-in link/ }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
    const mail = (await (await request.get(`${GATEWAY}/__mail`)).json()) as { to: string; link?: string }[];
    const link = mail.filter((m) => m.to === email).at(-1)?.link;
    expect(link).toBeTruthy();
    await page.goto(link!);
    // a brand-new user has no organisation yet, so they land on onboarding
    await page.waitForURL('**/onboarding');
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  });

  test('a brand-new organisation starts empty and explains what to do first', async ({ page }) => {
    await bootstrap(page);
    await expect(page.getByText('Get your organisation ready')).toBeVisible();
    await expect(page.getByText('Set processing times')).toBeVisible();
    await expect(page.getByText('Build your first document checklist')).toBeVisible();
    await page.goto('/applicants');
    await expect(page.getByText('No applicants yet')).toBeVisible();
    await page.goto('/pipeline');
    await expect(page.getByRole('region', { name: 'Pipeline board' })).toBeVisible();
    await page.goto('/checklists');
    await expect(page.getByText('Build your first checklist')).toBeVisible();
  });
});

test.describe('rate limiting', () => {
  test('repeated sign-in attempts from one address are throttled', async ({ page }) => {
    await sql('delete from rate_limits');
    await page.goto('/login');
    for (let i = 0; i < 11; i++) {
      await page.getByLabel('Work e-mail').fill(`throttle-${i}@e2e.test`);
      await page.getByLabel('Password').fill('wrong-password');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('alert').filter({ hasText: /incorrect|Too many/ })).toBeVisible();
    }
    await expect(page.getByRole('alert').filter({ hasText: 'Too many attempts' })).toBeVisible();
    await sql('delete from rate_limits');
  });
});
