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
