import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { bootstrap, createOrg, PASSWORD, signUp, sql, uniqueEmail } from './helpers';

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 3100}`;
async function freshPage(browser: Browser): Promise<{ page: Page; ctx: BrowserContext }> {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1360, height: 860 } });
  return { page: await ctx.newPage(), ctx };
}

async function newApplicant(page: Page, name: string) {
  await page.goto('/applicants');
  await page.getByRole('button', { name: /New applicant|Add your first applicant/ }).first().click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Full name').fill(name);
  await d.getByLabel('Destination (EU / Schengen)').selectOption('NL');
  await d.getByLabel('Start date').fill(new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10));
  await d.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/);
  return page.url();
}

test.describe('teams, roles and tenant isolation', () => {
  test('invitations, advisor scoping, role changes and cross-organisation access', async ({ page: owner, browser }) => {
    await sql('delete from rate_limits');
    const { org } = await bootstrap(owner, { premium: true });
    const caseA = await newApplicant(owner, 'Alice Assigned');
    const caseB = await newApplicant(owner, 'Bob Unassigned');

    // owner invites an advisor
    const advisorEmail = uniqueEmail('advisor');
    await owner.goto('/settings/team');
    await owner.getByRole('button', { name: 'Invite teammate' }).click();
    await owner.getByLabel('E-mail').fill(advisorEmail);
    await owner.getByLabel('Role').selectOption('advisor');
    await owner.getByRole('button', { name: 'Send invitation' }).click();
    const link = await owner.getByLabel('Invitation link').inputValue();
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{40,}/);
    await owner.getByRole('button', { name: 'Done' }).click();
    await expect(owner.getByText('Pending invitations')).toBeVisible();
    // only a hash of the token is stored
    const stored = await sql<{ token_hash: string }>(`select token_hash from invitations where email = $1`, [advisorEmail]);
    expect(link).not.toContain(stored[0].token_hash);
    expect(stored[0].token_hash).toMatch(/^[0-9a-f]{64}$/);

    // someone else with the link can not use it
    const { page: intruder, ctx: intruderCtx } = await freshPage(browser);
    await signUp(intruder, uniqueEmail('intruder'), 'Ivy Intruder');
    await intruder.goto(link);
    await expect(intruder.getByText(/You are signed in as/)).toBeVisible();
    await expect(intruder.getByRole('button', { name: 'Accept and join' })).toHaveCount(0);
    await intruderCtx.close();

    // the invited advisor signs up and joins
    const { page: advisor, ctx: advisorCtx } = await freshPage(browser);
    await advisor.goto(link);
    await expect(advisor.getByText(/invited as Advisor/)).toBeVisible();
    await advisor.getByRole('link', { name: 'Create an account' }).click();
    await expect(advisor.getByLabel('Work e-mail')).toHaveValue(advisorEmail);
    await advisor.getByLabel('Your name').fill('Adam Advisor');
    await advisor.getByLabel('Password').fill(PASSWORD);
    await advisor.getByRole('button', { name: 'Create account' }).click();
    await advisor.waitForURL(/\/invite\//);
    await advisor.getByRole('button', { name: 'Accept and join' }).click();
    await advisor.waitForURL('**/overview');

    // advisors only see what is assigned to them
    await advisor.goto('/applicants');
    await expect(advisor.getByText('No applicants yet')).toBeVisible();
    await advisor.goto(caseA.replace(BASE, ''));
    await expect(advisor.getByRole('heading', { name: 'Case not found' })).toBeVisible();

    // owner assigns Alice to the advisor
    await owner.goto(caseA.replace(BASE, ''));
    await owner.getByLabel('Assigned advisor').selectOption({ label: 'Adam Advisor' });
    await expect(owner.getByLabel('Assigned advisor')).toHaveValue(/.+/);
    await advisor.goto('/applicants');
    await expect(advisor.getByRole('link', { name: 'Alice Assigned' })).toBeVisible();
    await expect(advisor.getByRole('link', { name: 'Bob Unassigned' })).toHaveCount(0);
    // ... and was notified about it
    await advisor.reload();
    await advisor.getByRole('button', { name: /unread notification/ }).click();
    await expect(advisor.getByText('Case assigned to you')).toBeVisible();
    await advisor.keyboard.press('Escape');

    // advisor cannot reach admin areas
    await advisor.goto('/settings/audit');
    await expect(advisor.getByText('Only owners and admins can see the audit log')).toBeVisible();
    await advisor.goto('/settings/team');
    await expect(advisor.getByRole('button', { name: 'Invite teammate' })).toHaveCount(0);
    await advisor.goto('/checklists/new');
    await expect(advisor.getByText('Only owners and admins can edit templates')).toBeVisible();

    // granting "view all" widens access; demoting to viewer removes write access
    await owner.goto('/settings/team');
    await owner.getByRole('checkbox', { name: /View all applicants/ }).click();
    await expect(owner.getByRole('checkbox', { name: /View all applicants/ })).toBeChecked();
    await advisor.goto('/applicants');
    await expect(advisor.getByRole('link', { name: 'Bob Unassigned' })).toBeVisible();
    await owner.getByLabel('Role for Adam Advisor').selectOption('viewer');
    await expect(owner.getByText('Role updated').first()).toBeVisible();
    await advisor.goto('/applicants');
    await expect(advisor.getByRole('button', { name: 'New applicant' })).toHaveCount(0);
    await advisor.goto(caseB.replace(BASE, ''));
    await expect(advisor.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    // a completely different organisation cannot see any of this
    const { page: other, ctx: otherCtx } = await freshPage(browser);
    await signUp(other, uniqueEmail('rival'), 'Rita Rival');
    await createOrg(other, 'Rival Org');
    await other.goto(caseA.replace(BASE, ''));
    await expect(other.getByRole('heading', { name: 'Case not found' })).toBeVisible();
    await other.goto('/applicants');
    await expect(other.getByText('No applicants yet')).toBeVisible();
    await other.goto('/settings/team');
    await expect(other.getByText('Adam Advisor')).toHaveCount(0);

    // role change was audited
    const audit = await sql(`select 1 from audit_log a join organizations o on o.id = a.org_id where o.name = $1 and a.action = 'member.role_changed'`, [org]);
    expect(audit.length).toBeGreaterThan(0);
    await advisorCtx.close();
    await otherCtx.close();
  });
});
