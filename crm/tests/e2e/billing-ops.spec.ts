import { expect, test, type APIRequestContext } from '@playwright/test';
import Stripe from 'stripe';
import { bootstrap, sql } from './helpers';

const SECRET = 'whsec_e2e_secret';
const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 3100}`;

async function send(request: APIRequestContext, event: Record<string, unknown>, opts: { secret?: string } = {}) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? SECRET });
  return request.post(`${BASE}/api/stripe/webhook`, { data: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
}

// ids are unique per run: the dev database persists between runs, a repeated event id is (correctly) treated as a replay
// and stripe_customer_id is unique per organisation
const run = Math.random().toString(36).slice(2, 8);
const subEvent = (type: string, orgId: string, status: string, created: number, id = `evt_${Math.random().toString(36).slice(2)}`) => ({
  id, object: 'event', type, created, api_version: '2025-01-01', livemode: false, pending_webhooks: 0, request: null,
  data: { object: { id: `sub_${run}`, object: 'subscription', status, customer: `cus_${run}`, metadata: { org_id: orgId }, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } } },
});

test.describe('billing, reports and scheduled jobs', () => {
  test('Stripe webhooks upgrade and downgrade the plan safely', async ({ page, request }) => {
    const { org } = await bootstrap(page);
    const [{ id }] = await sql<{ id: string }>(`select id from organizations where name = $1`, [org]);
    await page.goto('/settings/billing');
    await expect(page.getByText('Free plan', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('One user and up to 10 applicants')).toBeVisible();
    await expect(page.getByRole('button', { name: /Upgrade to Premium/ })).toBeEnabled();

    // unsigned / wrongly signed / unconfigured requests are rejected
    expect((await request.post(`${BASE}/api/stripe/webhook`, { data: '{}' })).status()).toBe(400);
    expect((await send(request, subEvent('customer.subscription.created', id, 'active', 1000), { secret: 'whsec_wrong' })).status()).toBe(400);
    expect((await sql(`select plan from organizations where id = $1`, [id]))[0]).toEqual({ plan: 'free' });

    const now = Math.floor(Date.now() / 1000);
    const created = subEvent('customer.subscription.created', id, 'active', now, `evt_up_1_${run}`);
    expect((await send(request, created)).status()).toBe(200);
    const [row] = await sql<{ plan: string; subscription_status: string; stripe_customer_id: string; current_period_end: string }>(`select plan, subscription_status, stripe_customer_id, current_period_end from organizations where id = $1`, [id]);
    expect(row).toMatchObject({ plan: 'premium', subscription_status: 'active', stripe_customer_id: `cus_${run}` });
    expect(row.current_period_end).toBeTruthy();

    // replays are acknowledged but ignored
    const replay = await (await send(request, created)).json();
    expect(replay.duplicate).toBe(true);

    // the UI reflects it and premium features open up
    await page.reload();
    await expect(page.getByText('Unlimited applicants and seats.')).toBeVisible();
    await page.goto('/overview');
    await expect(page.getByText('Analytics dashboard is a Premium feature')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Dashboard filters' })).toBeVisible();

    // a stale "deleted" event delivered late must not downgrade
    expect((await send(request, subEvent('customer.subscription.deleted', id, 'canceled', now - 500, `evt_old_${run}`))).status()).toBe(200);
    expect((await sql(`select plan from organizations where id = $1`, [id]))[0]).toEqual({ plan: 'premium' });
    // past_due keeps Premium (grace period)
    await send(request, subEvent('customer.subscription.updated', id, 'past_due', now + 10, `evt_pd_${run}`));
    expect((await sql(`select plan, subscription_status from organizations where id = $1`, [id]))[0]).toEqual({ plan: 'premium', subscription_status: 'past_due' });
    // a genuine cancellation downgrades
    await send(request, subEvent('customer.subscription.deleted', id, 'canceled', now + 20, `evt_del_${run}`));
    expect((await sql(`select plan from organizations where id = $1`, [id]))[0]).toEqual({ plan: 'free' });
    const audit = await sql(`select 1 from audit_log where org_id = $1 and action = 'org.plan_changed'`, [id]);
    expect(audit).toHaveLength(2);
  });

  test('customers cannot grant themselves Premium', async ({ page }) => {
    const { org } = await bootstrap(page);
    // a forged cross-site request (browsers always send the real Origin) is refused before anything happens
    const res = (await page.request.post(`${BASE}/api/billing/checkout`, { headers: { Origin: 'https://evil.example' } })).status();
    expect([403]).toContain(res);
    const [{ plan }] = await sql<{ plan: string }>(`select plan from organizations where name = $1`, [org]);
    expect(plan).toBe('free');
  });

  test('PDF intake report is premium-only and renders a real PDF', async ({ page }) => {
    const free = await bootstrap(page);
    const denied = await page.request.get('/api/reports/intake');
    expect(denied.status()).toBe(402);
    await sql(`update organizations set plan = 'premium' where name = $1`, [free.org]);
    const ok = await page.request.get('/api/reports/intake?intake=Sep%202027');
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toBe('application/pdf');
    const body = await ok.body();
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Intake summary (PDF)' })).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Generate PDF' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^intake-summary-.*\.pdf$/);
    const unauth = await (await import('@playwright/test')).request.newContext({ baseURL: BASE });
    expect((await unauth.get('/api/reports/intake')).status()).toBe(401);
  });

  test('the daily job is protected, refreshes alerts and e-mails the digest', async ({ page, request }) => {
    expect((await request.get(`${BASE}/api/cron/daily`)).status()).toBe(401);
    expect((await request.get(`${BASE}/api/cron/daily`, { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);

    const { org } = await bootstrap(page, { premium: true });
    const [{ id, uid }] = await sql<{ id: string; uid: string }>(`select o.id, m.user_id uid from organizations o join memberships m on m.org_id = o.id where o.name = $1`, [org]);
    await page.goto('/settings/profile');
    await page.getByRole('switch', { name: 'E-mail notifications' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.getByText('Profile saved')).toBeVisible();

    // a case whose start date is imminent, with an overdue document
    const [{ cid }] = await sql<{ cid: string }>(`
      with a as (insert into applicants (org_id, full_name) values ($1, 'Late Larry') returning id),
      c as (insert into cases (org_id, applicant_id, destination, visa_type, start_date, assigned_to) select $1, id, 'FR', 'D', current_date + 400, $2 from a returning id)
      select id cid from c`, [id, uid]);
    await sql(`insert into checklist_items (org_id, case_id, label, due_date) values ($1, $2, 'Overdue passport', current_date - 3)`, [id, cid]);
    await sql(`update cases set start_date = current_date + 5 where id = $1`, [cid]);

    const res = await request.get(`${BASE}/api/cron/daily`, { headers: { authorization: 'Bearer e2e-cron-secret' } });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.digest.users).toBeGreaterThanOrEqual(1);

    const types = (await sql<{ type: string; emailed_at: string | null }>(`select type, emailed_at from notifications where case_id = $1`, [cid]));
    expect(types.map((t) => t.type)).toEqual(expect.arrayContaining(['case_high_risk', 'document_overdue']));
    expect(types.every((t) => t.emailed_at !== null)).toBe(true);

    await page.goto('/overview');
    await page.getByRole('button', { name: /unread notifications/ }).click();
    await expect(page.getByText('Overdue document: Overdue passport')).toBeVisible();
    await expect(page.getByText('Late Larry is now high risk')).toBeVisible();
  });
});
