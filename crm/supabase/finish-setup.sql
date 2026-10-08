-- ClearEntry Teams: finish database setup (run ONCE in Supabase > SQL Editor).
-- Everything runs as one transaction: if anything fails nothing is changed, and the error is shown.

create function public.remove_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.org_role;
  v_target public.org_role;
begin
  select role into v_caller from public.memberships where org_id = p_org and user_id = v_uid;
  select role into v_target from public.memberships where org_id = p_org and user_id = p_user;
  if v_caller is null or v_target is null then raise exception 'not_found'; end if;
  if p_user <> v_uid then
    if v_caller not in ('owner', 'admin') then raise exception 'forbidden'; end if;
    if v_caller = 'admin' and v_target in ('owner', 'admin') then raise exception 'forbidden'; end if;
  end if;
  if v_target = 'owner' and (select count(*) from public.memberships where org_id = p_org and role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;
  -- Hand the removed member's cases back to the pool rather than leaving them orphaned.
  update public.cases set assigned_to = null where org_id = p_org and assigned_to = p_user;
  delete from public.memberships where org_id = p_org and user_id = p_user;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, v_uid, case when p_user = v_uid then 'member.left' else 'member.removed' end,
          'membership', p_user, jsonb_build_object('role', v_target));
end $$;

revoke execute on function
  public.create_organization(text), public.accept_invitation(text),
  public.set_member_role(uuid, uuid, public.org_role, boolean), public.remove_member(uuid, uuid)
  from public, anon;
grant execute on function
  public.create_organization(text), public.accept_invitation(text),
  public.set_member_role(uuid, uuid, public.org_role, boolean), public.remove_member(uuid, uuid)
  to authenticated;

-- >>> 20261005000002_activity_audit_notifications.sql
-- ============================================================================
-- 02 ACTIVITY, AUDIT, NOTIFICATIONS, RATE LIMITS
-- Clients can only READ these tables. All writes happen inside SECURITY DEFINER
-- helpers/triggers so actors cannot be forged and the audit trail is append-only.
-- ============================================================================

-- Activity stream: powers the live feed and the per-case timeline.
-- Payloads never hold personal data; names are resolved through joins at read time,
-- so deleting an applicant removes every trace of them (right to erasure).
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'applicant', 'system')),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade
);
create index activity_org_created_idx on public.activity_events (org_id, created_at desc);
create index activity_case_created_idx on public.activity_events (case_id, created_at desc);
alter table public.activity_events enable row level security;

-- Audit log: stage changes, document verification, role changes, deletions, ...
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'applicant', 'system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_org_created_idx on public.audit_log (org_id, created_at desc);
create index audit_entity_idx on public.audit_log (entity_id);
alter table public.audit_log enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  case_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;

-- Postgres-backed fixed-window rate limiter (works across serverless instances).
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.rate_limits enable row level security;

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- Writers
-- ---------------------------------------------------------------------------
create function private.current_actor_type() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('app.actor_type', true), ''),
    case when (select auth.uid()) is null then 'system' else 'user' end
  )
$$;

create function private.log_activity(
  p_org uuid, p_case uuid, p_type text, p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_events (org_id, case_id, actor_id, actor_type, type, payload)
  values (p_org, p_case,
          case when private.current_actor_type() = 'user' then (select auth.uid()) else null end,
          private.current_actor_type(), p_type, coalesce(p_payload, '{}'::jsonb));
end $$;

create function private.log_audit(
  p_org uuid, p_action text, p_entity_type text, p_entity_id uuid, p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (org_id, actor_id, actor_type, action, entity_type, entity_id, metadata)
  values (p_org,
          case when private.current_actor_type() = 'user' then (select auth.uid()) else null end,
          private.current_actor_type(), p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb));
end $$;

create function private.notify(
  p_org uuid, p_user uuid, p_type text, p_title text, p_body text, p_case uuid, p_dedupe text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  -- only members of the organisation can be notified about its data
  if not exists (select 1 from public.memberships where org_id = p_org and user_id = p_user) then return; end if;
  insert into public.notifications (org_id, user_id, type, title, body, case_id, dedupe_key)
  values (p_org, p_user, p_type, p_title, p_body, p_case, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
end $$;

-- Notify the assigned advisor plus every owner/admin (deduplicated), except `p_except`.
create function private.notify_case_team(
  p_case uuid, p_type text, p_title text, p_body text, p_dedupe text, p_except uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_assigned uuid; r record;
begin
  select org_id, assigned_to into v_org, v_assigned from public.cases where id = p_case;
  if v_org is null then return; end if;
  for r in
    select distinct u from (
      select v_assigned as u
      union all
      select user_id from public.memberships where org_id = v_org and role in ('owner', 'admin')
    ) t where u is not null and u is distinct from p_except
  loop
    perform private.notify(v_org, r.u, p_type, p_title, p_body, p_case, p_dedupe);
  end loop;
end $$;

-- Client-callable logger for a short whitelist of org-level events (imports, exports, ...).
create function public.log_client_activity(p_org uuid, p_type text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_org not in (select private.my_writer_org_ids()) then raise exception 'forbidden'; end if;
  if p_type not in ('import_completed', 'export_created', 'report_generated') then
    raise exception 'invalid_activity_type';
  end if;
  perform private.log_activity(p_org, null, p_type, p_payload);
  if p_type = 'export_created' or p_type = 'import_completed' then
    perform private.log_audit(p_org, replace(p_type, '_', '.'), 'organization', p_org, p_payload);
  end if;
end $$;

-- Fixed-window rate limiter. Returns true when the call is allowed.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy activity_select on public.activity_events for select to authenticated
  using (
    case
      when case_id is null then org_id in (select private.my_wide_org_ids())
      else org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids())
    end
  );

create policy audit_select on public.audit_log for select to authenticated
  using (org_id in (select private.my_admin_org_ids()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
-- rate_limits and stripe_events: RLS enabled with no policies = service role only.

revoke execute on function
  public.log_client_activity(uuid, text, jsonb), public.rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.log_client_activity(uuid, text, jsonb) to authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- >>> 20261005000003_checklists_tasks_portal.sql
-- ============================================================================
-- 03 CHECKLISTS, DOCUMENTS, TASKS, PORTAL LINKS, SAVED VIEWS
-- Child tables use composite (case_id, org_id) foreign keys so a row can never
-- point at a case that belongs to another organisation.
-- ============================================================================

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  destination char(2) not null check (destination ~ '^[A-Z]{2}$'),
  visa_type public.visa_type not null,
  nationality char(2) check (nationality is null or nationality ~ '^[A-Z]{2}$'),
  official_source_name text check (official_source_name is null or char_length(official_source_name) <= 200),
  official_source_url text check (official_source_url is null or char_length(official_source_url) <= 1000),
  source_last_checked date,
  notes text check (notes is null or char_length(notes) <= 5000),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create unique index checklist_templates_match_idx
  on public.checklist_templates (org_id, destination, visa_type, coalesce(nationality, '--'));
alter table public.checklist_templates enable row level security;
create trigger checklist_templates_touch before update on public.checklist_templates
  for each row execute function private.touch_updated_at();
create trigger checklist_templates_lock before update on public.checklist_templates
  for each row execute function private.lock_org_id();

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  required boolean not null default true,
  due_days_before_start integer check (due_days_before_start is null or due_days_before_start between 0 and 730),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (template_id, org_id) references public.checklist_templates (id, org_id) on delete cascade
);
create index template_items_template_idx on public.checklist_template_items (template_id, sort_order);
alter table public.checklist_template_items enable row level security;
create trigger template_items_lock before update on public.checklist_template_items
  for each row execute function private.lock_org_id();

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null,
  template_item_id uuid,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  required boolean not null default true,
  status public.item_status not null default 'missing',
  due_date date,
  comment text check (comment is null or char_length(comment) <= 2000),
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade,
  foreign key (template_item_id, org_id) references public.checklist_template_items (id, org_id)
    on delete set null (template_item_id)
);
create index checklist_items_case_idx on public.checklist_items (case_id, sort_order);
create index checklist_items_due_idx on public.checklist_items (org_id, due_date) where due_date is not null;
create unique index checklist_items_template_unique
  on public.checklist_items (case_id, template_item_id) where template_item_id is not null;
alter table public.checklist_items enable row level security;
create trigger checklist_items_lock before update on public.checklist_items
  for each row execute function private.lock_org_id();

create table public.checklist_item_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null,
  item_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 300),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_via text not null default 'staff' check (uploaded_via in ('staff', 'portal')),
  created_at timestamptz not null default now(),
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade,
  foreign key (item_id, org_id) references public.checklist_items (id, org_id) on delete cascade
);
create index item_files_item_idx on public.checklist_item_files (item_id);
create index item_files_case_idx on public.checklist_item_files (case_id);
alter table public.checklist_item_files enable row level security;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 5000),
  assignee_id uuid references auth.users (id) on delete set null,
  due_date date,
  status public.task_status not null default 'open',
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade
);
create index tasks_case_idx on public.tasks (case_id);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_due_idx on public.tasks (org_id, due_date) where status = 'open';
alter table public.tasks enable row level security;
create trigger tasks_lock before update on public.tasks
  for each row execute function private.lock_org_id();

-- Applicant portal links: only a SHA-256 hash of the token is stored.
create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null,
  token_hash text not null unique,
  label text check (label is null or char_length(label) <= 120),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  use_count integer not null default 0,
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade
);
create index portal_links_case_idx on public.portal_links (case_id);
alter table public.portal_links enable row level security;

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  page text not null default 'applicants' check (page in ('applicants', 'pipeline')),
  config jsonb not null default '{}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index saved_views_org_idx on public.saved_views (org_id, page);
alter table public.saved_views enable row level security;

-- ---------------------------------------------------------------------------
-- Same-tenant guards that FKs cannot express
-- ---------------------------------------------------------------------------
-- assigned_to / assignee_id must be a member of the same organisation
create function private.assert_member_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  v_user := (case when tg_table_name = 'cases' then to_jsonb(new) ->> 'assigned_to'
                  else to_jsonb(new) ->> 'assignee_id' end)::uuid;
  if v_user is not null and not exists (
    select 1 from public.memberships where org_id = new.org_id and user_id = v_user
  ) then
    raise exception 'invalid_assignee';
  end if;
  return new;
end $$;
create trigger cases_assignee_check before insert or update of assigned_to on public.cases
  for each row execute function private.assert_member_assignee();
create trigger tasks_assignee_check before insert or update of assignee_id on public.tasks
  for each row execute function private.assert_member_assignee();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy templates_select on public.checklist_templates for select to authenticated
  using (org_id in (select private.my_org_ids()));
create policy templates_insert on public.checklist_templates for insert to authenticated
  with check (org_id in (select private.my_admin_org_ids()));
create policy templates_update on public.checklist_templates for update to authenticated
  using (org_id in (select private.my_admin_org_ids()))
  with check (org_id in (select private.my_admin_org_ids()));
create policy templates_delete on public.checklist_templates for delete to authenticated
  using (org_id in (select private.my_admin_org_ids()));

create policy template_items_select on public.checklist_template_items for select to authenticated
  using (org_id in (select private.my_org_ids()));
create policy template_items_insert on public.checklist_template_items for insert to authenticated
  with check (org_id in (select private.my_admin_org_ids()));
create policy template_items_update on public.checklist_template_items for update to authenticated
  using (org_id in (select private.my_admin_org_ids()))
  with check (org_id in (select private.my_admin_org_ids()));
create policy template_items_delete on public.checklist_template_items for delete to authenticated
  using (org_id in (select private.my_admin_org_ids()));

-- Case-scoped child tables share one access rule.
do $$
declare t text;
begin
  foreach t in array array['checklist_items', 'checklist_item_files'] loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated
      using (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
    $f$, t);
    execute format($f$
      create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (
        org_id in (select private.my_writer_org_ids())
        and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
      )
    $f$, t);
    execute format($f$
      create policy %1$s_delete on public.%1$s for delete to authenticated
      using (
        org_id in (select private.my_writer_org_ids())
        and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
      )
    $f$, t);
  end loop;
end $$;

create policy checklist_items_update on public.checklist_items for update to authenticated
  using (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
  )
  with check (org_id in (select private.my_writer_org_ids()));

-- tasks: also visible/updatable by their assignee
create policy tasks_select on public.tasks for select to authenticated
  using (
    org_id in (select private.my_wide_org_ids())
    or case_id in (select private.my_assigned_case_ids())
    or (assignee_id = (select auth.uid()) and org_id in (select private.my_org_ids()))
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
  );
create policy tasks_update on public.tasks for update to authenticated
  using (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids())
         or case_id in (select private.my_assigned_case_ids())
         or assignee_id = (select auth.uid()))
  )
  with check (org_id in (select private.my_writer_org_ids()));
create policy tasks_delete on public.tasks for delete to authenticated
  using (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
  );

-- portal links: creating them is a Premium feature
create policy portal_links_select on public.portal_links for select to authenticated
  using (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()));
create policy portal_links_insert on public.portal_links for insert to authenticated
  with check (
    org_id in (select private.my_writer_org_ids())
    and private.org_can_use(org_id, 'portal')
    and created_by = (select auth.uid())
    and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
  );
create policy portal_links_update on public.portal_links for update to authenticated
  using (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids()) or case_id in (select private.my_assigned_case_ids()))
  )
  with check (org_id in (select private.my_writer_org_ids()));

-- saved views: your own plus those shared inside the organisation
create policy saved_views_select on public.saved_views for select to authenticated
  using (
    org_id in (select private.my_org_ids())
    and (user_id = (select auth.uid()) or shared)
  );
create policy saved_views_insert on public.saved_views for insert to authenticated
  with check (org_id in (select private.my_org_ids()) and user_id = (select auth.uid()));
create policy saved_views_update on public.saved_views for update to authenticated
  using (user_id = (select auth.uid()))
  with check (org_id in (select private.my_org_ids()) and user_id = (select auth.uid()));
create policy saved_views_delete on public.saved_views for delete to authenticated
  using (user_id = (select auth.uid()));

-- >>> 20261005000004_triggers.sql
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

-- >>> 20261005000005_risk_views_analytics.sql
-- ============================================================================
-- 05 RISK ENGINE, READ MODELS AND ANALYTICS
--
-- Risk model (transparent, configurable per organisation):
--   days_to_start   = start_date - today
--   before submission:  est_days_needed = max(doc_prep_remaining, appointment_remaining) + processing_days
--        doc_prep_remaining   = ceil(doc_prep_days * (1 - docs_verified / docs_total))
--        appointment_remaining= days until the appointment if one is dated,
--                               0 if booked without a date, else appointment_wait_days
--   after submission:   est_days_needed = max(processing_days - days_since_submission, 0)
--   slack_days      = days_to_start - est_days_needed
--   level           = high   if slack < high_buffer_days or the start date has passed
--                     medium if slack < medium_buffer_days
--                     low    otherwise
-- The same arithmetic is mirrored in src/lib/risk.ts and parity-tested.
-- ============================================================================

create function private.risk_calc(
  p_stage public.case_stage, p_start date, p_appt date, p_submitted timestamptz,
  p_docs_total integer, p_docs_verified integer,
  p_processing integer, p_appt_wait integer, p_doc_prep integer,
  p_high_buffer integer, p_medium_buffer integer,
  p_today date default current_date
) returns table (
  level text, reason text, days_to_start integer, est_days_needed integer,
  slack_days integer, docs_pct integer
)
language plpgsql immutable as $$
declare
  v_ord smallint := private.stage_ord(p_stage);
  v_pct integer;
  v_doc_rem integer;
  v_appt_rem integer;
  v_pre integer;
  v_proc_rem integer;
  v_need integer;
  v_dts integer;
  v_slack integer;
  v_level text;
  v_parts text[];
  v_since integer;
begin
  if not private.is_open_stage(p_stage) then
    return query select null::text, null::text, null::integer, null::integer, null::integer, null::integer;
    return;
  end if;
  v_pct := case when p_docs_total > 0 then round(100.0 * p_docs_verified / p_docs_total)::integer else 0 end;
  if p_start is null then
    return query select null::text, 'No start date set'::text, null::integer, null::integer, null::integer, v_pct;
    return;
  end if;

  v_dts := p_start - p_today;
  v_parts := array[case when v_dts >= 0 then 'Starts in ' || v_dts || 'd' else 'Started ' || (-v_dts) || 'd ago' end];

  if v_ord >= 4 then
    v_since := greatest(coalesce(p_today - p_submitted::date, 0), 0);
    v_pre := 0;
    v_proc_rem := greatest(p_processing - v_since, 0);
    v_parts := array_append(v_parts, 'submitted ' || v_since || 'd ago');
  else
    v_doc_rem := ceil(p_doc_prep * (1 - v_pct / 100.0))::integer;
    if p_appt is not null then
      v_appt_rem := greatest(p_appt - p_today, 0);
      v_parts := array_append(v_parts, case when p_appt < p_today then 'appointment date passed'
                                  else 'appointment in ' || (p_appt - p_today) || 'd' end);
    elsif v_ord >= 3 then
      v_appt_rem := 0;
      v_parts := array_append(v_parts, 'appointment booked');
    else
      v_appt_rem := p_appt_wait;
      v_parts := array_append(v_parts, 'no appointment');
    end if;
    v_pre := greatest(v_doc_rem, v_appt_rem);
    v_proc_rem := p_processing;
    v_parts := array_append(v_parts, case when p_docs_total > 0 then v_pct || '% docs verified' else 'no checklist' end);
  end if;

  v_need := v_pre + v_proc_rem;
  v_slack := v_dts - v_need;
  v_level := case
    when v_dts < 0 then 'high'
    when v_slack < p_high_buffer then 'high'
    when v_slack < p_medium_buffer then 'medium'
    else 'low' end;
  v_parts := array_append(v_parts, 'needs ~' || v_need || 'd');

  return query select v_level, array_to_string(v_parts, ' · '), v_dts, v_need, v_slack, v_pct;
end $$;
grant execute on function private.risk_calc(
  public.case_stage, date, date, timestamptz, integer, integer, integer, integer, integer, integer, integer, date
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Central read model: one row per case, with applicant, advisor and live risk
-- ---------------------------------------------------------------------------
create view public.case_overview with (security_invoker = true) as
select
  c.id, c.org_id, c.applicant_id,
  a.full_name, a.email, a.phone,
  a.nationality::text as nationality, a.residence_country::text as residence_country,
  c.destination::text as destination, c.visa_type, c.purpose, c.programme, c.intake,
  c.start_date, c.appointment_date, c.stage, c.max_stage_ord,
  c.assigned_to, p.full_name as advisor_name, p.avatar_url as advisor_avatar,
  c.tags, c.notes, c.opened_on, c.submitted_at, c.decided_at, c.decision_reason, c.stage_changed_at,
  c.docs_total, c.docs_verified, c.docs_received,
  r.docs_pct, r.level as risk_level, r.reason as risk_reason,
  r.days_to_start, r.est_days_needed, r.slack_days,
  c.created_by, c.updated_by, c.created_at, c.updated_at
from public.cases c
join public.applicants a on a.id = c.applicant_id
left join public.profiles p on p.id = c.assigned_to
left join public.org_settings os on os.org_id = c.org_id
left join lateral (
  select pt.processing_days, pt.appointment_wait_days, pt.doc_prep_days
    from public.processing_times pt
   where pt.org_id = c.org_id and pt.destination = c.destination
     and pt.visa_type in (c.visa_type::text, 'any')
   order by (pt.visa_type = c.visa_type::text) desc
   limit 1
) pt on true
cross join lateral private.risk_calc(
  c.stage, c.start_date, c.appointment_date, c.submitted_at, c.docs_total, c.docs_verified,
  coalesce(pt.processing_days, os.default_processing_days, 30),
  coalesce(pt.appointment_wait_days, os.default_appointment_wait_days, 14),
  coalesce(pt.doc_prep_days, os.default_doc_prep_days, 21),
  coalesce(os.high_buffer_days, 0), coalesce(os.medium_buffer_days, 14)
) r;

-- Safe JSON array -> text[] helper (null when absent or empty)
create function private.jarr(f jsonb, k text) returns text[]
language sql immutable as $$
  select case when jsonb_typeof(f -> k) = 'array' and jsonb_array_length(f -> k) > 0
              then array(select jsonb_array_elements_text(f -> k)) end
$$;
grant execute on function private.jarr(jsonb, text) to authenticated, service_role;

-- One filter implementation shared by the grid, board, exports, reports and analytics.
-- Recognised keys: intake[], destination[], nationality[], visa_type[], stage[], risk[],
-- advisor[] ('unassigned' allowed), tag[], opened_from/opened_to, submitted_from/submitted_to,
-- decided_from/decided_to, reached_min, open, decided.
create function public.filtered_cases(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns setof public.case_overview
language sql stable as $$
  select c.* from public.case_overview c
  where c.org_id = p_org
    and (private.jarr(p_filters, 'intake') is null or c.intake = any (private.jarr(p_filters, 'intake')))
    and (private.jarr(p_filters, 'destination') is null or c.destination = any (private.jarr(p_filters, 'destination')))
    and (private.jarr(p_filters, 'nationality') is null or c.nationality = any (private.jarr(p_filters, 'nationality')))
    and (private.jarr(p_filters, 'visa_type') is null or c.visa_type::text = any (private.jarr(p_filters, 'visa_type')))
    and (private.jarr(p_filters, 'stage') is null or c.stage::text = any (private.jarr(p_filters, 'stage')))
    and (private.jarr(p_filters, 'risk') is null or coalesce(c.risk_level, 'none') = any (private.jarr(p_filters, 'risk')))
    and (private.jarr(p_filters, 'tag') is null or c.tags && private.jarr(p_filters, 'tag'))
    and (private.jarr(p_filters, 'advisor') is null
         or c.assigned_to::text = any (private.jarr(p_filters, 'advisor'))
         or ('unassigned' = any (private.jarr(p_filters, 'advisor')) and c.assigned_to is null))
    and (nullif(p_filters ->> 'opened_from', '') is null or c.opened_on >= (p_filters ->> 'opened_from')::date)
    and (nullif(p_filters ->> 'opened_to', '') is null or c.opened_on <= (p_filters ->> 'opened_to')::date)
    and (nullif(p_filters ->> 'submitted_from', '') is null or c.submitted_at::date >= (p_filters ->> 'submitted_from')::date)
    and (nullif(p_filters ->> 'submitted_to', '') is null or c.submitted_at::date <= (p_filters ->> 'submitted_to')::date)
    and (nullif(p_filters ->> 'decided_from', '') is null or c.decided_at::date >= (p_filters ->> 'decided_from')::date)
    and (nullif(p_filters ->> 'decided_to', '') is null or c.decided_at::date <= (p_filters ->> 'decided_to')::date)
    and (nullif(p_filters ->> 'reached_min', '') is null or c.max_stage_ord >= (p_filters ->> 'reached_min')::integer)
    and (coalesce(p_filters ->> 'open', '') <> 'true' or private.is_open_stage(c.stage))
    and (coalesce(p_filters ->> 'decided', '') <> 'true' or c.stage in ('approved', 'refused'))
$$;

-- ---------------------------------------------------------------------------
-- Other read models
-- ---------------------------------------------------------------------------
create view public.activity_feed with (security_invoker = true) as
select e.id, e.org_id, e.case_id, a.full_name as applicant_name,
       e.actor_id, p.full_name as actor_name, p.avatar_url as actor_avatar,
       e.actor_type, e.type, e.payload, e.created_at
  from public.activity_events e
  left join public.cases c on c.id = e.case_id
  left join public.applicants a on a.id = c.applicant_id
  left join public.profiles p on p.id = e.actor_id;

create view public.member_directory with (security_invoker = true) as
select m.org_id, m.user_id, m.role, m.can_view_all, m.created_at,
       p.full_name, p.email, p.avatar_url
  from public.memberships m
  join public.profiles p on p.id = m.user_id;

create view public.deadline_items with (security_invoker = true) as
select c.org_id, 'start_date'::text as kind, c.id as ref_id, c.id as case_id,
       a.full_name as applicant_name, null::text as title, c.start_date as due_date,
       c.assigned_to as owner_id, c.stage
  from public.cases c join public.applicants a on a.id = c.applicant_id
 where private.is_open_stage(c.stage) and c.start_date is not null
union all
select c.org_id, 'appointment', c.id, c.id, a.full_name, null, c.appointment_date, c.assigned_to, c.stage
  from public.cases c join public.applicants a on a.id = c.applicant_id
 where private.is_open_stage(c.stage) and c.appointment_date is not null
   and (c.max_stage_ord < 4 or c.appointment_date >= current_date)
union all
select i.org_id, 'document', i.id, i.case_id, a.full_name, i.label, i.due_date, c.assigned_to, c.stage
  from public.checklist_items i
  join public.cases c on c.id = i.case_id
  join public.applicants a on a.id = c.applicant_id
 where i.due_date is not null and i.status in ('missing', 'needs_redo')
   and private.is_open_stage(c.stage)
union all
select t.org_id, 'task', t.id, t.case_id, a.full_name, t.title, t.due_date,
       coalesce(t.assignee_id, c.assigned_to), c.stage
  from public.tasks t
  join public.cases c on c.id = t.case_id
  join public.applicants a on a.id = c.applicant_id
 where t.status = 'open' and t.due_date is not null;

-- ---------------------------------------------------------------------------
-- Analytics RPCs (SECURITY INVOKER: RLS limits advisors to their own cases;
-- Premium-only, enforced here as well as in the UI)
-- ---------------------------------------------------------------------------
create function private.kpi_block(p_org uuid, p_filters jsonb) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where private.is_open_stage(stage)),
    'approved', count(*) filter (where stage = 'approved'),
    'refused', count(*) filter (where stage = 'refused'),
    'acceptance_rate', case when count(*) filter (where stage in ('approved', 'refused')) > 0
        then round(100.0 * count(*) filter (where stage = 'approved')
                   / count(*) filter (where stage in ('approved', 'refused')), 1) end,
    'high_risk', count(*) filter (where risk_level = 'high'),
    'median_admission_to_decision_days',
        round((percentile_cont(0.5) within group (order by (decided_at::date - opened_on))
               filter (where decided_at is not null))::numeric, 1),
    'median_submission_to_decision_days',
        round((percentile_cont(0.5) within group (order by (decided_at::date - submitted_at::date))
               filter (where decided_at is not null and submitted_at is not null))::numeric, 1),
    'docs_verified_pct', case when coalesce(sum(docs_total) filter (where private.is_open_stage(stage)), 0) > 0
        then round(100.0 * sum(docs_verified) filter (where private.is_open_stage(stage))
                   / sum(docs_total) filter (where private.is_open_stage(stage)), 1) end
  )
  from public.filtered_cases(p_org, p_filters)
$$;

create function public.analytics_kpis(p_org uuid, p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable as $$
declare
  v_from date := nullif(p_filters ->> 'opened_from', '')::date;
  v_to date := nullif(p_filters ->> 'opened_to', '')::date;
  v_len integer;
  v_cur jsonb;
  v_prev jsonb;
  v_today integer;
  v_yesterday integer;
  v_scope jsonb := p_filters - 'opened_from' - 'opened_to';
begin
  perform private.assert_feature(p_org, 'analytics');
  v_cur := private.kpi_block(p_org, p_filters);
  if v_from is not null and v_to is not null and v_to >= v_from then
    v_len := v_to - v_from + 1;
    v_prev := private.kpi_block(p_org, p_filters || jsonb_build_object(
      'opened_from', (v_from - v_len)::text, 'opened_to', (v_from - 1)::text));
  end if;
  select count(*) filter (where e.created_at >= date_trunc('day', now())),
         count(*) filter (where e.created_at >= date_trunc('day', now()) - interval '1 day'
                          and e.created_at < date_trunc('day', now()))
    into v_today, v_yesterday
    from public.activity_events e
   where e.org_id = p_org and e.type = 'stage_changed'
     and e.case_id in (select id from public.filtered_cases(p_org, v_scope));
  return jsonb_build_object('current', v_cur, 'previous', v_prev,
                            'stage_moves_today', v_today, 'stage_moves_yesterday', v_yesterday);
end $$;

create function public.analytics_funnel(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns table (step text, ord integer, reached bigint)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  return query
  with c as (select max_stage_ord, stage from public.filtered_cases(p_org, p_filters))
  select s.step, s.ord, (
    case s.ord
      when 7 then (select count(*) from c where stage = 'approved')
      else (select count(*) from c where max_stage_ord >= s.ord)
    end) as reached
  from (values
    ('admitted', 1), ('documents', 2), ('appointment', 3), ('submitted', 4),
    ('decision_pending', 5), ('decided', 6), ('approved', 7)
  ) as s(step, ord)
  order by s.ord;
end $$;

create function public.analytics_throughput(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns table (week date, submissions bigint, approvals bigint, refusals bigint)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  return query
  with c as (select submitted_at, decided_at, stage from public.filtered_cases(p_org, p_filters)),
  bounds as (
    select greatest(
             date_trunc('week', least(min(submitted_at), min(decided_at)))::date,
             (date_trunc('week', now()) - interval '103 weeks')::date) as lo
      from c where submitted_at is not null or decided_at is not null
  ),
  series as (
    select generate_series(b.lo, date_trunc('week', now())::date, interval '1 week')::date as wk
      from bounds b where b.lo is not null
  ),
  sub as (select date_trunc('week', submitted_at)::date as wk, count(*) as n from c where submitted_at is not null group by 1),
  app as (select date_trunc('week', decided_at)::date as wk, count(*) as n from c where stage = 'approved' and decided_at is not null group by 1),
  ref as (select date_trunc('week', decided_at)::date as wk, count(*) as n from c where stage = 'refused' and decided_at is not null group by 1)
  select s.wk, coalesce(sub.n, 0), coalesce(app.n, 0), coalesce(ref.n, 0)
    from series s
    left join sub on sub.wk = s.wk
    left join app on app.wk = s.wk
    left join ref on ref.wk = s.wk
   order by s.wk;
end $$;

create function public.analytics_acceptance(p_org uuid, p_filters jsonb default '{}'::jsonb, p_dimension text default 'destination')
returns table (key text, decided bigint, approved bigint, refused bigint, rate numeric)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  if p_dimension not in ('destination', 'nationality', 'visa_type', 'intake') then
    raise exception 'invalid_dimension';
  end if;
  return query
  select d.k, count(*), count(*) filter (where d.stage = 'approved'), count(*) filter (where d.stage = 'refused'),
         round(100.0 * count(*) filter (where d.stage = 'approved') / count(*), 1)
    from (
      select case p_dimension
               when 'destination' then c.destination
               when 'nationality' then coalesce(c.nationality, '??')
               when 'visa_type' then c.visa_type::text
               else coalesce(c.intake, '(none)') end as k,
             c.stage
        from public.filtered_cases(p_org, p_filters) c
       where c.stage in ('approved', 'refused')
    ) d
   group by d.k
   order by count(*) desc, d.k;
end $$;

create function public.analytics_stage_times(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns table (stage text, ord integer, finished bigint, avg_days numeric, median_days numeric, open_now bigint, avg_open_days numeric)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  return query
  with ids as (select id from public.filtered_cases(p_org, p_filters)),
  h as (
    select h.stage, h.entered_at, h.exited_at
      from public.case_stage_history h join ids on ids.id = h.case_id
  )
  select s.stage::text, s.ord,
         count(h.stage) filter (where h.exited_at is not null),
         round((avg(extract(epoch from h.exited_at - h.entered_at) / 86400.0) filter (where h.exited_at is not null))::numeric, 1),
         round((percentile_cont(0.5) within group (order by extract(epoch from h.exited_at - h.entered_at) / 86400.0)
                filter (where h.exited_at is not null))::numeric, 1),
         count(h.stage) filter (where h.exited_at is null),
         round((avg(extract(epoch from now() - h.entered_at) / 86400.0) filter (where h.exited_at is null))::numeric, 1)
    from (values
      ('admitted'::public.case_stage, 1), ('documents', 2), ('appointment', 3),
      ('submitted', 4), ('decision_pending', 5)
    ) as s(stage, ord)
    left join h on h.stage = s.stage
   group by s.stage, s.ord
   order by s.ord;
end $$;

create function public.analytics_horizon(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns table (
  case_id uuid, full_name text, destination text, stage public.case_stage, start_date date,
  days_to_start integer, docs_pct integer, risk_level text, slack_days integer
)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  return query
  select c.id, c.full_name, c.destination, c.stage, c.start_date, c.days_to_start, c.docs_pct, c.risk_level, c.slack_days
    from public.filtered_cases(p_org, p_filters || '{"open": "true"}'::jsonb) c
   where c.start_date is not null
   order by c.days_to_start
   limit 3000;
end $$;

create function public.analytics_cohorts(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns table (
  intake text, weeks_before integer, total bigint,
  documents_plus bigint, appointment_plus bigint, submitted_plus bigint, decided_plus bigint
)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  return query
  with c as (
    select f.id, f.intake, f.start_date, f.opened_on
      from public.filtered_cases(p_org, p_filters) f
     where f.intake is not null and f.start_date is not null
  ),
  x as (
    select c.intake, g.wk, c.id, c.opened_on,
           ((c.start_date - g.wk * 7 + 1)::timestamp at time zone 'UTC') as t
      from c cross join generate_series(0, 24) as g(wk)
  )
  select x.intake, x.wk, count(*) filter (where o.ord is not null),
         count(*) filter (where o.ord >= 2), count(*) filter (where o.ord >= 3),
         count(*) filter (where o.ord >= 4), count(*) filter (where o.ord >= 6)
    from x
    left join lateral (
      select coalesce(
               (select greatest(max(private.stage_ord(h.stage)), 1)
                  from public.case_stage_history h where h.case_id = x.id and h.entered_at <= x.t),
               case when x.opened_on::timestamp at time zone 'UTC' <= x.t then 1 end
             ) as ord
    ) o on true
   where x.t <= now()
   group by x.intake, x.wk
   order by x.intake, x.wk desc;
end $$;

create function public.analytics_advisors(p_org uuid, p_filters jsonb default '{}'::jsonb)
returns table (
  advisor_id uuid, advisor_name text, open_cases bigint, high_risk bigint,
  overdue_tasks bigint, decided bigint, approved bigint, acceptance_rate numeric
)
language plpgsql stable as $$
begin
  perform private.assert_feature(p_org, 'analytics');
  return query
  with c as (select * from public.filtered_cases(p_org, p_filters)),
  per_case as (
    select c.assigned_to as aid,
           count(*) filter (where private.is_open_stage(c.stage)) as open_cases,
           count(*) filter (where c.risk_level = 'high') as high_risk,
           count(*) filter (where c.stage in ('approved', 'refused')) as decided,
           count(*) filter (where c.stage = 'approved') as approved
      from c group by c.assigned_to
  ),
  per_task as (
    select t.assignee_id as aid, count(*) as overdue
      from public.tasks t
     where t.org_id = p_org and t.status = 'open' and t.due_date < current_date
       and t.case_id in (select id from c)
     group by t.assignee_id
  )
  select coalesce(pc.aid, pt.aid), p.full_name,
         coalesce(pc.open_cases, 0), coalesce(pc.high_risk, 0), coalesce(pt.overdue, 0),
         coalesce(pc.decided, 0), coalesce(pc.approved, 0),
         case when coalesce(pc.decided, 0) > 0 then round(100.0 * pc.approved / pc.decided, 1) end
    from per_case pc
    full join per_task pt on pt.aid = pc.aid
    left join public.profiles p on p.id = coalesce(pc.aid, pt.aid)
   order by coalesce(pc.open_cases, 0) desc, p.full_name;
end $$;

-- Values for the global filter dropdowns (not plan-gated; reads only what RLS allows)
create function public.filter_options(p_org uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'intakes', coalesce((select jsonb_agg(i order by i) from (select distinct intake as i from public.cases where org_id = p_org and intake is not null) q), '[]'::jsonb),
    'destinations', coalesce((select jsonb_agg(d order by d) from (select distinct destination::text as d from public.cases where org_id = p_org) q), '[]'::jsonb),
    'nationalities', coalesce((select jsonb_agg(n order by n) from (select distinct nationality::text as n from public.applicants where org_id = p_org and nationality is not null) q), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(t order by t) from (select distinct unnest(tags) as t from public.cases where org_id = p_org) q), '[]'::jsonb)
  )
$$;

revoke execute on function
  public.filtered_cases(uuid, jsonb), public.analytics_kpis(uuid, jsonb), public.analytics_funnel(uuid, jsonb),
  public.analytics_throughput(uuid, jsonb), public.analytics_acceptance(uuid, jsonb, text),
  public.analytics_stage_times(uuid, jsonb), public.analytics_horizon(uuid, jsonb),
  public.analytics_cohorts(uuid, jsonb), public.analytics_advisors(uuid, jsonb), public.filter_options(uuid)
  from public, anon;
grant execute on function
  public.filtered_cases(uuid, jsonb), public.analytics_kpis(uuid, jsonb), public.analytics_funnel(uuid, jsonb),
  public.analytics_throughput(uuid, jsonb), public.analytics_acceptance(uuid, jsonb, text),
  public.analytics_stage_times(uuid, jsonb), public.analytics_horizon(uuid, jsonb),
  public.analytics_cohorts(uuid, jsonb), public.analytics_advisors(uuid, jsonb), public.filter_options(uuid)
  to authenticated, service_role;

-- >>> 20261005000006_rpcs_privacy_portal.sql
-- ============================================================================
-- 06 IMPORT, PRIVACY (GDPR export / erasure), PORTAL, ORGANISATION DELETION
-- ============================================================================

create function private.applicants_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := (select auth.uid());
  return new;
end $$;
create trigger applicants_before_insert before insert on public.applicants
  for each row execute function private.applicants_before_insert();

-- ---------------------------------------------------------------------------
-- Creating applicants + cases. One function owns the JSON -> row mapping so the
-- single-record form and the bulk import behave identically. Runs as the caller
-- (RLS + plan limits apply).
-- ---------------------------------------------------------------------------
create function private.insert_applicant_case(p_org uuid, r jsonb, p_reuse_by_email boolean)
returns table (applicant_id uuid, case_id uuid, applicant_is_new boolean)
language plpgsql as $$
declare
  v_app uuid;
  v_email text := nullif(lower(btrim(coalesce(r ->> 'email', ''))), '');
  v_new boolean := false;
  v_case uuid;
begin
  if p_reuse_by_email and v_email is not null then
    select a.id into v_app from public.applicants a
     where a.org_id = p_org and lower(a.email) = v_email order by a.created_at limit 1;
  end if;
  if r ? 'applicant_id' and nullif(r ->> 'applicant_id', '') is not null then
    v_app := (r ->> 'applicant_id')::uuid;
  end if;
  if v_app is null then
    insert into public.applicants (org_id, full_name, email, phone, nationality, residence_country)
    values (p_org, btrim(r ->> 'full_name'), v_email, nullif(btrim(coalesce(r ->> 'phone', '')), ''),
            nullif(r ->> 'nationality', ''), nullif(r ->> 'residence_country', ''))
    returning id into v_app;
    v_new := true;
  end if;
  insert into public.cases (
    org_id, applicant_id, destination, visa_type, purpose, programme, intake,
    start_date, appointment_date, stage, assigned_to, tags, notes,
    opened_on, submitted_at, decided_at
  ) values (
    p_org, v_app, r ->> 'destination',
    coalesce(nullif(r ->> 'visa_type', '')::public.visa_type, 'C'),
    nullif(r ->> 'purpose', ''), nullif(r ->> 'programme', ''), nullif(r ->> 'intake', ''),
    nullif(r ->> 'start_date', '')::date, nullif(r ->> 'appointment_date', '')::date,
    coalesce(nullif(r ->> 'stage', '')::public.case_stage, 'admitted'),
    nullif(r ->> 'assigned_to', '')::uuid,
    case when jsonb_typeof(r -> 'tags') = 'array'
         then array(select jsonb_array_elements_text(r -> 'tags')) else '{}'::text[] end,
    nullif(r ->> 'notes', ''),
    coalesce(nullif(r ->> 'opened_on', '')::date, current_date),
    nullif(r ->> 'submitted_at', '')::timestamptz, nullif(r ->> 'decided_at', '')::timestamptz
  ) returning id into v_case;
  return query select v_app, v_case, v_new;
end $$;

create function public.create_applicant_with_case(p_org uuid, p_row jsonb) returns jsonb
language plpgsql as $$
declare v record;
begin
  select * into v from private.insert_applicant_case(p_org, p_row, false);
  return jsonb_build_object('applicant_id', v.applicant_id, 'case_id', v.case_id);
end $$;

-- Bulk import (Premium). Each row is its own subtransaction so one bad row never aborts the
-- chunk; applicants are matched on e-mail within the organisation so re-imports do not
-- duplicate people. Counters only move after a row fully succeeded.
create function public.import_rows(p_org uuid, p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb;
  v record;
  v_new_apps integer := 0;
  v_reused integer := 0;
  v_cases integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_limit boolean := false;
begin
  perform private.assert_feature(p_org, 'import');
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'invalid_rows'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'too_many_rows'; end if;
  perform set_config('app.bulk', 'on', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      select * into v from private.insert_applicant_case(p_org, r, true);
      v_cases := v_cases + 1;
      if v.applicant_is_new then v_new_apps := v_new_apps + 1; else v_reused := v_reused + 1; end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('index', r -> 'idx', 'error', sqlerrm);
      if sqlerrm like 'plan_limit:%' then
        v_limit := true;
        exit;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'cases_created', v_cases, 'applicants_created', v_new_apps, 'applicants_reused', v_reused,
    'errors', v_errors, 'plan_limit_reached', v_limit);
end $$;

-- ---------------------------------------------------------------------------
-- GDPR: export and erasure of one applicant
-- ---------------------------------------------------------------------------
create function public.export_applicant_data(p_applicant uuid) returns jsonb
language plpgsql as $$
declare v_org uuid; v_result jsonb;
begin
  select org_id into v_org from public.applicants where id = p_applicant;  -- RLS: only if visible
  if v_org is null then raise exception 'not_found'; end if;
  select jsonb_build_object(
    'exported_at', now(),
    'applicant', to_jsonb(a) - 'org_id',
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'case', to_jsonb(c) - 'org_id',
        'stage_history', coalesce((select jsonb_agg(to_jsonb(h) - 'org_id' order by h.entered_at) from public.case_stage_history h where h.case_id = c.id), '[]'::jsonb),
        'checklist', coalesce((select jsonb_agg(to_jsonb(i) - 'org_id' order by i.sort_order) from public.checklist_items i where i.case_id = c.id), '[]'::jsonb),
        'files', coalesce((select jsonb_agg(to_jsonb(f) - 'org_id' - 'storage_path') from public.checklist_item_files f where f.case_id = c.id), '[]'::jsonb),
        'tasks', coalesce((select jsonb_agg(to_jsonb(t) - 'org_id') from public.tasks t where t.case_id = c.id), '[]'::jsonb),
        'activity', coalesce((select jsonb_agg(to_jsonb(e) - 'org_id' order by e.created_at) from public.activity_events e where e.case_id = c.id), '[]'::jsonb)
      ) order by c.created_at)
      from public.cases c where c.applicant_id = a.id), '[]'::jsonb)
  ) into v_result
  from public.applicants a where a.id = p_applicant;
  perform private.log_audit(v_org, 'applicant.exported', 'applicant', p_applicant, '{}'::jsonb);
  return v_result;
end $$;

-- Step 1 of erasure: returns the storage objects to remove (owners/admins only).
create function public.erasure_file_paths(p_applicant uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.applicants where id = p_applicant;
  if v_org is null or v_org not in (select private.my_admin_org_ids()) then raise exception 'forbidden'; end if;
  return coalesce((select array_agg(f.storage_path) from public.checklist_item_files f
                    join public.cases c on c.id = f.case_id where c.applicant_id = p_applicant), '{}');
end $$;

-- Step 2: delete the database rows (cascades to cases, items, files, tasks, events,
-- history, portal links, notifications) and scrub audit rows that reference them.
create function public.erase_applicant(p_applicant uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_cases uuid[];
  v_items uuid[];
  v_files integer;
begin
  select org_id into v_org from public.applicants where id = p_applicant;
  if v_org is null or v_org not in (select private.my_admin_org_ids()) then raise exception 'forbidden'; end if;
  select coalesce(array_agg(id), '{}') into v_cases from public.cases where applicant_id = p_applicant;
  select coalesce(array_agg(id), '{}') into v_items from public.checklist_items where case_id = any (v_cases);
  select count(*) into v_files from public.checklist_item_files where case_id = any (v_cases);

  delete from public.applicants where id = p_applicant;  -- cascades to every dependent row

  -- the audit trail keeps that something happened, never what it was about
  update public.audit_log set metadata = '{}'::jsonb
   where org_id = v_org
     and (entity_id = p_applicant or entity_id = any (v_cases) or entity_id = any (v_items));
  perform private.log_audit(v_org, 'applicant.erased', 'applicant', p_applicant,
                            jsonb_build_object('cases', cardinality(v_cases), 'files', v_files));
end $$;

-- ---------------------------------------------------------------------------
-- Organisation deletion (owner only). File paths are returned first so the
-- application can purge storage before the rows disappear.
-- ---------------------------------------------------------------------------
create function public.org_file_paths(p_org uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
begin
  if private.org_role_of(p_org) is distinct from 'owner' then raise exception 'forbidden'; end if;
  return coalesce((select array_agg(storage_path) from public.checklist_item_files where org_id = p_org), '{}');
end $$;

create function public.delete_organization(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.org_role_of(p_org) is distinct from 'owner' then raise exception 'forbidden'; end if;
  delete from public.organizations where id = p_org;
end $$;

-- ---------------------------------------------------------------------------
-- Applicant portal (service role only; the app hashes the bearer token)
-- ---------------------------------------------------------------------------
create function private.portal_link(p_hash text) returns public.portal_links
language sql stable security definer set search_path = '' as $$
  select * from public.portal_links
   where token_hash = p_hash and revoked_at is null and expires_at > now()
$$;

create function public.portal_get(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.portal_links; v_result jsonb;
begin
  l := private.portal_link(p_token_hash);
  if l.id is null then return null; end if;
  if not private.org_can_use(l.org_id, 'portal') then return null; end if;
  update public.portal_links set last_used_at = now(), use_count = use_count + 1 where id = l.id;
  select jsonb_build_object(
    'link_id', l.id, 'org_id', l.org_id, 'case_id', l.case_id, 'expires_at', l.expires_at,
    'org_name', (select name from public.organizations where id = l.org_id),
    'applicant_name', a.full_name,
    'destination', c.destination, 'visa_type', c.visa_type, 'start_date', c.start_date,
    'stage', c.stage,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'label', i.label, 'description', i.description, 'required', i.required,
        'status', i.status, 'due_date', i.due_date, 'comment', i.comment,
        'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'file_name', f.file_name, 'created_at', f.created_at) order by f.created_at)
                            from public.checklist_item_files f where f.item_id = i.id), '[]'::jsonb)
      ) order by i.sort_order, i.created_at)
      from public.checklist_items i where i.case_id = c.id), '[]'::jsonb)
  ) into v_result
  from public.cases c join public.applicants a on a.id = c.applicant_id
  where c.id = l.case_id;
  return v_result;
end $$;

create function public.portal_register_file(
  p_token_hash text, p_item_id uuid, p_path text, p_name text, p_mime text, p_size bigint
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.portal_links; v_id uuid;
begin
  l := private.portal_link(p_token_hash);
  if l.id is null then raise exception 'invalid_link'; end if;
  if not private.org_can_use(l.org_id, 'portal') then raise exception 'invalid_link'; end if;
  if not exists (select 1 from public.checklist_items where id = p_item_id and case_id = l.case_id and org_id = l.org_id) then
    raise exception 'item_case_mismatch';
  end if;
  if (select count(*) from public.checklist_item_files where item_id = p_item_id) >= 10 then
    raise exception 'too_many_files';
  end if;
  perform set_config('app.actor_type', 'applicant', true);
  insert into public.checklist_item_files (org_id, case_id, item_id, storage_path, file_name, mime_type, size_bytes)
  values (l.org_id, l.case_id, p_item_id, p_path, left(p_name, 300), p_mime, p_size)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function
  public.import_rows(uuid, jsonb), public.create_applicant_with_case(uuid, jsonb), public.export_applicant_data(uuid), public.erasure_file_paths(uuid),
  public.erase_applicant(uuid), public.org_file_paths(uuid), public.delete_organization(uuid),
  public.portal_get(text), public.portal_register_file(text, uuid, text, text, text, bigint),
  private.portal_link(text)
  from public, anon, authenticated;
grant execute on function private.insert_applicant_case(uuid, jsonb, boolean) to authenticated;
grant execute on function
  public.import_rows(uuid, jsonb), public.create_applicant_with_case(uuid, jsonb), public.export_applicant_data(uuid), public.erasure_file_paths(uuid),
  public.erase_applicant(uuid), public.org_file_paths(uuid), public.delete_organization(uuid)
  to authenticated;
grant execute on function
  public.portal_get(text), public.portal_register_file(text, uuid, text, text, text, bigint)
  to service_role;

-- >>> 20261005000007_storage_realtime_grants.sql
-- ============================================================================
-- 07 STORAGE, REALTIME PUBLICATION AND PRIVILEGES
-- ============================================================================

-- Private bucket for applicant documents. Never public; downloads use short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-documents', 'case-documents', false, 10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Object path convention: {org_id}/{case_id}/{item_id}/{uuid}-{filename}
create function private.can_access_object(p_name text, p_write boolean default false) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_parts text[] := string_to_array(p_name, '/'); v_org uuid; v_case uuid;
begin
  if array_length(v_parts, 1) < 4 then return false; end if;
  if v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_org := v_parts[1]::uuid;
  v_case := v_parts[2]::uuid;
  return exists (select 1 from public.cases where id = v_case and org_id = v_org)
     and private.can_access_case(v_case, p_write);
end $$;
grant execute on function private.can_access_object(text, boolean) to authenticated, service_role;

create policy case_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'case-documents' and private.can_access_object(name, false));
create policy case_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'case-documents' and private.can_access_object(name, true));
create policy case_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'case-documents' and private.can_access_object(name, true))
  with check (bucket_id = 'case-documents' and private.can_access_object(name, true));
create policy case_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'case-documents' and private.can_access_object(name, true));

-- ---------------------------------------------------------------------------
-- Realtime (Postgres changes). RLS is applied to what each subscriber receives.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.cases, public.applicants, public.checklist_items, public.checklist_item_files,
  public.tasks, public.activity_events, public.notifications, public.memberships,
  public.organizations, public.portal_links, public.org_settings, public.processing_times;

-- ---------------------------------------------------------------------------
-- Privileges: deny by default, then grant exactly what the app needs.
-- RLS still applies on top of everything below.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;

grant select on
  public.profiles, public.organizations, public.memberships, public.invitations, public.org_settings,
  public.processing_times, public.plan_limits, public.plan_features, public.applicants, public.cases,
  public.case_stage_history, public.activity_events, public.audit_log, public.notifications,
  public.checklist_templates, public.checklist_template_items, public.checklist_items,
  public.checklist_item_files, public.tasks, public.portal_links, public.saved_views,
  public.case_overview, public.activity_feed, public.member_directory, public.deadline_items
  to authenticated;

grant update (full_name, avatar_url, email_notifications) on public.profiles to authenticated;
grant update (name) on public.organizations to authenticated;
grant insert (org_id, email, role, can_view_all, token_hash, invited_by) on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;
grant update (default_processing_days, default_appointment_wait_days, default_doc_prep_days,
              high_buffer_days, medium_buffer_days, processing_times_confirmed)
  on public.org_settings to authenticated;
grant insert (org_id, destination, visa_type, processing_days, appointment_wait_days, doc_prep_days, source_note),
      -- org_id is updatable only so INSERT .. ON CONFLICT DO UPDATE (upsert) works; the lock_org_id trigger forbids changing it
      update (org_id, destination, visa_type, processing_days, appointment_wait_days, doc_prep_days, source_note),
      delete on public.processing_times to authenticated;

grant insert (org_id, full_name, email, phone, nationality, residence_country),
      update (full_name, email, phone, nationality, residence_country),
      delete on public.applicants to authenticated;
grant insert (org_id, applicant_id, destination, visa_type, purpose, programme, intake, start_date,
              appointment_date, stage, assigned_to, tags, notes, opened_on, submitted_at, decided_at, decision_reason),
      update (destination, visa_type, purpose, programme, intake, start_date, appointment_date, stage,
              assigned_to, tags, notes, decision_reason, opened_on),
      delete on public.cases to authenticated;

grant update (read_at), delete on public.notifications to authenticated;

grant insert (org_id, name, destination, visa_type, nationality, official_source_name, official_source_url,
              source_last_checked, notes, active, created_by),
      update (name, destination, visa_type, nationality, official_source_name, official_source_url,
              source_last_checked, notes, active),
      delete on public.checklist_templates to authenticated;
grant insert (id, org_id, template_id, label, description, required, due_days_before_start, sort_order),
      update (label, description, required, due_days_before_start, sort_order),
      delete on public.checklist_template_items to authenticated;

grant insert (org_id, case_id, template_item_id, label, description, required, status, due_date, comment, sort_order),
      update (label, description, required, status, due_date, comment, sort_order),
      delete on public.checklist_items to authenticated;
grant insert (org_id, case_id, item_id, storage_path, file_name, mime_type, size_bytes),
      delete on public.checklist_item_files to authenticated;

grant insert (org_id, case_id, title, description, assignee_id, due_date, status),
      update (title, description, assignee_id, due_date, status),
      delete on public.tasks to authenticated;

grant insert (org_id, case_id, token_hash, label, expires_at, created_by),
      update (revoked_at, label) on public.portal_links to authenticated;

grant insert (org_id, user_id, name, page, config, shared),
      update (name, config, shared),
      delete on public.saved_views to authenticated;

-- Internal tables stay service-role only (RLS enabled, no policies, no grants).
-- case_risk_cache, rate_limits, stripe_events
