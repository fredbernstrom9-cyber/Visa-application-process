import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, DB_URL, rejects, type TestDb } from './helpers';

const d = describe.skipIf(!DB_URL);

interface Seed {
  org: string; owner: string; admin: string; advisor: string; advisor2: string; viewer: string;
  applicant: string; case: string; template: string; templateItem: string; item: string;
  file: string; task: string; portal: string; view: string;
}

let db: TestDb;
let A: Seed;
let B: Seed;

async function seed(label: string): Promise<Seed> {
  const owner = await db.user(`owner-${label}@test.dev`);
  const admin = await db.user(`admin-${label}@test.dev`);
  const advisor = await db.user(`advisor-${label}@test.dev`);
  const advisor2 = await db.user(`advisor2-${label}@test.dev`);
  const viewer = await db.user(`viewer-${label}@test.dev`);
  const org = await db.org(owner, `Org ${label}`, 'premium');
  await db.addMember(org, admin, 'admin');
  await db.addMember(org, advisor, 'advisor');
  await db.addMember(org, advisor2, 'advisor');
  await db.addMember(org, viewer, 'viewer');

  const [tpl] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into checklist_templates (org_id, name, destination, visa_type) values ($1,'FR long stay','FR','D') returning id`, [org]));
  const [tplItem] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into checklist_template_items (org_id, template_id, label, due_days_before_start) values ($1,$2,'Passport',30) returning id`, [org, tpl.id]));
  const [applicant] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into applicants (org_id, full_name, email, nationality) values ($1,$2,$3,'IN') returning id`,
    [org, `Applicant ${label}`, `applicant-${label}@x.test`]));
  const [kase] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into cases (org_id, applicant_id, destination, visa_type, start_date, assigned_to, intake)
     values ($1,$2,'FR','D', current_date + 60, $3, '2026-09') returning id`, [org, applicant.id, advisor]));
  const [item] = await db.admin<{ id: string }>(`select id from checklist_items where case_id = $1`, [kase.id]);
  const [file] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into checklist_item_files (org_id, case_id, item_id, storage_path, file_name)
     values ($1,$2,$3,$4,'passport.pdf') returning id`,
    [org, kase.id, item.id, `${org}/${kase.id}/${item.id}/passport.pdf`]));
  const [task] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into tasks (org_id, case_id, title, assignee_id) values ($1,$2,'Call applicant',$3) returning id`, [org, kase.id, advisor]));
  const [portal] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into portal_links (org_id, case_id, token_hash, expires_at, created_by)
     values ($1,$2,$3, now() + interval '7 days', $4) returning id`, [org, kase.id, `hash-${label}`, owner]));
  const [view] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into saved_views (org_id, user_id, name, config) values ($1,$2,'Mine','{}') returning id`, [org, owner]));
  return {
    org, owner, admin, advisor, advisor2, viewer, applicant: applicant.id, case: kase.id,
    template: tpl.id, templateItem: tplItem.id, item: item.id, file: file.id, task: task.id,
    portal: portal.id, view: view.id,
  };
}

beforeAll(async () => {
  if (!DB_URL) return;
  db = await createTestDb();
  A = await seed('a');
  B = await seed('b');
}, 120_000);

afterAll(async () => {
  if (db) await db.drop();
});

const ORG_TABLES = [
  'org_settings', 'processing_times', 'memberships', 'invitations', 'applicants', 'cases',
  'case_stage_history', 'activity_events', 'audit_log', 'notifications', 'checklist_templates',
  'checklist_template_items', 'checklist_items', 'checklist_item_files', 'tasks', 'portal_links', 'saved_views',
];
const VIEWS = ['case_overview', 'activity_feed', 'member_directory', 'deadline_items'];

d('tenant isolation (org A cannot see or touch org B)', () => {
  it('seed produced data in every tenant table for both orgs (sanity)', async () => {
    for (const t of ORG_TABLES) {
      if (['invitations', 'processing_times', 'notifications'].includes(t)) continue;
      const [r] = await db.admin<{ n: string }>(`select count(*) n from ${t} where org_id = $1`, [B.org]);
      expect(Number(r.n), `${t} should have rows for org B`).toBeGreaterThan(0);
    }
  });

  it.each([['owner'], ['admin'], ['advisor'], ['viewer']] as const)('%s of A reads zero org-B rows from every table', async (role) => {
    const uid = A[role];
    for (const t of ORG_TABLES) {
      const [r] = await db.as(uid, (q) => q<{ n: string }>(`select count(*) n from ${t} where org_id = $1`, [B.org]));
      expect(Number(r.n), `${t} leaked to ${role}`).toBe(0);
    }
    for (const v of VIEWS) {
      const [r] = await db.as(uid, (q) => q<{ n: string }>(`select count(*) n from ${v} where org_id = $1`, [B.org]));
      expect(Number(r.n), `${v} leaked to ${role}`).toBe(0);
    }
    const orgs = await db.as(uid, (q) => q<{ id: string }>(`select id from organizations`));
    expect(orgs.map((o) => o.id)).toEqual([A.org]);
  });

  it('A cannot read B profiles', async () => {
    const rows = await db.as(A.owner, (q) => q<{ id: string }>(`select id from profiles`));
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has(B.owner)).toBe(false);
    expect(ids.has(A.advisor)).toBe(true);
  });

  it('A cannot update or delete B rows (0 rows affected)', async () => {
    const upd = await db.as(A.owner, (q) => q(`update cases set notes = 'pwned' where id = $1 returning id`, [B.case]));
    expect(upd).toHaveLength(0);
    const upd2 = await db.as(A.owner, (q) => q(`update applicants set full_name = 'pwned' where id = $1 returning id`, [B.applicant]));
    expect(upd2).toHaveLength(0);
    const upd3 = await db.as(A.owner, (q) => q(`update checklist_items set comment = 'pwned' where id = $1 returning id`, [B.item]));
    expect(upd3).toHaveLength(0);
    const upd4 = await db.as(A.owner, (q) => q(`update tasks set title = 'pwned' where id = $1 returning id`, [B.task]));
    expect(upd4).toHaveLength(0);
    const upd5 = await db.as(A.owner, (q) => q(`update organizations set name = 'pwned' where id = $1 returning id`, [B.org]));
    expect(upd5).toHaveLength(0);
    for (const [t, id] of [['cases', B.case], ['applicants', B.applicant], ['checklist_items', B.item], ['tasks', B.task],
      ['checklist_item_files', B.file], ['checklist_templates', B.template], ['saved_views', B.view]] as const) {
      const del = await db.as(A.owner, (q) => q(`delete from ${t} where id = $1 returning id`, [id]));
      expect(del, `delete ${t}`).toHaveLength(0);
    }
    const [still] = await db.admin<{ n: string }>(`select count(*) n from cases where id = $1 and notes is null`, [B.case]);
    expect(Number(still.n)).toBe(1);
  });

  it('A cannot insert rows into org B', async () => {
    await rejects(db.as(A.owner, (q) => q(
      `insert into applicants (org_id, full_name) values ($1,'x')`, [B.org])), /row-level security/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into cases (org_id, applicant_id, destination) values ($1,$2,'FR')`, [B.org, B.applicant])), /row-level security/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into tasks (org_id, case_id, title) values ($1,$2,'x')`, [B.org, B.case])), /row-level security/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into memberships (org_id, user_id, role) values ($1,$2,'owner')`, [B.org, A.owner])), /permission denied/);
  });

  it('A cannot attach A-owned rows to a B parent (composite same-tenant FKs)', async () => {
    await rejects(db.as(A.owner, (q) => q(
      `insert into cases (org_id, applicant_id, destination) values ($1,$2,'FR')`, [A.org, B.applicant])), /foreign key|violates/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into tasks (org_id, case_id, title) values ($1,$2,'x')`, [A.org, B.case])), /foreign key|violates/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into checklist_items (org_id, case_id, label) values ($1,$2,'x')`, [A.org, B.case])), /foreign key|violates/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into portal_links (org_id, case_id, token_hash, expires_at, created_by) values ($1,$2,'h', now() + interval '1 day', $3)`,
      [A.org, B.case, A.owner])), /foreign key|violates/);
  });

  it('A cannot reassign rows to org B or reassign assignees across tenants', async () => {
    await rejects(db.as(A.owner, (q) => q(`update cases set org_id = $2 where id = $1`, [A.case, B.org])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`update cases set assigned_to = $2 where id = $1`, [A.case, B.advisor])), /invalid_assignee/);
    await rejects(db.as(A.owner, (q) => q(
      `insert into tasks (org_id, case_id, title, assignee_id) values ($1,$2,'x',$3)`, [A.org, A.case, B.owner])), /invalid_assignee/);
  });

  it('B tables are not reachable by anon', async () => {
    for (const t of ['cases', 'applicants', 'organizations', 'profiles']) {
      await rejects(db.anon((q) => q(`select * from ${t}`)), /permission denied/);
    }
    await rejects(db.anon((q) => q(`select * from public.filtered_cases($1)`, [A.org])), /permission denied/);
  });

  it('RPCs refuse cross-tenant calls', async () => {
    await rejects(db.as(A.owner, (q) => q(`select public.erase_applicant($1)`, [B.applicant])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.erasure_file_paths($1)`, [B.applicant])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.export_applicant_data($1)`, [B.applicant])), /not_found/);
    await rejects(db.as(A.owner, (q) => q(`select public.delete_organization($1)`, [B.org])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.set_member_role($1,$2,'viewer')`, [B.org, B.advisor])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.remove_member($1,$2)`, [B.org, B.advisor])), /not_found/);
    await rejects(db.as(A.owner, (q) => q(`select public.apply_checklist_template($1::uuid[], $2)`, [[B.case], B.template])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.apply_checklist_template($1::uuid[], $2)`, [[A.case], B.template])), /forbidden/);
    const [kpi] = await db.as(A.owner, (q) => q<{ k: { current: { total: number } } }>(`select public.analytics_kpis($1, '{}') k`, [B.org]));
    expect(kpi.k.current.total).toBe(0);
    await rejects(db.as(A.owner, (q) => q(`delete from portal_links where id = $1`, [B.portal])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`select public.touch_maintenance($1)`, [B.org])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.log_client_activity($1, 'import_completed', '{}')`, [B.org])), /forbidden/);
    const rows = await db.as(A.owner, (q) => q(`select * from public.filtered_cases($1)`, [B.org]));
    expect(rows).toHaveLength(0);
    const opts = await db.as(A.owner, (q) => q<{ o: { intakes: string[] } }>(`select public.filter_options($1) o`, [B.org]));
    expect(opts[0].o.intakes).toEqual([]);
  });

  it('service-only functions are not callable by users', async () => {
    await rejects(db.as(A.owner, (q) => q(`select public.rate_limit_hit('k', 1, 1)`)), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`select public.run_maintenance()`)), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`select public.portal_get('hash-b')`)), /permission denied/);
  });

  it('portal RPCs only resolve the case behind the token', async () => {
    const got = await db.service((q) => q<{ r: { case_id: string; items: unknown[] } | null }>(`select public.portal_get('hash-a') r`));
    expect(got[0].r?.case_id).toBe(A.case);
    const bad = await db.service((q) => q<{ r: unknown }>(`select public.portal_get('nope') r`));
    expect(bad[0].r).toBeNull();
    // an item of case B can never be registered through A's token
    await rejects(db.service((q) => q(
      `select public.portal_register_file('hash-a', $1, $2, 'x.pdf', 'application/pdf', 10)`,
      [B.item, `${A.org}/${A.case}/${B.item}/x.pdf`])), /item_case_mismatch/);
  });
});

d('roles inside one organisation', () => {
  it('viewer reads everything but cannot write', async () => {
    const cases = await db.as(A.viewer, (q) => q(`select id from cases`));
    expect(cases).toHaveLength(1);
    await rejects(db.as(A.viewer, (q) => q(`insert into applicants (org_id, full_name) values ($1,'x')`, [A.org])), /row-level security/);
    const upd = await db.as(A.viewer, (q) => q(`update cases set notes = 'x' where id = $1 returning id`, [A.case]));
    expect(upd).toHaveLength(0);
    await rejects(db.as(A.viewer, (q) => q(`insert into tasks (org_id, case_id, title) values ($1,$2,'x')`, [A.org, A.case])), /row-level security/);
  });

  it('advisor sees only assigned cases; unassigned advisor sees none', async () => {
    const own = await db.as(A.advisor, (q) => q(`select id from case_overview`));
    expect(own).toHaveLength(1);
    const none = await db.as(A.advisor2, (q) => q(`select id from case_overview`));
    expect(none).toHaveLength(0);
    for (const t of ['applicants', 'checklist_items', 'tasks', 'activity_events', 'checklist_item_files', 'case_stage_history']) {
      const rows = await db.as(A.advisor2, (q) => q(`select 1 from ${t}`));
      expect(rows, `${t} visible to unassigned advisor`).toHaveLength(0);
    }
    const upd = await db.as(A.advisor2, (q) => q(`update cases set notes = 'x' where id = $1 returning id`, [A.case]));
    expect(upd).toHaveLength(0);
    await rejects(db.as(A.advisor2, (q) => q(`insert into tasks (org_id, case_id, title) values ($1,$2,'x')`, [A.org, A.case])), /row-level security/);
  });

  it('advisor can_view_all grants org-wide read', async () => {
    await db.admin(`update memberships set can_view_all = true where org_id = $1 and user_id = $2`, [A.org, A.advisor2]);
    const rows = await db.as(A.advisor2, (q) => q(`select id from case_overview`));
    expect(rows).toHaveLength(1);
    await db.admin(`update memberships set can_view_all = false where org_id = $1 and user_id = $2`, [A.org, A.advisor2]);
  });

  it('an advisor who creates an applicant+case is auto-assigned and can see it', async () => {
    const res = await db.as(A.advisor2, async (q) => {
      const [a] = await q<{ id: string }>(`insert into applicants (org_id, full_name) values ($1,'Mine') returning id`, [A.org]);
      const [c] = await q<{ id: string; assigned_to: string }>(
        `insert into cases (org_id, applicant_id, destination) values ($1,$2,'DE') returning id, assigned_to`, [A.org, a.id]);
      return c;
    });
    expect(res.assigned_to).toBe(A.advisor2);
    const seen = await db.as(A.advisor2, (q) => q(`select id from case_overview`));
    expect(seen).toHaveLength(1);
    const owner = await db.as(A.owner, (q) => q(`select id from case_overview`));
    expect(owner).toHaveLength(2);
    await db.admin(`delete from applicants where org_id = $1 and full_name = 'Mine'`, [A.org]);
  });

  it('only owners/admins delete, manage templates, settings, invitations and see the audit log', async () => {
    const del = await db.as(A.advisor, (q) => q(`delete from cases where id = $1 returning id`, [A.case]));
    expect(del).toHaveLength(0);
    await rejects(db.as(A.advisor, (q) => q(`insert into checklist_templates (org_id, name, destination, visa_type) values ($1,'x','DE','C')`, [A.org])), /row-level security/);
    const upd = await db.as(A.advisor, (q) => q(`update org_settings set default_processing_days = 99 where org_id = $1 returning org_id`, [A.org]));
    expect(upd).toHaveLength(0);
    expect(await db.as(A.advisor, (q) => q(`select 1 from audit_log`))).toHaveLength(0);
    expect(await db.as(A.viewer, (q) => q(`select 1 from audit_log`))).toHaveLength(0);
    expect((await db.as(A.admin, (q) => q(`select 1 from audit_log`))).length).toBeGreaterThan(0);
    expect(await db.as(A.advisor, (q) => q(`select 1 from invitations`))).toHaveLength(0);
  });
});

d('privileged columns and append-only tables', () => {
  it('billing columns cannot be changed by customers', async () => {
    await rejects(db.as(A.owner, (q) => q(`update organizations set plan = 'premium' where id = $1`, [A.org])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`update organizations set stripe_customer_id = 'cus_x' where id = $1`, [A.org])), /permission denied/);
    const ok = await db.as(A.owner, (q) => q(`update organizations set name = 'Org A renamed' where id = $1 returning id`, [A.org]));
    expect(ok).toHaveLength(1);
  });

  it('system-managed case columns cannot be forged', async () => {
    await rejects(db.as(A.owner, (q) => q(`update cases set docs_verified = 99 where id = $1`, [A.case])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`update cases set max_stage_ord = 6 where id = $1`, [A.case])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`update checklist_items set verified_by = $2 where id = $1`, [A.item, A.owner])), /permission denied/);
  });

  it('activity, audit, stage history and notifications are not writable by clients', async () => {
    await rejects(db.as(A.owner, (q) => q(`insert into activity_events (org_id, type) values ($1,'fake')`, [A.org])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`insert into audit_log (org_id, action, entity_type) values ($1,'fake','x')`, [A.org])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`update audit_log set metadata = '{}' where org_id = $1`, [A.org])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`delete from audit_log where org_id = $1`, [A.org])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`insert into case_stage_history (org_id, case_id, stage) values ($1,$2,'approved')`, [A.org, A.case])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`insert into notifications (org_id, user_id, type, title, dedupe_key) values ($1,$2,'x','x','x')`, [A.org, A.owner])), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`select * from rate_limits`)), /permission denied/);
    await rejects(db.as(A.owner, (q) => q(`select * from case_risk_cache`)), /permission denied/);
  });

  it('log_client_activity only accepts whitelisted types', async () => {
    await rejects(db.as(A.owner, (q) => q(`select public.log_client_activity($1, 'stage_changed', '{}')`, [A.org])), /invalid_activity_type/);
    await db.as(A.owner, (q) => q(`select public.log_client_activity($1, 'import_completed', '{"count": 3}')`, [A.org]));
  });

  it('memberships change only through audited RPCs', async () => {
    await rejects(db.as(A.owner, (q) => q(`update memberships set role = 'owner' where user_id = $1`, [A.viewer])), /permission denied/);
    await rejects(db.as(A.admin, (q) => q(`select public.set_member_role($1,$2,'owner')`, [A.org, A.viewer])), /forbidden/);
    await rejects(db.as(A.admin, (q) => q(`select public.set_member_role($1,$2,'viewer')`, [A.org, A.owner])), /forbidden/);
    await rejects(db.as(A.advisor, (q) => q(`select public.set_member_role($1,$2,'admin')`, [A.org, A.advisor])), /forbidden/);
    await rejects(db.as(A.owner, (q) => q(`select public.set_member_role($1,$2,'advisor')`, [A.org, A.owner])), /last_owner/);
    await rejects(db.as(A.owner, (q) => q(`select public.remove_member($1,$2)`, [A.org, A.owner])), /last_owner/);
    await db.as(A.owner, (q) => q(`select public.set_member_role($1,$2,'advisor', true)`, [A.org, A.viewer]));
    const [m] = await db.admin<{ role: string; can_view_all: boolean }>(`select role, can_view_all from memberships where org_id=$1 and user_id=$2`, [A.org, A.viewer]);
    expect(m).toEqual({ role: 'advisor', can_view_all: true });
    await db.as(A.owner, (q) => q(`select public.set_member_role($1,$2,'viewer')`, [A.org, A.viewer]));
    const audit = await db.admin<{ action: string }>(`select action from audit_log where org_id=$1 and action='member.role_changed'`, [A.org]);
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });

  it('removing a member unassigns their cases and writes an audit entry', async () => {
    const u = await db.user('temp-a@test.dev');
    await db.addMember(A.org, u, 'advisor');
    const [ap] = await db.as(u, (q) => q<{ id: string }>(`insert into applicants (org_id, full_name) values ($1,'Temp') returning id`, [A.org]));
    const [c] = await db.as(u, (q) => q<{ id: string }>(`insert into cases (org_id, applicant_id, destination) values ($1,$2,'ES') returning id`, [A.org, ap.id]));
    await db.as(A.owner, (q) => q(`select public.remove_member($1,$2)`, [A.org, u]));
    const [row] = await db.admin<{ assigned_to: string | null }>(`select assigned_to from cases where id = $1`, [c.id]);
    expect(row.assigned_to).toBeNull();
    expect(await db.as(u, (q) => q(`select 1 from cases`))).toHaveLength(0);
    const audit = await db.admin(`select 1 from audit_log where org_id=$1 and action='member.removed'`, [A.org]);
    expect(audit).toHaveLength(1);
    await db.admin(`delete from applicants where id = $1`, [ap.id]);
  });
});

d('invitations', () => {
  it('admins create invitations; accept requires the invited verified e-mail and a valid token', async () => {
    const token = 'tok_' + 'x'.repeat(40);
    const hashRows = await db.admin<{ h: string }>(`select encode(sha256(convert_to($1,'UTF8')),'hex') h`, [token]);
    await db.as(A.admin, (q) => q(
      `insert into invitations (org_id, email, role, token_hash, invited_by) values ($1,'newbie@test.dev','advisor',$2,$3)`,
      [A.org, hashRows[0].h, A.admin]));
    const newbie = await db.user('newbie@test.dev');
    const intruder = await db.user('intruder@test.dev');
    await rejects(db.as(intruder, (q) => q(`select public.accept_invitation($1)`, [token])), /invitation_email_mismatch/);
    await rejects(db.as(newbie, (q) => q(`select public.accept_invitation('wrong')`)), /invalid_invitation/);
    const [r] = await db.as(newbie, (q) => q<{ id: string }>(`select public.accept_invitation($1) id`, [token]));
    expect(r.id).toBe(A.org);
    await rejects(db.as(newbie, (q) => q(`select public.accept_invitation($1)`, [token])), /invalid_invitation/);
    const [m] = await db.admin<{ role: string }>(`select role from memberships where org_id=$1 and user_id=$2`, [A.org, newbie]);
    expect(m.role).toBe('advisor');
  });

  it('owner role cannot be invited and tokens are never stored in clear text', async () => {
    await rejects(db.as(A.admin, (q) => q(
      `insert into invitations (org_id, email, role, token_hash, invited_by) values ($1,'o@test.dev','owner','h',$2)`, [A.org, A.admin])), /check constraint|violates/);
    await rejects(db.as(A.advisor, (q) => q(
      `insert into invitations (org_id, email, role, token_hash, invited_by) values ($1,'x@test.dev','viewer','h2',$2)`, [A.org, A.advisor])), /row-level security/);
  });
});

d('storage policies', () => {
  const path = (s: Seed, caseId = s.case) => `${s.org}/${caseId}/${s.item}/doc.pdf`;

  it('members upload and read only inside their tenant and case scope', async () => {
    await db.as(A.owner, (q) => q(`insert into storage.objects (bucket_id, name) values ('case-documents', $1)`, [path(A)]));
    expect(await db.as(A.advisor, (q) => q(`select 1 from storage.objects where bucket_id='case-documents'`))).toHaveLength(1);
    expect(await db.as(A.advisor2, (q) => q(`select 1 from storage.objects where bucket_id='case-documents'`))).toHaveLength(0);
    expect(await db.as(B.owner, (q) => q(`select 1 from storage.objects where bucket_id='case-documents'`))).toHaveLength(0);
    expect(await db.as(A.viewer, (q) => q(`select 1 from storage.objects where bucket_id='case-documents'`))).toHaveLength(1);
    await rejects(db.as(A.viewer, (q) => q(`insert into storage.objects (bucket_id, name) values ('case-documents', $1)`, [`${A.org}/${A.case}/${A.item}/v.pdf`])), /row-level security/);
    await rejects(db.as(B.owner, (q) => q(`insert into storage.objects (bucket_id, name) values ('case-documents', $1)`, [`${A.org}/${A.case}/${A.item}/evil.pdf`])), /row-level security/);
    await rejects(db.as(A.owner, (q) => q(`insert into storage.objects (bucket_id, name) values ('case-documents', $1)`, [`${B.org}/${B.case}/${B.item}/evil.pdf`])), /row-level security/);
    await rejects(db.as(A.owner, (q) => q(`insert into storage.objects (bucket_id, name) values ('case-documents', 'not/a/uuid/path.pdf')`)), /row-level security/);
    const del = await db.as(B.owner, (q) => q(`delete from storage.objects where name = $1 returning id`, [path(A)]));
    expect(del).toHaveLength(0);
  });

  it('bucket is private with size and type limits', async () => {
    const [b] = await db.admin<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'case-documents'`);
    expect(b.public).toBe(false);
    expect(Number(b.file_size_limit)).toBe(10 * 1024 * 1024);
    expect(b.allowed_mime_types).toContain('application/pdf');
    expect(b.allowed_mime_types).not.toContain('text/html');
  });
});

d('database-enforced plan limits', () => {
  it('free plan: 1 seat, 10 applicants, no analytics/import/portal', async () => {
    const owner = await db.user('free-owner@test.dev');
    const second = await db.user('free-second@test.dev');
    const org = await db.org(owner, 'Free Org', 'free');
    await rejects(db.admin(`insert into memberships (org_id, user_id, role) values ($1,$2,'viewer')`, [org, second]), /plan_limit:seats/);
    await rejects(db.as(owner, (q) => q(
      `insert into invitations (org_id, email, role, token_hash, invited_by) values ($1,'x@y.dev','viewer','hh',$2)`, [org, owner])), /plan_limit:seats/);
    for (let i = 0; i < 10; i++) {
      await db.as(owner, (q) => q(`insert into applicants (org_id, full_name) values ($1,$2)`, [org, `P${i}`]));
    }
    await rejects(db.as(owner, (q) => q(`insert into applicants (org_id, full_name) values ($1,'P11')`, [org])), /plan_limit:applicants/);
    await rejects(db.as(owner, (q) => q(`select public.analytics_kpis($1,'{}')`, [org])), /feature_not_available:analytics/);
    await rejects(db.as(owner, (q) => q(`select public.import_rows($1,'[]')`, [org])), /feature_not_available:import/);
    const [ap] = await db.admin<{ id: string }>(`select id from applicants where org_id = $1 limit 1`, [org]);
    const [c] = await db.as(owner, (q) => q<{ id: string }>(`insert into cases (org_id, applicant_id, destination) values ($1,$2,'FR') returning id`, [org, ap.id]));
    await rejects(db.as(owner, (q) => q(
      `insert into portal_links (org_id, case_id, token_hash, expires_at, created_by) values ($1,$2,'fh', now() + interval '1 day', $3)`,
      [org, c.id, owner])), /row-level security/);
    // upgrading lifts every limit
    await db.admin(`update organizations set plan = 'premium' where id = $1`, [org]);
    await db.as(owner, (q) => q(`insert into applicants (org_id, full_name) values ($1,'P12')`, [org]));
    await db.admin(`insert into memberships (org_id, user_id, role) values ($1,$2,'viewer')`, [org, second]);
    const audit = await db.admin(`select 1 from audit_log where org_id = $1 and action = 'org.plan_changed'`, [org]);
    expect(audit).toHaveLength(1);
  });

  it('plan tables match the documented feature matrix', async () => {
    const limits = await db.admin<{ plan: string; max_seats: number | null; max_applicants: number | null }>(`select * from plan_limits order by plan`);
    expect(limits).toEqual([
      { plan: 'free', max_seats: 1, max_applicants: 10 },
      { plan: 'premium', max_seats: null, max_applicants: null },
    ]);
    const feats = await db.admin<{ plan: string; feature: string }>(`select * from plan_features where plan='premium' order by feature`);
    expect(feats.map((f) => f.feature)).toEqual(['analytics', 'export', 'import', 'live_tracking', 'portal', 'reports']);
    expect(await db.admin(`select 1 from plan_features where plan='free'`)).toHaveLength(0);
  });
});

d('realtime publication', () => {
  it('publishes the live tables', async () => {
    const rows = await db.admin<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`);
    const names = rows.map((r) => r.tablename);
    for (const t of ['cases', 'checklist_items', 'tasks', 'activity_events', 'notifications', 'applicants']) {
      expect(names).toContain(t);
    }
  });
});
