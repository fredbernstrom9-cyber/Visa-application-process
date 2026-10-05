import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bootstrap, sql } from './helpers';

const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`), `${label} accessibility`).toEqual([]);
}

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  test('public pages', async ({ page }) => {
    for (const path of ['/login', '/signup', '/forgot-password']) {
      await page.goto(path);
      await expect(page.locator('main, form').first()).toBeVisible();
      await scan(page, path);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`workspace pages in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const { org } = await bootstrap(page, { premium: true });
      await sql(`insert into applicants (org_id, full_name, email, nationality) select id, 'Axe Applicant', 'axe@example.org', 'IN' from organizations where name = $1`, [org]);
      await sql(`insert into cases (org_id, applicant_id, destination, visa_type, start_date, intake) select a.org_id, a.id, 'FR', 'D', $2, 'Sep 2027' from applicants a join organizations o on o.id = a.org_id where o.name = $1`, [org, iso(30)]);
      const caseId = (await sql<{ id: string }>(`select c.id from cases c join organizations o on o.id = c.org_id where o.name = $1`, [org]))[0].id;
      for (const path of ['/overview', '/applicants', '/pipeline', `/cases/${caseId}`, '/deadlines', '/tasks', '/activity', '/checklists', '/checklists/new', '/reports', '/settings', '/settings/team', '/settings/processing', '/settings/billing', '/settings/audit', '/applicants/import']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main')).toBeVisible();
        await scan(page, `${scheme} ${path}`);
      }
    });
  }
});
