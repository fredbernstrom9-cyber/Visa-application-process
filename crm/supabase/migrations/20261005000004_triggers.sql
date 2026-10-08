-- ============================================================================
-- 04 TRIGGERS: stage history, events, audit, counters, checklist auto-apply,
-- risk transition detection and notifications.
-- Session setting `app.bulk = 'on'` (transaction-local) silences per-row
-- activity/notifications during imports.
-- ============================================================================

-- Last risk level seen per case; used only to detect "became high risk".
create table public.case_risk_cache (
  case_id uuid primary key references public.cases (id) on delete cascade,
  org_id uuid not null,
  level text,
  computed_at timestamptz not null default now()
);
alter table public.case_risk_cache enable row level security;

create function private.is_bulk() returns boolean
language sql stable as $$ select coalesce(current_setting('app.bulk', true), '') = 'on' $$;

-- ---------------------------------------------------------------------------
-- Checklist templates
-- ---------------------------------------------------------------------------
create function private.match_template(p_case uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.id
  from public.cases c
  join public.applicants a on a.id = c.applicant_id
  join public.checklist_templates t
    on t.org_id = c.org_id and t.active and t.destination = c.destination and t.visa_type = c.visa_type
   and (t.nationality is null or t.nationality = a.nationality)
  where c.id = p_case
  order by (t.nationality is not null) desc, t.created_at
  limit 1
$$;

create function private.apply_template_to_case(p_case uuid, p_template uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.checklist_items
    (org_id, case_id, template_item_id, label, description, required, due_date, sort_order)
  select c.org_id, c.id, ti.id, ti.label, ti.description, ti.required,
         case when ti.due_days_before_start is not null and c.start_date is not null
              then c.start_date - ti.due_days_before_start end,
         ti.sort_order
  from public.cases c
  join public.checklist_template_items ti on ti.template_id = p_template and ti.org_id = c.org_id
  where c.id = p_case
  on conflict (case_id, template_item_id) where template_item_id is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.apply_checklist_template(p_cases uuid[], p_template uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_case uuid; v_tpl uuid; v_total integer := 0; v_tpl_org uuid;
begin
  if p_template is not null then
    select org_id into v_tpl_org from public.checklist_templates where id = p_template;
    if v_tpl_org is null then raise exception 'not_found'; end if;
  end if;
  foreach v_case in array coalesce(p_cases, '{}') loop
    if not private.can_access_case(v_case, true) then raise exception 'forbidden'; end if;
    if p_template is not null then
      if v_tpl_org is distinct from (select org_id from public.cases where id = v_case) then
        raise exception 'forbidden';
      end if;
      v_tpl := p_template;
    else
      v_tpl := private.match_template(v_case);
    end if;
    if v_tpl is not null then v_total := v_total + private.apply_template_to_case(v_case, v_tpl); end if;
  end loop;
  return v_total;
end $$;

-- ---------------------------------------------------------------------------
-- Document counters on cases
-- ---------------------------------------------------------------------------
create function private.recompute_case_docs(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.cases c
     set docs_total = s.t, docs_verified = s.v, docs_received = s.r
    from (
      select count(*) filter (where required)::int as t,
             count(*) filter (where required and status = 'verified')::int as v,
             count(*) filter (where required and status in ('received', 'verified'))::int as r
        from public.checklist_items where case_id = p_case
    ) s
   where c.id = p_case
     and (c.docs_total, c.docs_verified, c.docs_received) is distinct from (s.t, s.v, s.r);
end $$;

-- ---------------------------------------------------------------------------
-- Risk cache / transition detection
-- ---------------------------------------------------------------------------
create function private.refresh_case_risk(p_case uuid, p_notify boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
  v_prev text;
  v_has_prev boolean;
begin
  select o.org_id, o.risk_level, o.risk_reason, o.full_name into v_row
    from public.case_overview o where o.id = p_case;
  if not found then return; end if;
  select level, true into v_prev, v_has_prev from public.case_risk_cache where case_id = p_case;
  insert into public.case_risk_cache (case_id, org_id, level)
  values (p_case, v_row.org_id, v_row.risk_level)
  on conflict (case_id) do update set level = excluded.level, computed_at = now();
  if p_notify and coalesce(v_has_prev, false) and v_row.risk_level = 'high' and v_prev is distinct from 'high' then
    perform private.notify_case_team(
      p_case, 'case_high_risk', v_row.full_name || ' is now high risk', v_row.risk_reason,
      'high_risk:' || p_case || ':' || current_date, null
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cases
-- ---------------------------------------------------------------------------
create function private.cases_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_role public.org_role;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_uid);
    new.updated_by := v_uid;
    new.max_stage_ord := greatest(1, private.stage_ord(new.stage));
    if new.assigned_to is null and v_uid is not null then
      select role into v_role from public.memberships where org_id = new.org_id and user_id = v_uid;
      if v_role = 'advisor' then new.assigned_to := v_uid; end if;
    end if;
    if private.stage_ord(new.stage) >= 4 and new.submitted_at is null then new.submitted_at := now(); end if;
    if new.stage in ('approved', 'refused') and new.decided_at is null then new.decided_at := now(); end if;
    new.stage_changed_at := coalesce(new.decided_at, new.submitted_at, now());
    if new.stage_changed_at > now() then new.stage_changed_at := now(); end if;
    return new;
  end if;

  -- UPDATE
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.max_stage_ord := greatest(old.max_stage_ord, private.stage_ord(new.stage));
    if private.stage_ord(new.stage) >= 4 and new.submitted_at is null then new.submitted_at := now(); end if;
    if new.stage in ('approved', 'refused') then
      new.decided_at := coalesce(old.decided_at, new.decided_at, now());
    else
      new.decided_at := null;
      new.decision_reason := null;
    end if;
  end if;
  -- counter-only updates (from checklist triggers) must not claim a human edit
  if (to_jsonb(new) - '{docs_total,docs_verified,docs_received,updated_at,updated_by}'::text[])
     = (to_jsonb(old) - '{docs_total,docs_verified,docs_received,updated_at,updated_by}'::text[]) then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := v_uid;
  return new;
end $$;
create trigger cases_before_write before insert or update on public.cases
  for each row execute function private.cases_before_write();

create function private.cases_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_tpl uuid; v_name text;
begin
  insert into public.case_stage_history (org_id, case_id, stage, entered_at, changed_by)
  values (new.org_id, new.id, new.stage,
          case when new.stage in ('approved', 'refused') then coalesce(new.decided_at, now())
               when private.stage_ord(new.stage) >= 4 then coalesce(new.submitted_at, now())
               else least(now(), new.opened_on::timestamptz) end,
          v_uid);
  if not private.is_bulk() then
    perform private.log_activity(new.org_id, new.id, 'case_created', jsonb_build_object('stage', new.stage));
    if new.assigned_to is not null and new.assigned_to is distinct from v_uid then
      select full_name into v_name from public.applicants where id = new.applicant_id;
      perform private.notify(new.org_id, new.assigned_to, 'case_assigned', 'New case assigned to you',
                             v_name, new.id, 'assigned:' || new.id || ':' || new.assigned_to);
    end if;
  end if;
  v_tpl := private.match_template(new.id);
  if v_tpl is not null then perform private.apply_template_to_case(new.id, v_tpl); end if;
  perform private.refresh_case_risk(new.id, false);
  return new;
end $$;
create trigger cases_after_insert after insert on public.cases
  for each row execute function private.cases_after_insert();

create function private.cases_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_name text;
begin
  if new.stage is distinct from old.stage then
    update public.case_stage_history set exited_at = now() where case_id = new.id and exited_at is null;
    insert into public.case_stage_history (org_id, case_id, stage, changed_by)
    values (new.org_id, new.id, new.stage, v_uid);
    perform private.log_activity(new.org_id, new.id, 'stage_changed',
                                 jsonb_build_object('from', old.stage, 'to', new.stage));
    perform private.log_audit(new.org_id, 'case.stage_changed', 'case', new.id,
                              jsonb_build_object('from', old.stage, 'to', new.stage));
    if new.stage in ('approved', 'refused') then
      select full_name into v_name from public.applicants where id = new.applicant_id;
      perform private.log_activity(new.org_id, new.id, 'decision_recorded', jsonb_build_object('outcome', new.stage));
      perform private.log_audit(new.org_id, 'case.decision_recorded', 'case', new.id,
                                jsonb_build_object('outcome', new.stage));
      perform private.notify_case_team(
        new.id, 'decision_recorded',
        'Decision recorded: ' || case when new.stage = 'approved' then 'approved' else 'refused' end,
        v_name, 'decision:' || new.id || ':' || new.stage || ':' || extract(epoch from now())::bigint, v_uid);
    end if;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    perform private.log_activity(new.org_id, new.id, 'case_assigned',
                                 jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
    if new.assigned_to is not null and new.assigned_to is distinct from v_uid then
      select full_name into v_name from public.applicants where id = new.applicant_id;
      perform private.notify(new.org_id, new.assigned_to, 'case_assigned', 'Case assigned to you', v_name, new.id,
                             'assigned:' || new.id || ':' || new.assigned_to || ':' || extract(epoch from now())::bigint);
    end if;
  end if;

  if (new.stage, new.start_date, new.appointment_date, new.docs_total, new.docs_verified,
      new.submitted_at, new.destination, new.visa_type)
     is distinct from
     (old.stage, old.start_date, old.appointment_date, old.docs_total, old.docs_verified,
      old.submitted_at, old.destination, old.visa_type) then
    perform private.refresh_case_risk(new.id, true);
  end if;
  return new;
end $$;
create trigger cases_after_update after update on public.cases
  for each row execute function private.cases_after_update();

create function private.cases_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.organizations where id = old.org_id) then
    perform private.log_audit(old.org_id, 'case.deleted', 'case', old.id,
                              jsonb_build_object('stage', old.stage, 'destination', old.destination));
  end if;
  return old;
end $$;
create trigger cases_after_delete after delete on public.cases
  for each row execute function private.cases_after_delete();

create function private.applicants_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.organizations where id = old.org_id) then
    perform private.log_audit(old.org_id, 'applicant.deleted', 'applicant', old.id, '{}'::jsonb);
  end if;
  return old;
end $$;
create trigger applicants_after_delete after delete on public.applicants
  for each row execute function private.applicants_after_delete();

-- ---------------------------------------------------------------------------
-- Checklist items
-- ---------------------------------------------------------------------------
create function private.checklist_items_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_uid);
  else
    new.updated_at := now();
    new.updated_by := v_uid;
  end if;
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    new.verified_by := v_uid;
    new.verified_at := now();
  elsif new.status <> 'verified' then
    new.verified_by := null;
    new.verified_at := null;
  end if;
  return new;
end $$;
create trigger checklist_items_before before insert or update on public.checklist_items
  for each row execute function private.checklist_items_before();

create function private.checklist_items_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.recompute_case_docs(old.case_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform private.log_activity(new.org_id, new.case_id, 'document_status_changed',
      jsonb_build_object('item_id', new.id, 'label', new.label, 'from', old.status, 'to', new.status));
    if new.status = 'verified' or old.status = 'verified' then
      perform private.log_audit(new.org_id,
        case when new.status = 'verified' then 'document.verified' else 'document.unverified' end,
        'checklist_item', new.id, jsonb_build_object('case_id', new.case_id, 'label', new.label, 'to', new.status));
    end if;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.required is distinct from old.required then
    perform private.recompute_case_docs(new.case_id);
  end if;
  return new;
end $$;
create trigger checklist_items_after after insert or update or delete on public.checklist_items
  for each row execute function private.checklist_items_after();

-- ---------------------------------------------------------------------------
-- Uploaded files
-- ---------------------------------------------------------------------------
create function private.item_files_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.checklist_items where id = new.item_id and case_id = new.case_id and org_id = new.org_id
  ) then
    raise exception 'item_case_mismatch';
  end if;
  if new.storage_path not like new.org_id::text || '/' || new.case_id::text || '/%' then
    raise exception 'invalid_storage_path';
  end if;
  if private.current_actor_type() = 'applicant' then
    new.uploaded_via := 'portal';
    new.uploaded_by := null;
  else
    new.uploaded_via := 'staff';
    new.uploaded_by := (select auth.uid());
  end if;
  return new;
end $$;
create trigger item_files_before before insert on public.checklist_item_files
  for each row execute function private.item_files_before();

create function private.item_files_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_label text; v_status public.item_status;
begin
  select label, status into v_label, v_status from public.checklist_items where id = new.item_id;
  perform private.log_activity(new.org_id, new.case_id, 'document_uploaded',
    jsonb_build_object('item_id', new.item_id, 'label', v_label, 'via', new.uploaded_via));
  if v_status in ('missing', 'needs_redo') or (v_status = 'verified' and new.uploaded_via = 'portal') then
    update public.checklist_items set status = 'received' where id = new.item_id;
  end if;
  return new;
end $$;
create trigger item_files_after after insert on public.checklist_item_files
  for each row execute function private.item_files_after();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create function private.tasks_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_uid);
    if new.status = 'done' then new.completed_at := now(); new.completed_by := v_uid; end if;
  else
    new.updated_at := now();
    new.updated_by := v_uid;
    if new.status = 'done' and old.status <> 'done' then
      new.completed_at := now();
      new.completed_by := v_uid;
    elsif new.status = 'open' then
      new.completed_at := null;
      new.completed_by := null;
    end if;
  end if;
  return new;
end $$;
create trigger tasks_before before insert or update on public.tasks
  for each row execute function private.tasks_before();

create function private.tasks_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_name text;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.org_id, new.case_id, 'task_created',
                                 jsonb_build_object('task_id', new.id, 'title', new.title));
  elsif new.status = 'done' and old.status <> 'done' then
    perform private.log_activity(new.org_id, new.case_id, 'task_completed',
                                 jsonb_build_object('task_id', new.id, 'title', new.title));
  end if;
  if new.assignee_id is not null and new.assignee_id is distinct from v_uid
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) and new.status = 'open'
     and not private.is_bulk() then
    select a.full_name into v_name from public.cases c join public.applicants a on a.id = c.applicant_id where c.id = new.case_id;
    perform private.notify(new.org_id, new.assignee_id, 'task_assigned', 'Task assigned to you: ' || new.title,
                           v_name, new.case_id, 'task_assigned:' || new.id || ':' || new.assignee_id);
  end if;
  return new;
end $$;
create trigger tasks_after after insert or update on public.tasks
  for each row execute function private.tasks_after();

-- ---------------------------------------------------------------------------
-- Portal links
-- ---------------------------------------------------------------------------
create function private.portal_links_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.org_id, new.case_id, 'portal_link_created', jsonb_build_object('link_id', new.id));
    perform private.log_audit(new.org_id, 'portal_link.created', 'portal_link', new.id,
                              jsonb_build_object('case_id', new.case_id, 'expires_at', new.expires_at));
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform private.log_activity(new.org_id, new.case_id, 'portal_link_revoked', jsonb_build_object('link_id', new.id));
    perform private.log_audit(new.org_id, 'portal_link.revoked', 'portal_link', new.id, jsonb_build_object('case_id', new.case_id));
  end if;
  return new;
end $$;
create trigger portal_links_after after insert or update on public.portal_links
  for each row execute function private.portal_links_after();

-- ---------------------------------------------------------------------------
-- Audit of configuration changes
-- ---------------------------------------------------------------------------
create function private.audit_config_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_org uuid; v_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org := (v_row ->> 'org_id')::uuid;
  v_id := coalesce((v_row ->> 'id')::uuid, v_org);
  if exists (select 1 from public.organizations where id = v_org) then
    perform private.log_audit(v_org, tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger org_settings_audit after update on public.org_settings
  for each row execute function private.audit_config_change();
create trigger processing_times_audit after insert or update or delete on public.processing_times
  for each row execute function private.audit_config_change();
create trigger checklist_templates_audit after delete on public.checklist_templates
  for each row execute function private.audit_config_change();

create function private.audit_org_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.plan is distinct from old.plan then
    perform private.log_audit(new.id, 'org.plan_changed', 'organization', new.id,
                              jsonb_build_object('from', old.plan, 'to', new.plan));
  end if;
  return new;
end $$;
create trigger organizations_audit_plan after update of plan on public.organizations
  for each row execute function private.audit_org_plan();

-- ---------------------------------------------------------------------------
-- Maintenance: risk transitions + overdue sweeps (daily cron or lazily from the app)
-- ---------------------------------------------------------------------------
create function private.run_org_maintenance(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  -- 1. risk transitions (set-based)
  for r in
    with cur as (
      select o.id, o.org_id, o.risk_level, o.risk_reason, o.full_name
        from public.case_overview o where o.org_id = p_org
    ),
    prev as (select case_id, level from public.case_risk_cache where org_id = p_org),
    up as (
      insert into public.case_risk_cache (case_id, org_id, level)
      select id, org_id, risk_level from cur
      on conflict (case_id) do update set level = excluded.level, computed_at = now()
      returning case_id
    )
    select cur.id, cur.full_name, cur.risk_reason
      from cur join prev on prev.case_id = cur.id
     where cur.risk_level = 'high' and prev.level is not null and prev.level is distinct from 'high'
  loop
    perform private.notify_case_team(r.id, 'case_high_risk', r.full_name || ' is now high risk', r.risk_reason,
                                     'high_risk:' || r.id || ':' || current_date, null);
  end loop;

  -- 2. overdue required documents
  for r in
    select i.id, i.label, i.due_date, c.id as case_id, c.assigned_to, a.full_name
      from public.checklist_items i
      join public.cases c on c.id = i.case_id and c.org_id = i.org_id
      join public.applicants a on a.id = c.applicant_id
     where i.org_id = p_org and i.required and i.due_date < current_date
       and i.status in ('missing', 'needs_redo') and private.is_open_stage(c.stage)
  loop
    if r.assigned_to is not null then
      perform private.notify(p_org, r.assigned_to, 'document_overdue', 'Overdue document: ' || r.label,
                             r.full_name, r.case_id, 'overdue_item:' || r.id || ':' || r.due_date);
    else
      perform private.notify(p_org, m.user_id, 'document_overdue', 'Overdue document: ' || r.label,
                             r.full_name, r.case_id, 'overdue_item:' || r.id || ':' || r.due_date)
        from public.memberships m where m.org_id = p_org and m.role in ('owner', 'admin');
    end if;
  end loop;

  -- 3. overdue tasks
  for r in
    select t.id, t.title, t.due_date, t.case_id, t.assignee_id, c.assigned_to, a.full_name
      from public.tasks t
      join public.cases c on c.id = t.case_id and c.org_id = t.org_id
      join public.applicants a on a.id = c.applicant_id
     where t.org_id = p_org and t.status = 'open' and t.due_date < current_date
  loop
    perform private.notify(p_org, coalesce(r.assignee_id, r.assigned_to), 'task_overdue',
                           'Overdue task: ' || r.title, r.full_name, r.case_id,
                           'overdue_task:' || r.id || ':' || r.due_date);
  end loop;
end $$;

-- Service-role entry point (daily cron). p_org = null runs every organisation.
create function public.run_maintenance(p_org uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_n integer := 0;
begin
  for r in select id from public.organizations where p_org is null or id = p_org loop
    perform private.run_org_maintenance(r.id);
    update public.organizations set last_maintenance_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.stripe_events where received_at < now() - interval '60 days';
  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
  return v_n;
end $$;

-- Member entry point: at most once per 30 minutes per organisation.
create function public.touch_maintenance(p_org uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz;
begin
  if p_org not in (select private.my_org_ids()) then raise exception 'forbidden'; end if;
  select last_maintenance_at into v_last from public.organizations where id = p_org for update;
  if v_last is not null and v_last > now() - interval '30 minutes' then return false; end if;
  update public.organizations set last_maintenance_at = now() where id = p_org;
  perform private.run_org_maintenance(p_org);
  return true;
end $$;

revoke execute on function
  public.apply_checklist_template(uuid[], uuid), public.run_maintenance(uuid), public.touch_maintenance(uuid)
  from public, anon, authenticated;
grant execute on function public.apply_checklist_template(uuid[], uuid), public.touch_maintenance(uuid)
  to authenticated;
grant execute on function public.run_maintenance(uuid) to service_role;
