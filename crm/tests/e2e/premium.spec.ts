import { expect, test, type Page } from '@playwright/test';
import { bootstrap, sql } from './helpers';

const iso = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function csv() {
  const rows = [
    ['Student name', 'E-mail', 'Citizenship', 'Destination country', 'Visa category', 'Course start', 'Status', 'Cohort', 'Admission date', 'Submission date', 'Decision date', 'Tags'],
    ['Asha Rao', 'asha@example.org', 'India', 'France', 'D', iso(-20), 'Approved', 'Sep 2027', iso(-100), iso(-60), iso(-30), 'scholarship'],
    ['Ben Okafor', 'ben@example.org', 'Nigeria', 'Germany', 'D', iso(-20), 'Refused', 'Sep 2027', iso(-90), iso(-50), iso(-20), ''],
    ['Chen Li', 'chen@example.org', 'China', 'France', 'D', iso(-5), 'Approved', 'Jan 2027', iso(-80), iso(-40), iso(-10), 'vip; scholarship'],
    ['Dana Smith', 'dana@example.org', 'United States', 'Spain', 'C', iso(200), 'Admitted', 'Sep 2027', iso(-2), '', '', ''],
    ['Eli Cohen', 'eli@example.org', 'Israel', 'France', 'C', iso(10), 'Submitted', 'Sep 2027', iso(-30), iso(-5), '', ''],
    ['Farah Khan', 'farah@example.org', 'Pakistan', 'Germany', 'D', iso(20), 'Documents', 'Sep 2027', iso(-5), '', '', 'urgent'],
    ['Bad Row', 'not-an-email', 'Narnia', 'Atlantis', 'D', 'someday', '', '', '', '', '', ''],
    ['=HYPERLINK("http://evil.test")', 'evil@example.org', 'India', 'Italy', 'D', iso(90), 'Admitted', 'Sep 2027', '', '', '', ''],
  ];
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}

async function importFixture(page: Page) {
  await page.goto('/applicants/import');
  await page.locator('#import-file').setInputFiles({ name: 'cases.csv', mimeType: 'text/csv', buffer: Buffer.from(csv()) });
  await expect(page.getByText('We matched columns automatically')).toBeVisible();
  // auto-matching picked the right columns for differently named headers
  await expect(page.getByLabel('Column for Full name')).toHaveValue('0');
  await expect(page.getByLabel('Column for Nationality')).toHaveValue('2');
  await expect(page.getByLabel('Column for Destination (EU / Schengen)')).toHaveValue('3');
  await expect(page.getByLabel('Column for Intake / cohort')).toHaveValue('7');
  await page.getByRole('button', { name: /Preview import/ }).click();
  await expect(page.getByText('rows ready to import')).toBeVisible();
}

test.describe('premium: import, analytics, exports', () => {
  test('import wizard validates per row, previews, imports and de-duplicates', async ({ page }) => {
    await bootstrap(page, { premium: true });
    await importFixture(page);
    await expect(page.getByText('Rows that need fixing')).toBeVisible();
    await expect(page.getByText(/Unknown destination "Atlantis"|Unknown nationality "Narnia"/).first()).toBeVisible();
    await expect(page.getByText(/not a valid e-mail/)).toBeVisible();
    await page.getByRole('button', { name: /Import 7 rows/ }).click();
    await expect(page.getByText('Import finished')).toBeVisible();
    await expect(page.getByText('7', { exact: false }).first()).toBeVisible();
    await page.getByRole('link', { name: 'View applicants' }).click();
    await expect(page.getByRole('link', { name: 'Asha Rao' }).first()).toBeVisible();
    await expect(page.getByText('1–7 of 7')).toBeVisible();

    // import again: people are matched on e-mail, not duplicated
    await importFixture(page);
    await page.getByRole('button', { name: /Import 7 rows/ }).click();
    await expect(page.getByText('Import finished')).toBeVisible();
    await expect(page.getByText(/7 matched to existing people by e-mail/)).toBeVisible();
    const [{ n }] = await sql<{ n: string }>(`select count(*) n from applicants where org_id = (select id from organizations order by created_at desc limit 1)`);
    expect(Number(n)).toBe(7);
  });

  test('analytics dashboard shows live numbers, supports drill-down, filters and export', async ({ page }) => {
    await bootstrap(page, { premium: true });
    await importFixture(page);
    await page.getByRole('button', { name: /Import 7 rows/ }).click();
    await expect(page.getByText('Import finished')).toBeVisible();

    await page.goto('/overview?range=all');
    const kpi = (label: string) => page.getByRole('listitem').filter({ hasText: label }).first();
    await expect(kpi('Active cases')).toContainText('4');
    await expect(kpi('Approved')).toContainText('2');
    await expect(kpi('Refused')).toContainText('1');
    await expect(kpi('Acceptance rate')).toContainText('66.7%');
    await expect(kpi('Median days: admission → decision')).toContainText('70 d');
    await expect(kpi('Median days: submission → decision')).toContainText('30 d');
    await expect(kpi('Stage moves today')).toBeVisible();

    // every chart renders and has an accessible name
    for (const name of [/Funnel:/, /Weekly submissions/, /Acceptance rate by destination/, /Acceptance rate by nationality/, /Average and median days per stage/, /open cases plotted/, /Cohort progress/]) {
      await expect(page.getByRole('img', { name }).first()).toBeVisible();
    }
    await expect(page.getByText('Advisor workload & performance')).toBeVisible();
    await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });

    // table view of a chart
    await page.getByRole('button', { name: 'Show data as table' }).first().click();
    await expect(page.getByRole('columnheader', { name: 'Cases reached' })).toBeVisible();

    // drill down: KPI → filtered grid
    await page.getByRole('button', { name: /Refused: 1/ }).click();
    await page.waitForURL(/\/applicants\?.*stage=refused/);
    await expect(page.getByRole('link', { name: 'Ben Okafor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Asha Rao' })).toHaveCount(0);

    // global filters change the numbers
    await page.goto('/overview?range=all&destination=FR');
    await expect(page.getByRole('listitem').filter({ hasText: 'Approved' }).first()).toContainText('2');
    await expect(page.getByRole('listitem').filter({ hasText: 'Refused' }).first()).toContainText('0');
    await expect(page.getByText('Clear filters')).toBeVisible();

    // date range presets compare with the previous period
    await page.goto('/overview?range=180');
    await expect(page.getByText(/vs previous 180 days/).first()).toBeVisible();
  });

  test('applicants grid: filters, saved views, bulk actions, export with formula protection', async ({ page }) => {
    await bootstrap(page, { premium: true });
    await importFixture(page);
    await page.getByRole('button', { name: /Import 7 rows/ }).click();
    await expect(page.getByText('Import finished')).toBeVisible();

    await page.goto('/applicants');
    await expect(page.getByText('1–7 of 7')).toBeVisible();
    await page.getByRole('group', { name: 'Filters' }).getByRole('button', { name: /^Stage/ }).click();
    await page.getByRole('checkbox', { name: 'Approved' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('1–2 of 2')).toBeVisible();
    await page.getByRole('button', { name: /Clear filters/ }).click();

    await page.getByLabel('Search applicants').fill('farah');
    await expect(page.getByText('1–1 of 1')).toBeVisible();
    await page.getByLabel('Search applicants').fill('');
    await expect(page.getByText('1–7 of 7')).toBeVisible();

    // bulk: select two → add tag → move stage
    await page.getByRole('checkbox', { name: 'Select Dana Smith' }).click();
    await page.getByRole('checkbox', { name: 'Select Farah Khan' }).click();
    await expect(page.getByText('2 selected')).toBeVisible();
    await page.getByRole('button', { name: 'Move to stage' }).click();
    await page.getByRole('menuitem', { name: 'Appointment booked' }).click();
    await expect(page.getByText('Moved 2 to Appointment')).toBeVisible();

    // save a view and re-apply it
    await page.getByLabel('Search applicants').fill('rao');
    await page.getByRole('button', { name: /Views/ }).click();
    await page.getByRole('menuitem', { name: /Save current view/ }).click();
    await page.getByLabel('Name').fill('Rao only');
    await page.getByRole('button', { name: 'Save view' }).click();
    await expect(page.getByText('View saved')).toBeVisible();
    await page.goto('/applicants');
    await page.getByRole('button', { name: /Views/ }).click();
    await page.getByRole('menuitem', { name: /Rao only/ }).click();
    await expect(page.getByText('1–1 of 1')).toBeVisible();

    // export: the malicious name is neutralised
    await page.goto('/applicants');
    await page.getByRole('button', { name: 'Export' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'All matching → CSV' }).click()]);
    const text = (await (await import('node:fs/promises')).readFile((await download.path())!, 'utf8'));
    expect(text).toContain("'=HYPERLINK");
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(text.split('\n').length).toBeGreaterThanOrEqual(8);
  });
});
