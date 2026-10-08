import { expect, test, type Page } from '@playwright/test';
import { bootstrap, sql } from './helpers';

const iso = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function createTemplate(page: Page) {
  await page.goto('/checklists/new');
  await page.getByLabel('Template name').fill('France long stay');
  await page.getByLabel('Destination').selectOption('FR');
  await page.getByLabel('Visa type').selectOption('D');
  await page.getByLabel('Source name').fill('France-Visas portal');
  await page.getByLabel('Source URL').fill('https://france-visas.gouv.fr');
  await page.getByRole('button', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Paste list' }).click();
  await page.getByPlaceholder(/Passport/).fill('1. Passport\n- Passport photo\n• Proof of funds');
  await page.getByRole('button', { name: /Add 3 items/ }).click();
  await page.getByLabel('Document 1 due days before start').fill('30');
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Template saved')).toBeVisible();
  await page.waitForURL(/\/checklists\/[0-9a-f-]{36}/);
}

async function addApplicant(page: Page, name: string, opts: { dest?: string; start?: string } = {}) {
  await page.goto('/applicants');
  await page.getByRole('button', { name: /New applicant|Add your first applicant/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill(name);
  await dialog.getByLabel('E-mail').fill(`${name.toLowerCase().replace(/\W+/g, '.')}@example.org`);
  await dialog.getByLabel('Nationality').selectOption('IN');
  await dialog.getByLabel('Destination (EU / Schengen)').selectOption(opts.dest ?? 'FR');
  await dialog.getByLabel('Visa type').selectOption('D');
  await dialog.getByLabel('Intake / cohort').fill('Sep 2027');
  await dialog.getByLabel('Start date').fill(opts.start ?? iso(40));
  await dialog.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/);
}

test.describe('free plan journey', () => {
  test('processing times → checklist → applicant → documents → pipeline → deadlines', async ({ page }) => {
    await bootstrap(page);

    // 1. processing times
    await page.goto('/settings/processing');
    await page.getByLabel('Add a destination').selectOption('FR');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel(/processing days for France/).fill('45');
    await page.getByRole('button', { name: /Save & confirm/ }).click();
    await expect(page.getByText('Saved and confirmed')).toBeVisible();

    // 2. checklist
    await createTemplate(page);
    await expect(page.getByLabel('Document 2 name')).toHaveValue('Passport photo');

    // 3. applicant: the matching checklist is applied automatically
    await addApplicant(page, 'Asha Rao');
    await expect(page.getByRole('heading', { name: 'Asha Rao' })).toBeVisible();
    await expect(page.getByText('Passport', { exact: true })).toBeVisible();
    await expect(page.getByText('Proof of funds')).toBeVisible();
    await expect(page.getByText('France-Visas portal')).toBeVisible();
    await expect(page.getByText(/confirm.*consulate/i).first()).toBeVisible();
    // the risk reason is shown next to the score
    await expect(page.getByText(/Starts in 4\dd · no appointment · 0% docs verified · needs ~/).first()).toBeVisible();

    // 4. verify a document: counters and risk reason update
    await page.getByRole('button', { name: 'Verify' }).first().click();
    await expect(page.getByText(/33% docs verified/).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /Documents 1\/3/ })).toBeVisible();

    // 5. tasks
    await page.getByRole('tab', { name: 'Tasks' }).click();
    await page.getByLabel('New task').fill('Chase bank statement');
    await page.getByLabel('Due', { exact: true }).fill(iso(2));
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Chase bank statement')).toBeVisible();

    // 6. pipeline: move with the keyboard-accessible menu
    await page.goto('/pipeline');
    const card = page.getByRole('listitem').filter({ hasText: 'Asha Rao' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /Move to/ }).click();
    await page.getByRole('menuitem', { name: 'Appointment booked' }).click();
    await expect(page.getByText('Asha Rao → Appointment')).toBeVisible();
    await expect(page.getByRole('region', { name: /Appointment booked: 1 cases/ })).toBeVisible();

    // 7. deadlines & my tasks
    await page.goto('/deadlines');
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    await expect(page.getByText('Chase bank statement')).toBeVisible();
    await expect(page.getByText('Start date').first()).toBeVisible();
    await page.goto('/tasks');
    await expect(page.getByText('Chase bank statement')).toBeVisible();
    await page.getByRole('checkbox', { name: /Mark “Chase bank statement” as done/ }).click();
    await page.getByRole('radio', { name: 'Done' }).click();
    await expect(page.getByText('Chase bank statement')).toBeVisible();

    // 8. activity feed
    await page.goto('/activity');
    await expect(page.getByText(/moved/).first()).toBeVisible();
    await expect(page.getByText(/verified “Passport”/)).toBeVisible();

    // 9. audit log (owner)
    await page.goto('/settings/audit');
    await expect(page.getByText('Document verified').first()).toBeVisible();
    await expect(page.getByText('Stage changed').first()).toBeVisible();
  });

  test('the Free plan limits applicants and gates premium features with upgrade prompts', async ({ page }) => {
    await bootstrap(page);
    const org = (await sql<{ id: string }>(`select id from organizations order by created_at desc limit 1`))[0].id;
    // fill the free quota quickly
    const owner = (await sql<{ user_id: string }>(`select user_id from memberships where org_id = $1`, [org]))[0].user_id;
    await sql(`insert into applicants (org_id, full_name, created_by) select $1, 'Filler ' || g, $2 from generate_series(1,10) g`, [org, owner]);
    await page.goto('/applicants');
    await page.getByRole('button', { name: 'New applicant' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Eleventh Person');
    await dialog.getByLabel('Destination (EU / Schengen)').selectOption('DE');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(/Your Free plan includes 10 applicants/).first()).toBeVisible();
    await page.keyboard.press('Escape');

    // premium features are explained, not hidden
    await page.goto('/applicants/import');
    await expect(page.getByText('CSV / XLSX import is a Premium feature')).toBeVisible();
    await page.goto('/overview');
    await expect(page.getByText('Analytics dashboard is a Premium feature')).toBeVisible();
    await expect(page.getByText('Live tracking off')).toBeVisible();
    await page.goto('/settings/team');
    await page.getByRole('button', { name: 'Invite teammate' }).isDisabled();
    await expect(page.getByText('The Free plan includes one user')).toBeVisible();
  });
});
