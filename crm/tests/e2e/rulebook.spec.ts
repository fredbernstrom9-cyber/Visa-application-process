import { expect, test } from '@playwright/test';
import { bootstrap, sql } from './helpers';

const iso = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test.describe('ClearEntry rulebook', () => {
  test('fills a new case from the rulebook, cites sources and flags rule changes', async ({ page }) => {
    await bootstrap(page, { premium: true });

    // a new Indian applicant living in India, studying in Germany: no own template exists
    await page.goto('/applicants');
    await page.getByRole('button', { name: /New applicant|Add your first applicant/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Ravi Menon');
    await dialog.getByLabel('Nationality').selectOption('IN');
    await dialog.getByLabel('Country of residence').selectOption('IN');
    await dialog.getByLabel('Destination (EU / Schengen)').selectOption('DE');
    await expect(dialog.getByLabel('Route')).toHaveValue('study');
    await dialog.getByLabel('Start date').fill(iso(150));
    await dialog.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/cases\/[0-9a-f-]{36}/);
    const caseId = page.url().split('/').pop()!;

    // the checklist came from the rulebook, targeted to nationality and residence, with sources
    await expect(page.getByText('Get the APS certificate (Academic Evaluation Centre)')).toBeVisible();
    await expect(page.getByText('Follow the checklist of the German Embassy New Delhi')).toBeVisible();
    await expect(page.getByText('ClearEntry rulebook', { exact: true })).toBeVisible();
    await expect(page.getByText('Official source').first()).toBeVisible();
    // key figures for the case
    await expect(page.getByRole('heading', { name: 'Key rules' })).toBeVisible();
    await expect(page.getByText(/€992 a month/).first()).toBeVisible();

    // the rulebook page shows guides and the change log
    await page.goto('/rulebook');
    await expect(page.getByRole('heading', { name: 'Rulebook' })).toBeVisible();
    await page.getByLabel('Destination').selectOption('DE');
    await expect(page.getByRole('heading', { name: /Germany: national \(D\) visa for study/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Rule changes' }).click();
    await expect(page.getByText(/France: student funds threshold rises/)).toBeVisible();

    // a rule change is published by the vendor: the owner is notified and the case timeline shows it
    const id = `e2e-de-${Date.now()}`;
    await sql(
      `insert into rulebook_changes (id, effective_on, destinations, routes, summary, severity, source_ids)
       values ($1, current_date, '{DE}', '{study}', 'Germany: test change for students', 'action', '{de-ffo-sperrkonto}')`, [id]);
    await page.reload();
    await page.getByRole('button', { name: /unread notifications/ }).click();
    await expect(page.getByText('Rule change: Germany: test change for students')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Rule changes' }).click();
    await expect(page.getByText(/1 open case affected/).first()).toBeVisible();
    await page.getByText(/1 open case affected/).first().click();
    await expect(page.getByRole('link', { name: 'Ravi Menon' })).toBeVisible();

    // a changed requirement is flagged on the case until someone reviews it
    await sql(`update rulebook_requirements set label = 'Open a blocked account and deposit €12,000', content_hash = 'e2e-' || $1 where id = 'DE.study.blocked-account'`, [id]);
    await page.goto(`/cases/${caseId}`);
    await expect(page.getByText(/changed in the rulebook/)).toBeVisible();
    await expect(page.getByText(/Now:.*€12,000/)).toBeVisible();
    await page.getByRole('button', { name: 'Mark reviewed' }).click();
    await expect(page.getByText(/changed in the rulebook/)).toHaveCount(0);

    // restore the shared dev rulebook for later runs
    await sql(`delete from rulebook_changes where id = $1`, [id]);
  });
});
