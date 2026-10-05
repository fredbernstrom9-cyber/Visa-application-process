import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { bootstrap, sql } from './helpers';

const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 3100}`;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

async function setup(page: Page) {
  const ctx = await bootstrap(page, { premium: true });
  await page.goto('/checklists/new');
  await page.getByLabel('Template name').fill('Netherlands study');
  await page.getByLabel('Destination').selectOption('NL');
  await page.getByLabel('Visa type').selectOption('D');
  await page.getByRole('button', { name: 'Paste list' }).click();
  await page.getByPlaceholder(/Passport/).fill('Passport\nBank statement');
  await page.getByRole('button', { name: /Add 2 items/ }).click();
  await page.getByRole('button', { name: 'Save template' }).click();
  await page.waitForURL(/\/checklists\/[0-9a-f-]{36}/);
  await page.goto('/applicants');
  await page.getByRole('button', { name: /Add your first applicant/ }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Full name').fill('Priya Portal');
  await d.getByLabel('E-mail').fill('priya.portal@example.org');
  await d.getByLabel('Phone / WhatsApp').fill('+44 7700 900123');
  await d.getByLabel('Destination (EU / Schengen)').selectOption('NL');
  await d.getByLabel('Visa type').selectOption('D');
  await d.getByLabel('Start date').fill(iso(45));
  await d.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/);
  return { ...ctx, caseId: page.url().split('/').pop()! };
}

async function anonymous(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 } });
  return { page: await ctx.newPage(), ctx };
}

test.describe('documents, applicant portal and privacy', () => {
  test('staff upload with signed URLs, applicant portal upload, revocation', async ({ page, browser }) => {
    await sql('delete from rate_limits');
    const { caseId } = await setup(page);

    // staff upload to the first item
    await page.locator('input[type=file]').first().setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.getByText('passport.pdf')).toBeVisible();
    const passportItem = page.getByRole('listitem').filter({ hasText: 'Passport' }).first();
    await expect(passportItem.getByText('Received', { exact: true }).first()).toBeVisible();

    // downloads use a short-lived signed URL
    await page.evaluate(() => { (window as unknown as { __opened?: string }).__opened = undefined; window.open = ((u: string) => { (window as unknown as { __opened?: string }).__opened = u; return null; }) as typeof window.open; });
    await page.getByRole('button', { name: /^passport\.pdf/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __opened?: string }).__opened)).toMatch(/\/storage\/v1\/object\/sign\/case-documents\/.+\?token=/);

    // files are private: the object is not reachable without a signed token
    const stored = await sql<{ name: string }>(`select name from storage.objects where bucket_id = 'case-documents' and name like $1`, [`%/${caseId}/%`]);
    expect(stored).toHaveLength(1);
    const direct = await page.request.get(`http://127.0.0.1:54321/storage/v1/object/public/case-documents/${stored[0].name}`);
    expect(direct.ok()).toBe(false);

    // create a portal link
    await page.getByRole('tab', { name: 'Applicant portal' }).click();
    await page.getByLabel('Label (optional)').fill('WhatsApp');
    await page.getByRole('button', { name: 'Create link' }).click();
    const link = await page.getByLabel('Portal link').inputValue();
    expect(link).toMatch(/\/portal\/[A-Za-z0-9_-]{40,}$/);
    await expect(page.getByRole('link', { name: 'WhatsApp' }).first()).toBeVisible();
    const hash = await sql<{ token_hash: string }>(`select token_hash from portal_links where case_id = $1`, [caseId]);
    expect(hash[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(link).not.toContain(hash[0].token_hash);

    // the applicant opens it on a phone, without an account
    const { page: app, ctx } = await anonymous(browser);
    await app.goto(link.replace('127.0.0.1:3100', '127.0.0.1:' + (process.env.E2E_PORT || 3100)));
    await expect(app.getByRole('heading', { name: 'Hello Priya' })).toBeVisible();
    await expect(app.getByText('1 of 2 required documents sent')).toBeVisible();
    await expect(app.getByText('Bank statement')).toBeVisible();
    await app.screenshot({ path: 'test-results/portal-phone.png', fullPage: true });

    // wrong type is refused client-side
    await app.getByLabel('Upload file for Bank statement').setInputFiles({ name: 'evil.html', mimeType: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') });
    await expect(app.getByRole('alert').filter({ hasText: 'Please upload a PDF' })).toBeVisible();
    // a real upload goes through the signed-upload flow
    await app.getByLabel('Upload file for Bank statement').setInputFiles({ name: 'statement.png', mimeType: 'image/png', buffer: PNG });
    await expect(app.getByText(/Uploaded “statement.png”/)).toBeVisible();
    await expect(app.getByText('2 of 2 required documents sent')).toBeVisible();

    // the advisor sees it (attributed to the applicant) and verifies it
    await page.getByRole('tab', { name: 'Documents' }).click();
    await page.reload();
    const bank = page.getByRole('listitem').filter({ hasText: 'Bank statement' }).first();
    await expect(bank.getByText('statement.png')).toBeVisible();
    await expect(bank.getByText('Applicant', { exact: true })).toBeVisible();
    await bank.getByRole('button', { name: 'Verify' }).click();
    await expect(bank.getByText('Verified', { exact: true }).first()).toBeVisible();
    const events = await sql<{ actor_type: string; type: string }>(`select actor_type, type from activity_events where case_id = $1 and actor_type = 'applicant'`, [caseId]);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['document_uploaded']));

    // ...and the applicant's page reflects the check
    await app.reload();
    await expect(app.getByText('Checked').first()).toBeVisible();

    // revoke: the link stops working immediately
    await page.getByRole('tab', { name: 'Applicant portal' }).click();
    await page.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('Link revoked')).toBeVisible();
    await app.reload();
    await expect(app.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    await ctx.close();
  });

  test('guessing portal tokens reveals nothing and is rate limited', async ({ page, browser }) => {
    await sql('delete from rate_limits');
    const { page: anon, ctx } = await anonymous(browser);
    await anon.goto('/portal/not-a-real-token');
    await expect(anon.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    const fake = 'A'.repeat(43);
    for (let i = 0; i < 4; i++) {
      await anon.goto(`/portal/${fake.slice(0, 42)}${'BCDE'[i]}`);
      await expect(anon.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
    }
    const view = await anon.request.get('/portal/' + fake);
    expect(view.headers()['cache-control']).toContain('no-store');
    expect(view.headers()['x-robots-tag']).toContain('noindex');
    await ctx.close();
    void page;
  });

  test('GDPR: export an applicant’s data, then erase them with all files', async ({ page }) => {
    await sql('delete from rate_limits');
    const { caseId } = await setup(page);
    await page.locator('input[type=file]').first().setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.getByText('passport.pdf')).toBeVisible();
    const [{ org_id, applicant_id }] = await sql<{ org_id: string; applicant_id: string }>(`select org_id, applicant_id from cases where id = $1`, [caseId]);
    const dir = path.resolve('.stack/storage/case-documents', org_id, caseId);
    expect(filesUnder(dir)).toHaveLength(1);

    await page.getByRole('button', { name: 'More actions' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Export their data/ }).click()]);
    const exported = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
    expect(exported.applicant.full_name).toBe('Priya Portal');
    expect(exported.cases[0].checklist).toHaveLength(2);
    expect(exported.cases[0].files[0].file_name).toBe('passport.pdf');
    expect(JSON.stringify(exported)).not.toContain(org_id); // tenant ids are not part of a subject export

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: /Erase applicant/ }).click();
    await page.getByLabel(/Type “Priya Portal”/).fill('Priya Portal');
    await page.getByRole('button', { name: 'Erase permanently' }).click();
    await page.waitForURL('**/applicants');

    for (const t of ['applicants', 'cases', 'checklist_items', 'checklist_item_files', 'tasks', 'activity_events']) {
      const col = t === 'applicants' ? 'id' : t === 'cases' ? 'id' : 'case_id';
      const key = t === 'applicants' ? applicant_id : caseId;
      expect(await sql(`select 1 from ${t} where ${col} = $1`, [key]), t).toHaveLength(0);
    }
    expect(await sql(`select 1 from storage.objects where name like $1`, [`%/${caseId}/%`])).toHaveLength(0);
    expect(filesUnder(dir)).toEqual([]); // nothing left on disk
    const audit = await sql<{ action: string; metadata: unknown }>(`select action, metadata from audit_log where org_id = $1 and action = 'applicant.erased'`, [org_id]);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain('Priya');
  });
});
