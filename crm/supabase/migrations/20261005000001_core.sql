-- ============================================================================
-- 01 CORE: tenancy, roles, applicants, cases
-- Every tenant table carries org_id and has Row Level Security enabled.
-- Helper functions live in the non-exposed `private` schema (SECURITY DEFINER,
-- empty search_path) so policies stay fast and cannot recurse.
-- ============================================================================

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'advisor', 'viewer');
create type public.case_stage as enum (
  'admitted', 'documents', 'appointment', 'submitted', 'decision_pending',
  'approved', 'refused', 'withdrawn'
);
create type public.visa_type as enum ('C', 'D', 'other');
create type public.item_status as enum ('missing', 'received', 'verified', 'needs_redo');
create type public.task_status as enum ('open', 'done');

-- ---------------------------------------------------------------------------
-- Generic trigger helpers
-- ---------------------------------------------------------------------------
create function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function private.lock_org_id() returns trigger
language plpgsql as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable';
  end if;
  return new;
end $$;

create function private.stage_ord(s public.case_stage) returns smallint
language sql immutable as $$
  select (case s
    when 'admitted' then 1
    when 'documents' then 2
    when 'appointment' then 3
    when 'submitted' then 4
    when 'decision_pending' then 5
    when 'approved' then 6
    when 'refused' then 6
    when 'withdrawn' then 0
  end)::smallint
$$;

create function private.is_open_stage(s public.case_stage) returns boolean
language sql immutable as $$
  select s not in ('approved', 'refused', 'withdrawn')
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  avatar_url text,
  email_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.sync_user_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_user_email();

-- ---------------------------------------------------------------------------
-- Plans (configuration, not demo data) -- mirrored by src/lib/plans.ts
-- ---------------------------------------------------------------------------
create table public.plan_limits (
  plan text primary key,
  max_seats integer,        -- null = unlimited
  max_applicants integer    -- null = unlimited
);
create table public.plan_features (
  plan text not null references public.plan_limits (plan) on delete cascade,
  feature text not null,
  primary key (plan, feature)
);
alter table public.plan_limits enable row level security;
alter table public.plan_features enable row level security;
create policy plan_limits_read on public.plan_limits for select to authenticated using (true);
create policy plan_features_read on public.plan_features for select to authenticated using (true);

insert into public.plan_limits (plan, max_seats, max_applicants) values
  ('free', 1, 10),
  ('premium', null, null);
insert into public.plan_features (plan, feature) values
  ('premium', 'analytics'),
  ('premium', 'live_tracking'),
  ('premium', 'import'),
  ('premium', 'export'),
  ('premium', 'portal'),
  ('premium', 'reports');

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique,
  plan text not null default 'free' references public.plan_limits (plan),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  billing_event_at timestamptz,        -- timestamp of the last Stripe event applied (ignores out-of-order deliveries)
  last_maintenance_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organizations enable row level security;
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  can_view_all boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
alter table public.memberships enable row level security;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.org_role not null check (role <> 'owner'),
  can_view_all boolean not null default false,
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_pending_email_idx
  on public.invitations (org_id, email) where accepted_at is null and revoked_at is null;
create index invitations_org_idx on public.invitations (org_id);
alter table public.invitations enable row level security;

-- Organisation-wide settings, including the risk engine knobs.
create table public.org_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  default_processing_days integer not null default 30 check (default_processing_days between 0 and 365),
  default_appointment_wait_days integer not null default 14 check (default_appointment_wait_days between 0 and 365),
  default_doc_prep_days integer not null default 21 check (default_doc_prep_days between 0 and 365),
  high_buffer_days integer not null default 0 check (high_buffer_days between -90 and 365),
  medium_buffer_days integer not null default 14 check (medium_buffer_days between -90 and 365),
  processing_times_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  check (medium_buffer_days >= high_buffer_days)
);
alter table public.org_settings enable row level security;
create trigger org_settings_touch before update on public.org_settings
  for each row execute function private.touch_updated_at();

create function private.create_org_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.org_settings (org_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger organizations_settings after insert on public.organizations
  for each row execute function private.create_org_settings();

-- Per destination (and optionally visa type) processing assumptions used by risk scoring.
create table public.processing_times (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  destination char(2) not null check (destination ~ '^[A-Z]{2}$'),
  visa_type text not null default 'any' check (visa_type in ('any', 'C', 'D', 'other')),
  processing_days integer not null check (processing_days between 0 and 365),
  appointment_wait_days integer not null check (appointment_wait_days between 0 and 365),
  doc_prep_days integer not null check (doc_prep_days between 0 and 365),
  source_note text,
  updated_at timestamptz not null default now(),
  unique (org_id, destination, visa_type)
);
alter table public.processing_times enable row level security;
create trigger processing_times_touch before update on public.processing_times
  for each row execute function private.touch_updated_at();
create trigger processing_times_lock before update on public.processing_times
  for each row execute function private.lock_org_id();

-- ---------------------------------------------------------------------------
-- Applicants (people) and cases (one visa case each; a person may have several)
-- ---------------------------------------------------------------------------
create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 200),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  nationality char(2) check (nationality is null or nationality ~ '^[A-Z]{2}$'),
  residence_country char(2) check (residence_country is null or residence_country ~ '^[A-Z]{2}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index applicants_org_idx on public.applicants (org_id, created_at desc);
create index applicants_email_idx on public.applicants (org_id, lower(email));
alter table public.applicants enable row level security;
create trigger applicants_touch before update on public.applicants
  for each row execute function private.touch_updated_at();
create trigger applicants_lock before update on public.applicants
  for each row execute function private.lock_org_id();

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  applicant_id uuid not null,
  destination char(2) not null check (destination ~ '^[A-Z]{2}$'),
  visa_type public.visa_type not null default 'C',
  purpose text check (purpose is null or char_length(purpose) <= 200),
  programme text check (programme is null or char_length(programme) <= 200),
  intake text check (intake is null or char_length(intake) <= 80),
  start_date date,
  appointment_date date,
  stage public.case_stage not null default 'admitted',
  max_stage_ord smallint not null default 1,
  assigned_to uuid references auth.users (id) on delete set null,
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  notes text check (notes is null or char_length(notes) <= 10000),
  opened_on date not null default current_date,
  submitted_at timestamptz,
  decided_at timestamptz,
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 1000),
  stage_changed_at timestamptz not null default now(),
  docs_total integer not null default 0,
  docs_verified integer not null default 0,
  docs_received integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (applicant_id, org_id) references public.applicants (id, org_id) on delete cascade
);
create index cases_org_stage_idx on public.cases (org_id, stage);
create index cases_org_start_idx on public.cases (org_id, start_date);
create index cases_applicant_idx on public.cases (applicant_id);
create index cases_assigned_idx on public.cases (assigned_to, org_id);
create index cases_org_opened_idx on public.cases (org_id, opened_on);
create index cases_org_decided_idx on public.cases (org_id, decided_at) where decided_at is not null;
alter table public.cases enable row level security;
create trigger cases_lock before update on public.cases
  for each row execute function private.lock_org_id();

-- Stage history: the source for time-in-stage and cohort progression analytics.
create table public.case_stage_history (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null,
  stage public.case_stage not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  changed_by uuid references auth.users (id) on delete set null,
  foreign key (case_id, org_id) references public.cases (id, org_id) on delete cascade
);
create index stage_history_case_idx on public.case_stage_history (case_id, entered_at);
create index stage_history_org_idx on public.case_stage_history (org_id, stage);
alter table public.case_stage_history enable row level security;

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER, empty search_path)
-- ---------------------------------------------------------------------------
create function private.my_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.memberships where user_id = (select auth.uid())
$$;

create function private.my_admin_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.memberships
  where user_id = (select auth.uid()) and role in ('owner', 'admin')
$$;

create function private.my_writer_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.memberships
  where user_id = (select auth.uid()) and role in ('owner', 'admin', 'advisor')
$$;

-- Orgs where the caller may see every case (advisors only with the explicit grant).
create function private.my_wide_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.memberships
  where user_id = (select auth.uid()) and (role in ('owner', 'admin', 'viewer') or can_view_all)
$$;

create function private.my_assigned_case_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.cases c
  join public.memberships m on m.org_id = c.org_id and m.user_id = (select auth.uid())
  where c.assigned_to = (select auth.uid())
$$;

create function private.my_assigned_applicant_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.applicant_id from public.cases c
  join public.memberships m on m.org_id = c.org_id and m.user_id = (select auth.uid())
  where c.assigned_to = (select auth.uid())
$$;

create function private.org_mate_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m2.user_id from public.memberships m1
  join public.memberships m2 on m2.org_id = m1.org_id
  where m1.user_id = (select auth.uid())
$$;

create function private.can_access_case(p_case uuid, p_write boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cases c
    join public.memberships m on m.org_id = c.org_id and m.user_id = (select auth.uid())
    where c.id = p_case
      and (not p_write or m.role in ('owner', 'admin', 'advisor'))
      and (m.role in ('owner', 'admin', 'viewer') or m.can_view_all or c.assigned_to = (select auth.uid()))
  )
$$;

create function private.org_role_of(p_org uuid) returns public.org_role
language sql stable security definer set search_path = '' as $$
  select role from public.memberships where org_id = p_org and user_id = (select auth.uid())
$$;

create function private.plan_limit(p_org uuid, p_limit text) returns integer
language sql stable security definer set search_path = '' as $$
  select case p_limit when 'seats' then pl.max_seats when 'applicants' then pl.max_applicants end
  from public.organizations o join public.plan_limits pl on pl.plan = o.plan
  where o.id = p_org
$$;

create function private.org_can_use(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizations o
    join public.plan_features f on f.plan = o.plan
    where o.id = p_org and f.feature = p_feature
  )
$$;

create function private.assert_feature(p_org uuid, p_feature text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.org_can_use(p_org, p_feature) then
    raise exception 'feature_not_available:%', p_feature using errcode = 'P0001';
  end if;
end $$;

grant execute on function
  private.my_org_ids(), private.my_admin_org_ids(), private.my_writer_org_ids(),
  private.my_wide_org_ids(), private.my_assigned_case_ids(), private.my_assigned_applicant_ids(),
  private.org_mate_ids(), private.can_access_case(uuid, boolean), private.org_role_of(uuid),
  private.plan_limit(uuid, text), private.org_can_use(uuid, text), private.assert_feature(uuid, text),
  private.stage_ord(public.case_stage), private.is_open_stage(public.case_stage)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Plan enforcement in the database (cannot be bypassed through the API)
-- ---------------------------------------------------------------------------
create function private.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_max integer; v_count integer;
begin
  v_max := private.plan_limit(new.org_id, 'seats');
  if v_max is not null then
    perform 1 from public.organizations where id = new.org_id for update;
    select count(*) into v_count from public.memberships where org_id = new.org_id;
    if v_count >= v_max then
      raise exception 'plan_limit:seats' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger memberships_seat_limit before insert on public.memberships
  for each row execute function private.enforce_seat_limit();

create function private.enforce_invitation_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_max integer; v_count integer;
begin
  v_max := private.plan_limit(new.org_id, 'seats');
  if v_max is not null then
    select (select count(*) from public.memberships where org_id = new.org_id)
         + (select count(*) from public.invitations
            where org_id = new.org_id and accepted_at is null and revoked_at is null and expires_at > now())
      into v_count;
    if v_count >= v_max then
      raise exception 'plan_limit:seats' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger invitations_seat_limit before insert on public.invitations
  for each row execute function private.enforce_invitation_limit();

create function private.enforce_applicant_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_max integer; v_count integer;
begin
  v_max := private.plan_limit(new.org_id, 'applicants');
  if v_max is not null then
    perform 1 from public.organizations where id = new.org_id for update;
    select count(*) into v_count from public.applicants where org_id = new.org_id;
    if v_count >= v_max then
      raise exception 'plan_limit:applicants' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger applicants_plan_limit before insert on public.applicants
  for each row execute function private.enforce_applicant_limit();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- profiles: yourself and the people you share an organisation with
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.org_mate_ids()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations: members read; owners/admins rename. Billing columns are service-role only.
create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.my_org_ids()));
create policy organizations_update on public.organizations for update to authenticated
  using (id in (select private.my_admin_org_ids()))
  with check (id in (select private.my_admin_org_ids()));

-- memberships: members read the roster; all changes go through audited RPCs
create policy memberships_select on public.memberships for select to authenticated
  using (org_id in (select private.my_org_ids()));

-- invitations: owners/admins only
create policy invitations_select on public.invitations for select to authenticated
  using (org_id in (select private.my_admin_org_ids()));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (org_id in (select private.my_admin_org_ids()) and invited_by = (select auth.uid()));
create policy invitations_update on public.invitations for update to authenticated
  using (org_id in (select private.my_admin_org_ids()))
  with check (org_id in (select private.my_admin_org_ids()));

-- org_settings / processing_times: members read, owners/admins write
create policy org_settings_select on public.org_settings for select to authenticated
  using (org_id in (select private.my_org_ids()));
create policy org_settings_update on public.org_settings for update to authenticated
  using (org_id in (select private.my_admin_org_ids()))
  with check (org_id in (select private.my_admin_org_ids()));

create policy processing_times_select on public.processing_times for select to authenticated
  using (org_id in (select private.my_org_ids()));
create policy processing_times_insert on public.processing_times for insert to authenticated
  with check (org_id in (select private.my_admin_org_ids()));
create policy processing_times_update on public.processing_times for update to authenticated
  using (org_id in (select private.my_admin_org_ids()))
  with check (org_id in (select private.my_admin_org_ids()));
create policy processing_times_delete on public.processing_times for delete to authenticated
  using (org_id in (select private.my_admin_org_ids()));

-- applicants
create policy applicants_select on public.applicants for select to authenticated
  using (
    org_id in (select private.my_wide_org_ids())
    or (org_id in (select private.my_org_ids())
        and (created_by = (select auth.uid()) or id in (select private.my_assigned_applicant_ids())))
  );
create policy applicants_insert on public.applicants for insert to authenticated
  with check (org_id in (select private.my_writer_org_ids()));
create policy applicants_update on public.applicants for update to authenticated
  using (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids())
         or created_by = (select auth.uid())
         or id in (select private.my_assigned_applicant_ids()))
  )
  with check (org_id in (select private.my_writer_org_ids()));
create policy applicants_delete on public.applicants for delete to authenticated
  using (org_id in (select private.my_admin_org_ids()));

-- cases
create policy cases_select on public.cases for select to authenticated
  using (
    org_id in (select private.my_wide_org_ids())
    or (org_id in (select private.my_org_ids()) and assigned_to = (select auth.uid()))
  );
create policy cases_insert on public.cases for insert to authenticated
  with check (org_id in (select private.my_writer_org_ids()));
create policy cases_update on public.cases for update to authenticated
  using (
    org_id in (select private.my_writer_org_ids())
    and (org_id in (select private.my_wide_org_ids()) or assigned_to = (select auth.uid()))
  )
  with check (org_id in (select private.my_writer_org_ids()));
create policy cases_delete on public.cases for delete to authenticated
  using (org_id in (select private.my_admin_org_ids()));

-- stage history: read-only for clients, written by triggers
create policy stage_history_select on public.case_stage_history for select to authenticated
  using (
    org_id in (select private.my_wide_org_ids())
    or case_id in (select private.my_assigned_case_ids())
  );

-- ---------------------------------------------------------------------------
-- Membership / organisation RPCs
-- ---------------------------------------------------------------------------
create function public.create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_org uuid;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.memberships where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'org_limit';
  end if;
  v_slug := trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug := left(coalesce(nullif(v_slug, ''), 'org'), 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.organizations (name, slug, created_by) values (v_name, v_slug, v_uid) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end $$;

create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_inv public.invitations;
  v_email text;
  v_confirmed timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.invitations where token_hash = v_hash for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'invalid_invitation';
  end if;
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_confirmed is null or v_email is distinct from v_inv.email then
    raise exception 'invitation_email_mismatch';
  end if;
  insert into public.memberships (org_id, user_id, role, can_view_all, invited_by)
  values (v_inv.org_id, v_uid, v_inv.role, v_inv.can_view_all, v_inv.invited_by)
  on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_inv.org_id, v_uid, 'member.joined', 'membership', v_uid, jsonb_build_object('role', v_inv.role));
  return v_inv.org_id;
end $$;

create function public.set_member_role(
  p_org uuid, p_user uuid, p_role public.org_role, p_can_view_all boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.org_role;
  v_old_role public.org_role;
begin
  select role into v_caller from public.memberships where org_id = p_org and user_id = v_uid;
  if v_caller is null or v_caller not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  select role into v_old_role from public.memberships where org_id = p_org and user_id = p_user;
  if v_old_role is null then raise exception 'not_found'; end if;
  if v_caller = 'admin' and (v_old_role in ('owner', 'admin') or p_role in ('owner', 'admin')) then
    raise exception 'forbidden';
  end if;
  if v_old_role = 'owner' and p_role <> 'owner'
     and (select count(*) from public.memberships where org_id = p_org and role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;
  update public.memberships
     set role = p_role, can_view_all = (p_role = 'advisor' and coalesce(p_can_view_all, false))
   where org_id = p_org and user_id = p_user;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org, v_uid, 'member.role_changed', 'membership', p_user,
          jsonb_build_object('from', v_old_role, 'to', p_role, 'can_view_all', coalesce(p_can_view_all, false)));
end $$;

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
