import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, DB_URL, rejects, type TestDb } from './helpers';

const d = describe.skipIf(!DB_URL);

let db: TestDb;
let owner: string, admin: string, advisor: string, other: string, org: string;

const day = async (offset: number) =>
  (await db.admin<{ d: string }>(`select (current_date + $1::int)::text d`, [offset]))[0].d;

async function newCase(opts: { dest?: string; visa?: string; start?: number | null; assigned?: string | null; nationality?: string; name?: string } = {}) {
  const start = opts.start === undefined ? 90 : opts.start;
  const sd = start === null ? null : await day(start);
  const [ap] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into applicants (org_id, full_name, nationality) values ($1,$2,$3) returning id`,
    [org, opts.name ?? 'Test Person', opts.nationality ?? 'IN']));
  const [c] = await db.as(owner, (q) => q<{ id: string }>(
    `insert into cases (org_id, applicant_id, destination, visa_type, start_date, assigned_to)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [org, ap.id, opts.dest ?? 'FR', opts.visa ?? 'D', sd, opts.assigned ?? null]));
  return { applicant: ap.id, case: c.id };
}

beforeAll(async () => {
  if (!DB_URL) return;
  db = await createTestDb();
  owner = await db.user('o@w.test', 'Olga Owner');
  admin = await db.user('a@w.test', 'Adam Admin');
  advisor = await db.user('p@w.test', 'Pia Advisor');
  other = await db.user('x@w.test', 'Xavier Other');
  org = await db.org(owner, 'Workflow Org', 'premium');
  await db.addMember(org, admin, 'admin');
  await db.addMember(org, advisor, 'advisor');
  await db.addMember(org, other, 'advisor');
}, 120_000);

afterAll(async () => { if (db) await db.drop(); });

d('checklists', () => {
  it('auto-applies the most specific matching template with due dates, and counts documents', async () => {
    const [generic] = await db.as(owner, (q) => q<{ id: string }>(
      `insert into checklist_templates (org_id, name, destination, visa_type, official_source_name, source_last_checked)
       values ($1,'DE generic','DE','D','Auswaertiges Amt', current_date) returning id`, [org]));
    await db.as(owner, (q) => q(
      `insert into checklist_template_items (org_id, template_id, label, required, due_days_before_start, sort_order)
       values ($1,$2,'Passport',true,60,1), ($1,$2,'Photo',true,null,2), ($1,$2,'Optional cover letter',false,null,3)`, [org, generic.id]));
    const [ng] = await db.as(owner, (q) => q<{ id: string }>(
      `insert into checklist_templates (org_id, name, destination, visa_type, nationality) values ($1,'DE NG','DE','D','NG') returning id`, [org]));
    await db.as(owner, (q) => q(
      `insert into checklist_template_items (org_id, template_id, label, sort_order) values ($1,$2,'Police certificate',1)`, [org, ng.id]));

    const generalCase = await newCase({ dest: 'DE', start: 100, nationality: 'IN' });
    const items = await db.admin<{ label: string; due_date: string | null }>(
      `select label, due_date::text from checklist_items where case_id = $1 order by sort_order`, [generalCase.case]);
    expect(items.map((i) => i.label)).toEqual(['Passport', 'Photo', 'Optional cover letter']);
    expect(items[0].due_date).toBe(await day(40));
    expect(items[1].due_date).toBeNull();

    const ngCase = await newCase({ dest: 'DE', start: 100, nationality: 'NG' });
    const ngItems = await db.admin<{ label: string }>(`select label from checklist_items where case_id = $1`, [ngCase.case]);
    expect(ngItems.map((i) => i.label)).toEqual(['Police certificate']);

    const [counts] = await db.admin<{ docs_total: number; docs_verified: number }>(
      `select docs_total, docs_verified from cases where id = $1`, [generalCase.case]);
    expect(counts).toEqual({ docs_total: 2, docs_verified: 0 }); // optional item is not counted

    // applying later is idempotent and also works with an explicit template
    const added = await db.as(owner, (q) => q<{ n: number }>(`select public.apply_checklist_template($1::uuid[], $2) n`, [[generalCase.case], generic.id]));
    expect(added[0].n).toBe(0);
    const viaAuto = await db.as(owner, (q) => q<{ n: number }>(`select public.apply_checklist_template($1::uuid[], $2) n`, [[ngCase.case], generic.id]));
    expect(viaAuto[0].n).toBe(3);
  });

  it('verification updates counters, stamps the verifier, and writes activity + audit', async () => {
    const c = await newCase({ dest: 'DE', start: 100 });
    const [item] = await db.admin<{ id: string }>(`select id from checklist_items where case_id = $1 and label = 'Passport'`, [c.case]);
    await db.as(owner, (q) => q(`update checklist_items set status = 'verified' where id = $1`, [item.id]));
    const [row] = await db.admin<{ docs_verified: number; docs_total: number }>(`select docs_verified, docs_total from cases where id = $1`, [c.case]);
    expect(row).toEqual({ docs_verified: 1, docs_total: 2 });
    const [it] = await db.admin<{ verified_by: string | null }>(`select verified_by from checklist_items where id = $1`, [item.id]);
    expect(it.verified_by).toBe(owner);
    const ev = await db.admin<{ type: string; actor_id: string; payload: { to: string } }>(
      `select type, actor_id, payload from activity_events where case_id = $1 and type = 'document_status_changed'`, [c.case]);
    expect(ev).toHaveLength(1);
    expect(ev[0].actor_id).toBe(owner);
    expect(ev[0].payload.to).toBe('verified');
    const au = await db.admin(`select 1 from audit_log where entity_id = $1 and action = 'document.verified'`, [item.id]);
    expect(au).toHaveLength(1);
    await db.as(owner, (q) => q(`update checklist_items set status = 'needs_redo' where id = $1`, [item.id]));
    const [after] = await db.admin<{ docs_verified: number }>(`select docs_verified from cases where id = $1`, [c.case]);
    expect(after.docs_verified).toBe(0);
    const [cleared] = await db.admin<{ verified_by: string | null }>(`select verified_by from checklist_items where id = $1`, [item.id]);
    expect(cleared.verified_by).toBeNull();
  });

  it('uploading a file marks the item received; portal uploads are attributed to the applicant', async () => {
    const c = await newCase({ dest: 'DE', start: 100 });
    const items = await db.admin<{ id: string; label: string }>(`select id, label from checklist_items where case_id = $1 order by sort_order`, [c.case]);
    const passport = items[0];
    await db.as(owner, (q) => q(
      `insert into checklist_item_files (org_id, case_id, item_id, storage_path, file_name) values ($1,$2,$3,$4,'p.pdf')`,
      [org, c.case, passport.id, `${org}/${c.case}/${passport.id}/p.pdf`]));
    const [st] = await db.admin<{ status: string }>(`select status from checklist_items where id = $1`, [passport.id]);
    expect(st.status).toBe('received');

    // a file can't claim another case's path or item
    await rejects(db.as(owner, (q) => q(
      `insert into checklist_item_files (org_id, case_id, item_id, storage_path, file_name) values ($1,$2,$3,'elsewhere/x.pdf','x')`,
      [org, c.case, passport.id])), /invalid_storage_path/);

    const hash = 'portal-hash-1';
    await db.as(owner, (q) => q(
      `insert into portal_links (org_id, case_id, token_hash, expires_at, created_by) values ($1,$2,$3, now() + interval '3 days', $4)`,
      [org, c.case, hash, owner]));
    const photo = items[1];
    await db.service((q) => q(
      `select public.portal_register_file($1,$2,$3,'photo.jpg','image/jpeg',1234)`,
      [hash, photo.id, `${org}/${c.case}/${photo.id}/photo.jpg`]));
    const ev = await db.admin<{ actor_type: string; actor_id: string | null; type: string }>(
      `select actor_type, actor_id, type from activity_events where case_id = $1 and type in ('document_uploaded','document_status_changed') order by created_at, id`, [c.case]);
    const portalEvents = ev.filter((e) => e.actor_type === 'applicant');
    expect(portalEvents.map((e) => e.type).sort()).toEqual(['document_status_changed', 'document_uploaded']);
    expect(portalEvents.every((e) => e.actor_id === null)).toBe(true);
    const [f] = await db.admin<{ uploaded_via: string; uploaded_by: string | null }>(
      `select uploaded_via, uploaded_by from checklist_item_files where item_id = $1`, [photo.id]);
    expect(f).toEqual({ uploaded_via: 'portal', uploaded_by: null });

    // revoked / expired links stop working
    await db.admin(`update portal_links set revoked_at = now() where token_hash = $1`, [hash]);
    const gone = await db.service((q) => q<{ r: unknown }>(`select public.portal_get($1) r`, [hash]));
    expect(gone[0].r).toBeNull();
    await rejects(db.service((q) => q(`select public.portal_register_file($1,$2,$3,'x','x',1)`, [hash, photo.id, `${org}/${c.case}/${photo.id}/x`])), /invalid_link/);
    await db.admin(`update portal_links set revoked_at = null, expires_at = now() - interval '1 minute' where token_hash = $1`, [hash]);
    const expired = await db.service((q) => q<{ r: unknown }>(`select public.portal_get($1) r`, [hash]));
    expect(expired[0].r).toBeNull();
  });
});

d('stage lifecycle', () => {
  it('records history, events, audit, timestamps and notifies on decisions', async () => {
    const c = await newCase({ assigned: advisor });
    // assignment notified the advisor (assigned by someone else)
    const n0 = await db.admin<{ type: string }>(`select type from notifications where user_id = $1 and case_id = $2`, [advisor, c.case]);
    expect(n0.map((n) => n.type)).toContain('case_assigned');

    await db.as(advisor, (q) => q(`update cases set stage = 'submitted' where id = $1`, [c.case]));
    let [row] = await db.admin<{ submitted_at: string | null; decided_at: string | null; max_stage_ord: number }>(
      `select submitted_at, decided_at, max_stage_ord from cases where id = $1`, [c.case]);
    expect(row.submitted_at).not.toBeNull();
    expect(row.decided_at).toBeNull();
    expect(row.max_stage_ord).toBe(4);

    await db.as(advisor, (q) => q(`update cases set stage = 'approved' where id = $1`, [c.case]));
    [row] = await db.admin(`select submitted_at, decided_at, max_stage_ord from cases where id = $1`, [c.case]);
    expect(row.decided_at).not.toBeNull();
    expect(row.max_stage_ord).toBe(6);

    const hist = await db.admin<{ stage: string; exited_at: string | null; changed_by: string | null }>(
      `select stage, exited_at, changed_by from case_stage_history where case_id = $1 order by id`, [c.case]);
    expect(hist.map((h) => h.stage)).toEqual(['admitted', 'submitted', 'approved']);
    expect(hist[0].exited_at).not.toBeNull();
    expect(hist[2].exited_at).toBeNull();
    expect(hist[2].changed_by).toBe(advisor);

    const ev = await db.admin<{ type: string; actor_id: string }>(`select type, actor_id from activity_events where case_id = $1 order by created_at, id`, [c.case]);
    expect(ev[0].type).toBe('case_created');
    expect(ev.filter((e) => e.type === 'stage_changed')).toHaveLength(2);
    expect(ev.filter((e) => e.type === 'decision_recorded')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'stage_changed').every((e) => e.actor_id === advisor)).toBe(true);

    // decision notifies owners/admins but not the actor
    const dec = await db.admin<{ user_id: string }>(`select user_id from notifications where case_id = $1 and type = 'decision_recorded'`, [c.case]);
    expect(dec.map((x) => x.user_id).sort()).toEqual([owner, admin].sort());
    const audit = await db.admin<{ action: string }>(`select action from audit_log where entity_id = $1 order by id`, [c.case]);
    expect(audit.map((a) => a.action)).toEqual(['case.stage_changed', 'case.stage_changed', 'case.decision_recorded']);

    // moving back out of a decided stage clears the decision
    await db.as(owner, (q) => q(`update cases set stage = 'decision_pending' where id = $1`, [c.case]));
    [row] = await db.admin(`select submitted_at, decided_at, max_stage_ord from cases where id = $1`, [c.case]);
    expect(row.decided_at).toBeNull();
    expect(row.max_stage_ord).toBe(6); // "reached" never goes down
  });

  it('only counter updates do not claim a human edit', async () => {
    const c = await newCase({ dest: 'DE' });
    const [before] = await db.admin<{ updated_by: string | null; updated_at: string }>(`select updated_by, updated_at::text from cases where id = $1`, [c.case]);
    const [item] = await db.admin<{ id: string }>(`select id from checklist_items where case_id = $1 limit 1`, [c.case]);
    await db.as(admin, (q) => q(`update checklist_items set status = 'received' where id = $1`, [item.id]));
    const [after] = await db.admin<{ updated_by: string | null; updated_at: string; docs_received: number }>(
      `select updated_by, updated_at::text, docs_received from cases where id = $1`, [c.case]);
    expect(after.docs_received).toBe(1);
    expect(after.updated_by).toBe(before.updated_by);
    expect(after.updated_at).toBe(before.updated_at);
  });

  it('assignment changes notify the new assignee unless they did it themselves', async () => {
    const c = await newCase();
    await db.as(advisor, (q) => q(`update cases set assigned_to = $2 where id = $1`, [c.case, advisor]));
    expect(await db.admin(`select 1 from notifications where user_id = $1 and case_id = $2`, [advisor, c.case])).toHaveLength(0);
    await db.as(owner, (q) => q(`update cases set assigned_to = $2 where id = $1`, [c.case, other]));
    expect(await db.admin(`select 1 from notifications where user_id = $1 and case_id = $2 and type = 'case_assigned'`, [other, c.case])).toHaveLength(1);
  });
});

d('risk scoring', () => {
  const calc = async (args: Record<string, unknown>) => {
    const a = { stage: 'documents', start: null, appt: null, submitted: null, total: 0, verified: 0, proc: 30, wait: 14, prep: 21, hi: 0, med: 14, today: '2026-06-01', ...args };
    const [r] = await db.admin<{ level: string | null; reason: string | null; days_to_start: number | null; est_days_needed: number | null; slack_days: number | null; docs_pct: number | null }>(
      `select * from private.risk_calc($1::case_stage,$2::date,$3::date,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11,$12::date)`,
      [a.stage, a.start, a.appt, a.submitted, a.total, a.verified, a.proc, a.wait, a.prep, a.hi, a.med, a.today]);
    return r;
  };

  it('matches the documented examples', async () => {
    // 21 days out, no appointment, 40% verified: needs max(ceil(21*0.6)=13, 14) + 30 = 44 -> slack -23 -> high
    const r = await calc({ start: '2026-06-22', total: 5, verified: 2 });
    expect(r).toMatchObject({ level: 'high', days_to_start: 21, est_days_needed: 44, slack_days: -23, docs_pct: 40 });
    expect(r.reason).toBe('Starts in 21d · no appointment · 40% docs verified · needs ~44d');
  });

  it('uses medium / low thresholds and appointment dates', async () => {
    const medium = await calc({ start: '2026-08-10', total: 4, verified: 4, appt: '2026-06-10' });
    // need = max(0, 9) + 30 = 39; start in 70 -> slack 31 -> low
    expect(medium).toMatchObject({ level: 'low', est_days_needed: 39, slack_days: 31 });
    const m = await calc({ start: '2026-07-10', total: 4, verified: 4, appt: '2026-06-05' }); // need 4+30=34, start 39 => slack 5 => medium
    expect(m).toMatchObject({ level: 'medium', slack_days: 5 });
    expect(m.reason).toContain('appointment in 4d');
  });

  it('handles submitted cases, passed start dates, missing start dates and closed cases', async () => {
    const sub = await calc({ stage: 'submitted', start: '2026-06-20', submitted: '2026-05-25T10:00:00Z' });
    // 7 days since submission -> 23 days left; start in 19 -> slack -4
    expect(sub).toMatchObject({ level: 'high', est_days_needed: 23, slack_days: -4 });
    expect(sub.reason).toBe('Starts in 19d · submitted 7d ago · needs ~23d');
    const passed = await calc({ start: '2026-05-01', stage: 'appointment' });
    expect(passed.level).toBe('high');
    expect(passed.reason).toMatch(/^Started 31d ago · appointment booked/);
    const none = await calc({ start: null });
    expect(none).toMatchObject({ level: null, reason: 'No start date set' });
    for (const stage of ['approved', 'refused', 'withdrawn']) {
      expect(await calc({ stage, start: '2026-07-01' })).toMatchObject({ level: null, reason: null });
    }
    const noList = await calc({ start: '2026-12-01', total: 0 });
    expect(noList.reason).toContain('no checklist');
  });

  it('reads per-destination processing times with visa-type precedence and org defaults', async () => {
    const c = await newCase({ dest: 'SE', visa: 'D', start: 80 });
    const base = await db.as(owner, (q) => q<{ est_days_needed: number }>(`select est_days_needed from case_overview where id = $1`, [c.case]));
    expect(base[0].est_days_needed).toBe(21 + 0 > 14 ? 21 + 30 : 14 + 30); // defaults: prep 21 (0% verified, no checklist) + processing 30
    await db.as(owner, (q) => q(
      `insert into processing_times (org_id, destination, visa_type, processing_days, appointment_wait_days, doc_prep_days)
       values ($1,'SE','any',40,5,10), ($1,'SE','D',60,5,10)`, [org]));
    const withD = await db.as(owner, (q) => q<{ est_days_needed: number }>(`select est_days_needed from case_overview where id = $1`, [c.case]));
    expect(withD[0].est_days_needed).toBe(10 + 60);
    await db.as(owner, (q) => q(`delete from processing_times where org_id = $1 and destination = 'SE' and visa_type = 'D'`, [org]));
    const withAny = await db.as(owner, (q) => q<{ est_days_needed: number }>(`select est_days_needed from case_overview where id = $1`, [c.case]));
    expect(withAny[0].est_days_needed).toBe(10 + 40);
    await db.as(owner, (q) => q(`update org_settings set high_buffer_days = 30, medium_buffer_days = 60 where org_id = $1`, [org]));
    const lvl = await db.as(owner, (q) => q<{ risk_level: string }>(`select risk_level from case_overview where id = $1`, [c.case]));
    expect(lvl[0].risk_level).toBe('medium'); // slack 30 is not < 30 (high) but < 60 (medium)
    await db.as(owner, (q) => q(`update org_settings set high_buffer_days = 0, medium_buffer_days = 14 where org_id = $1`, [org]));
  });

  it('notifies the team when a case becomes high risk and when items go overdue (once)', async () => {
    const c = await newCase({ assigned: advisor, start: 400, dest: 'PT' });
    expect(await db.admin(`select 1 from notifications where case_id = $1 and type = 'case_high_risk'`, [c.case])).toHaveLength(0);
    const near = await day(5);
    await db.as(owner, (q) => q(`update cases set start_date = $2 where id = $1`, [c.case, near]));
    const hi = await db.admin<{ user_id: string }>(`select user_id from notifications where case_id = $1 and type = 'case_high_risk'`, [c.case]);
    expect(hi.map((h) => h.user_id).sort()).toEqual([advisor, owner, admin].sort());
    // idempotent for the same day
    const six = await day(6);
    await db.as(owner, (q) => q(`update cases set start_date = $2 where id = $1`, [c.case, six]));
    expect(await db.admin(`select 1 from notifications where case_id = $1 and type = 'case_high_risk'`, [c.case])).toHaveLength(3);

    await db.as(owner, (q) => q(`insert into checklist_items (org_id, case_id, label, due_date) values ($1,$2,'Late doc', current_date - 2)`, [org, c.case]));
    await db.as(owner, (q) => q(`insert into tasks (org_id, case_id, title, assignee_id, due_date) values ($1,$2,'Late task',$3, current_date - 1)`, [org, c.case, other]));
    await db.service((q) => q(`select public.run_maintenance($1)`, [org]));
    await db.service((q) => q(`select public.run_maintenance($1)`, [org]));
    const overdueDoc = await db.admin<{ user_id: string }>(`select user_id from notifications where case_id = $1 and type = 'document_overdue'`, [c.case]);
    expect(overdueDoc.map((n) => n.user_id)).toEqual([advisor]);
    const overdueTask = await db.admin<{ user_id: string }>(`select user_id from notifications where case_id = $1 and type = 'task_overdue'`, [c.case]);
    expect(overdueTask.map((n) => n.user_id)).toEqual([other]);
  });

  it('lets members trigger maintenance at most every 30 minutes', async () => {
    await db.admin(`update organizations set last_maintenance_at = null where id = $1`, [org]);
    const first = await db.as(advisor, (q) => q<{ r: boolean }>(`select public.touch_maintenance($1) r`, [org]));
    const second = await db.as(advisor, (q) => q<{ r: boolean }>(`select public.touch_maintenance($1) r`, [org]));
    expect([first[0].r, second[0].r]).toEqual([true, false]);
  });
});

d('bulk import', () => {
  it('imports rows, reuses applicants by e-mail, reports per-row errors and stays quiet', async () => {
    const start = await day(120);
    const rows = [
      { idx: 2, full_name: 'Imp One', email: 'one@imp.test', nationality: 'IN', destination: 'FR', visa_type: 'D', start_date: start, intake: 'Sep 2027', tags: ['vip'], stage: 'documents' },
      { idx: 3, full_name: 'Imp One Again', email: 'ONE@imp.test', nationality: 'IN', destination: 'ES', visa_type: 'C' },
      { idx: 4, full_name: 'Bad Country', email: 'bad@imp.test', destination: 'FRANCE' },
      { idx: 5, full_name: 'Bad Date', email: 'date@imp.test', destination: 'FR', start_date: 'not-a-date' },
    ];
    const [res] = await db.as(owner, (q) => q<{ r: { cases_created: number; applicants_created: number; applicants_reused: number; errors: { index: number }[] } }>(
      `select public.import_rows($1, $2::jsonb) r`, [org, JSON.stringify(rows)]));
    expect(res.r.cases_created).toBe(2);
    expect(res.r.applicants_created).toBe(1);
    expect(res.r.applicants_reused).toBe(1);
    expect(res.r.errors.map((e) => e.index).sort()).toEqual([4, 5]);
    // no applicant row is left behind by a failed case insert
    expect(await db.admin(`select 1 from applicants where org_id = $1 and email in ('bad@imp.test','date@imp.test')`, [org])).toHaveLength(0);
    const evs = await db.admin(`select 1 from activity_events e join cases c on c.id = e.case_id join applicants a on a.id = c.applicant_id where a.email = 'one@imp.test' and e.type = 'case_created'`);
    expect(evs).toHaveLength(0);
    const [c] = await db.admin<{ tags: string[]; stage: string; intake: string }>(
      `select c.tags, c.stage, c.intake from cases c join applicants a on a.id = c.applicant_id where a.email = 'one@imp.test' and c.destination = 'FR'`);
    expect(c).toEqual({ tags: ['vip'], stage: 'documents', intake: 'Sep 2027' });
  });

  it('stops at the plan limit', async () => {
    const o = await db.user('imp-free@test.dev');
    const freeOrg = await db.org(o, 'Free import', 'free');
    await db.admin(`update organizations set plan = 'premium' where id = $1`, [freeOrg]);
    await db.admin(`update plan_limits set max_applicants = 2 where plan = 'premium'`);
    try {
      const rows = [1, 2, 3, 4].map((i) => ({ idx: i, full_name: `L${i}`, email: `l${i}@lim.test`, destination: 'FR' }));
      const [res] = await db.as(o, (q) => q<{ r: { cases_created: number; plan_limit_reached: boolean } }>(`select public.import_rows($1,$2::jsonb) r`, [freeOrg, JSON.stringify(rows)]));
      expect(res.r.cases_created).toBe(2);
      expect(res.r.plan_limit_reached).toBe(true);
    } finally {
      await db.admin(`update plan_limits set max_applicants = null where plan = 'premium'`);
    }
  });
});

d('privacy: export and erasure', () => {
  it('exports everything about an applicant and erases it completely', async () => {
    const c = await newCase({ dest: 'DE', start: 100, name: 'Erase Me' });
    const items = await db.admin<{ id: string }>(`select id from checklist_items where case_id = $1`, [c.case]);
    await db.as(owner, (q) => q(`insert into checklist_item_files (org_id, case_id, item_id, storage_path, file_name) values ($1,$2,$3,$4,'e.pdf')`, [org, c.case, items[0].id, `${org}/${c.case}/${items[0].id}/e.pdf`]));
    await db.as(owner, (q) => q(`insert into tasks (org_id, case_id, title) values ($1,$2,'t')`, [org, c.case]));
    await db.as(owner, (q) => q(`update cases set stage = 'documents' where id = $1`, [c.case]));
    await db.as(owner, (q) => q(`update checklist_items set status = 'verified' where id = $1`, [items[1].id]));

    const [exp] = await db.as(owner, (q) => q<{ r: { applicant: { full_name: string }; cases: { checklist: unknown[]; files: { storage_path?: string }[]; activity: unknown[]; tasks: unknown[] }[] } }>(
      `select public.export_applicant_data($1) r`, [c.applicant]));
    expect(exp.r.applicant.full_name).toBe('Erase Me');
    expect(exp.r.cases[0].checklist.length).toBeGreaterThan(0);
    expect(exp.r.cases[0].files).toHaveLength(1);
    expect(exp.r.cases[0].files[0].storage_path).toBeUndefined();
    expect(exp.r.cases[0].tasks).toHaveLength(1);
    expect(exp.r.cases[0].activity.length).toBeGreaterThan(0);

    await rejects(db.as(advisor, (q) => q(`select public.erase_applicant($1)`, [c.applicant])), /forbidden/);
    const [paths] = await db.as(admin, (q) => q<{ p: string[] }>(`select public.erasure_file_paths($1) p`, [c.applicant]));
    expect(paths.p).toEqual([`${org}/${c.case}/${items[0].id}/e.pdf`]);
    await db.as(admin, (q) => q(`select public.erase_applicant($1)`, [c.applicant]));

    for (const [t, col, id] of [['applicants', 'id', c.applicant], ['cases', 'id', c.case], ['checklist_items', 'case_id', c.case],
      ['checklist_item_files', 'case_id', c.case], ['tasks', 'case_id', c.case], ['activity_events', 'case_id', c.case],
      ['case_stage_history', 'case_id', c.case], ['notifications', 'case_id', c.case], ['case_risk_cache', 'case_id', c.case]] as const) {
      expect(await db.admin(`select 1 from ${t} where ${col} = $1`, [id]), `${t} not erased`).toHaveLength(0);
    }
    const audit = await db.admin<{ action: string; metadata: Record<string, unknown> }>(
      `select action, metadata from audit_log where org_id = $1 and (entity_id = $2 or entity_id = $3) order by id`, [org, c.applicant, c.case]);
    expect(audit.some((a) => a.action === 'applicant.erased')).toBe(true);
    expect(audit.filter((a) => a.action !== 'applicant.erased').every((a) => Object.keys(a.metadata).length === 0)).toBe(true);
    expect(JSON.stringify(audit)).not.toContain('Erase Me');
  });
});

d('rate limiter', () => {
  it('allows up to the limit inside the window', async () => {
    const hits: boolean[] = [];
    for (let i = 0; i < 5; i++) hits.push((await db.service((q) => q<{ r: boolean }>(`select public.rate_limit_hit('k1', 3, 60) r`)))[0].r);
    expect(hits).toEqual([true, true, true, false, false]);
    await db.admin(`update rate_limits set window_start = now() - interval '2 minutes' where key = 'k1'`);
    expect((await db.service((q) => q<{ r: boolean }>(`select public.rate_limit_hit('k1', 3, 60) r`)))[0].r).toBe(true);
  });
});
