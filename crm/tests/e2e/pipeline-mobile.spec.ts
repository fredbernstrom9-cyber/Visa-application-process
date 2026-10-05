import { expect, test, type Page } from '@playwright/test';
import { bootstrap, sql } from './helpers';

const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function addApplicant(page: Page, name: string, dest = 'FR') {
  await page.goto('/applicants');
  await page.getByRole('button', { name: /New applicant|Add your first applicant/ }).first().click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Full name').fill(name);
  await d.getByLabel('Destination (EU / Schengen)').selectOption(dest);
  await d.getByLabel('Start date').fill(iso(25));
  await d.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/);
}

test.describe('pipeline board', () => {
  test('drag and drop moves a card, records a decision with a note, and keyboard access works', async ({ page }) => {
    const { org } = await bootstrap(page);
    await addApplicant(page, 'Dana Drag');
    await addApplicant(page, 'Dev Drop', 'DE');
    await page.goto('/pipeline');
    const card = page.getByRole('listitem').filter({ hasText: 'Dana Drag' });
    await expect(card).toBeVisible();

    // pointer drag from the grip to the "Documents in progress" column
    const grip = card.getByRole('button', { name: /^Drag Dana Drag/ });
    const target = page.getByRole('region', { name: /Documents in progress/ });
    const g = (await grip.boundingBox())!;
    const t = (await target.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + 30, g.y + 10, { steps: 5 });
    await page.mouse.move(t.x + t.width / 2, t.y + 120, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByText('Dana Drag → Documents')).toBeVisible();
    await expect(page.getByRole('region', { name: /Documents in progress: 1 cases/ })).toBeVisible();
    const [row] = await sql<{ stage: string }>(`select c.stage from cases c join applicants a on a.id = c.applicant_id join organizations o on o.id = c.org_id where a.full_name = 'Dana Drag' and o.name = $1`, [org]);
    expect(row.stage).toBe('documents');
    // ... and it is in the stage history and activity stream
    const events = await sql(`select 1 from activity_events e join cases c on c.id = e.case_id join applicants a on a.id = c.applicant_id join organizations o on o.id = c.org_id where a.full_name = 'Dana Drag' and e.type = 'stage_changed' and o.name = $1`, [org]);
    expect(events).toHaveLength(1);

    // keyboard: pick up with space, move right with the arrow keys, drop with space
    await page.reload();
    const grip2 = page.getByRole('listitem').filter({ hasText: 'Dev Drop' }).getByRole('button', { name: /^Drag Dev Drop/ });
    await grip2.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(page.getByText(/Dev Drop → /)).toBeVisible();

    // recording a decision asks for an optional note and notifies the team
    const menuCard = page.getByRole('listitem').filter({ hasText: 'Dana Drag' });
    await menuCard.getByRole('button', { name: /Move to/ }).click();
    await page.getByRole('menuitem', { name: 'Refused' }).click();
    await page.getByLabel('Note (optional)').fill('Insufficient funds');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Dana Drag → Refused')).toBeVisible();
    const [dec] = await sql<{ stage: string; decision_reason: string; decided_at: string }>(`select c.stage, c.decision_reason, c.decided_at from cases c join applicants a on a.id = c.applicant_id join organizations o on o.id = c.org_id where a.full_name = 'Dana Drag' and o.name = $1`, [org]);
    expect(dec).toMatchObject({ stage: 'refused', decision_reason: 'Insufficient funds' });
    expect(dec.decided_at).toBeTruthy();
  });
});

test.describe('on a phone @phone', () => {
  test('every main screen fits the viewport and the key actions are reachable', async ({ page }) => {
    await bootstrap(page, { premium: true });
    await addApplicant(page, 'Maya Mobile');

    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    for (const path of ['/overview', '/applicants', '/pipeline', '/deadlines', '/tasks', '/activity', '/checklists', '/reports', '/settings', '/settings/team', '/settings/processing', '/settings/billing']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      expect(await overflow(), `${path} scrolls horizontally`).toBeLessThanOrEqual(1);
    }

    // navigation lives in a drawer
    await page.goto('/overview');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Applicants' }).click();
    await page.waitForURL('**/applicants');

    // applicants render as cards with the risk reason visible
    const card = page.getByRole('listitem').filter({ hasText: 'Maya Mobile' });
    await expect(card).toBeVisible();
    await expect(card.getByText(/Starts in 2\dd/)).toBeVisible();
    await page.screenshot({ path: 'test-results/applicants-phone.png' });

    // case detail: stage control and tabs are usable
    await card.getByRole('link', { name: 'Maya Mobile' }).click();
    await page.getByRole('button', { name: /Move to Documents/ }).click();
    await expect(page.getByText('Moved to Documents')).toBeVisible();
    await page.screenshot({ path: 'test-results/case-phone.png', fullPage: true });

    // the board scrolls sideways and "Move to…" works without dragging
    await page.goto('/pipeline');
    const c = page.getByRole('listitem').filter({ hasText: 'Maya Mobile' });
    await c.getByRole('button', { name: /Move to/ }).click();
    await page.getByRole('menuitem', { name: 'Appointment booked' }).click();
    await expect(page.getByText('Maya Mobile → Appointment')).toBeVisible();
    await page.screenshot({ path: 'test-results/pipeline-phone.png' });
  });
});
