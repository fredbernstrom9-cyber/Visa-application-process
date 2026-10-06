-- ============================================================================
-- 09 CLEARENTRY RULEBOOK
-- A vendor-maintained, source-cited rulebook shared by every organisation:
--   guides        one per destination + route (study, short stay, work, ...)
--   requirements  checklist items (documents and steps), targeted by nationality
--                 and, for consulate-specific rules, by country of residence
--   facts         key figures shown next to a case (funds, fees, work rights, ...)
--   changes       a dated log of rule changes; inserting one notifies every
--                 organisation that has open cases it affects
-- The rulebook is global (no org_id). Customers can read it; only the service
-- role (the `rulebook:sync` script) writes it. It holds no personal data.
-- ============================================================================

-- Routes a case can follow. Kept as text + check so new routes need no enum migration.
create function private.valid_route(p text) returns boolean
language sql immutable as $$
  select p in ('study', 'short_stay', 'work', 'research', 'traineeship', 'family')
$$;

create table public.rulebook_meta (
  id boolean primary key default true check (id),
  version text not null,
  verified_on date not null,
  synced_at timestamptz not null default now()
);

create table public.rulebook_sources (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  kind text not null check (kind in ('official', 'secondary')),
  publisher text not null check (char_length(publisher) <= 300),
  published text not null check (char_length(published) <= 60),
  title text not null check (char_length(title) <= 500),
  url text not null check (url ~ '^https://' and char_length(url) <= 1000),
  updated_at timestamptz not null default now()
);

create table public.rulebook_nationalities (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  schengen_visa boolean not null,
  ireland_visa boolean not null,
  flags text[] not null default '{}',
  coverage text not null default 'basic' check (coverage in ('full', 'basic')),
  updated_at timestamptz not null default now()
);

create table public.rulebook_guides (
  id text primary key check (id ~ '^[A-Z]{2}\.[a-z_]+$'),
  destination char(2) not null check (destination ~ '^[A-Z]{2}$'),
  route text not null check (private.valid_route(route)),
  level text not null check (level in ('full', 'basic')),
  title text not null check (char_length(title) <= 200),
  summary text not null check (char_length(summary) <= 2000),
  permit text check (permit is null or char_length(permit) <= 500),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  last_checked date not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (destination, route)
);

create table public.rulebook_requirements (
  id text primary key check (id ~ '^[A-Z]{2}\.[a-z_]+\.[a-z0-9_.-]+$'),
  guide_id text not null references public.rulebook_guides (id) on delete cascade,
  kind text not null check (kind in ('document', 'step')),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  detail text check (detail is null or char_length(detail) <= 2000),
  required boolean not null default true,
  due_days_before_start integer check (due_days_before_start is null or due_days_before_start between 0 and 730),
  sort_order integer not null default 0,
  nat_in char(2)[],                         -- null = every nationality
  nat_not_in char(2)[] not null default '{}',
  residence_in char(2)[],                   -- null = wherever the applicant lives
  residence_not_in char(2)[] not null default '{}',
  confidence text not null check (confidence in ('official', 'multi', 'check')),
  source_ids text[] not null check (cardinality(source_ids) >= 1),
  last_checked date not null,
  content_hash text not null,
  version integer not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index rulebook_requirements_guide_idx on public.rulebook_requirements (guide_id, sort_order);

create table public.rulebook_facts (
  id text primary key check (id ~ '^[A-Z]{2}\.[a-z_]+\.[a-z0-9_.-]+$'),
  guide_id text not null references public.rulebook_guides (id) on delete cascade,
  kind text not null check (kind in ('funds', 'fee', 'work', 'post_study', 'processing', 'insurance', 'salary', 'duration', 'note')),
  label text not null check (char_length(label) <= 200),
  value text not null check (char_length(value) <= 1000),
  amount_eur numeric(12, 2),
  sort_order integer not null default 0,
  nat_in char(2)[],
  nat_not_in char(2)[] not null default '{}',
  residence_in char(2)[],
  residence_not_in char(2)[] not null default '{}',
  confidence text not null check (confidence in ('official', 'multi', 'check')),
  source_ids text[] not null check (cardinality(source_ids) >= 1),
  last_checked date not null,
  content_hash text not null,
  version integer not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index rulebook_facts_guide_idx on public.rulebook_facts (guide_id, sort_order);

create table public.rulebook_changes (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,100}$'),
  effective_on date not null,
  destinations char(2)[] not null check (cardinality(destinations) >= 1),
  routes text[],                            -- null = every route
  nat_in char(2)[],                         -- null = every nationality
  summary text not null check (char_length(summary) between 1 and 300),
  detail text check (detail is null or char_length(detail) <= 2000),
  severity text not null default 'action' check (severity in ('info', 'action')),
  source_ids text[] not null check (cardinality(source_ids) >= 1),
  requirement_ids text[] not null default '{}',
  notify boolean not null default true,
  published_at timestamptz not null default now()
);
create index rulebook_changes_published_idx on public.rulebook_changes (published_at desc);

alter table public.rulebook_meta enable row level security;
alter table public.rulebook_sources enable row level security;
alter table public.rulebook_nationalities enable row level security;
alter table public.rulebook_guides enable row level security;
alter table public.rulebook_requirements enable row level security;
alter table public.rulebook_facts enable row level security;
alter table public.rulebook_changes enable row level security;

create policy rulebook_meta_read on public.rulebook_meta for select to authenticated using (true);
create policy rulebook_sources_read on public.rulebook_sources for select to authenticated using (true);
create policy rulebook_nationalities_read on public.rulebook_nationalities for select to authenticated using (true);
create policy rulebook_guides_read on public.rulebook_guides for select to authenticated using (true);
create policy rulebook_requirements_read on public.rulebook_requirements for select to authenticated using (true);
create policy rulebook_facts_read on public.rulebook_facts for select to authenticated using (true);
create policy rulebook_changes_read on public.rulebook_changes for select to authenticated using (true);

-- Deny by default (Supabase grants new tables to API roles), then allow reading only.
revoke all on public.rulebook_meta, public.rulebook_sources, public.rulebook_nationalities,
  public.rulebook_guides, public.rulebook_requirements, public.rulebook_facts, public.rulebook_changes
  from anon, authenticated;
grant select on public.rulebook_meta, public.rulebook_sources, public.rulebook_nationalities,
  public.rulebook_guides, public.rulebook_requirements, public.rulebook_facts, public.rulebook_changes
  to authenticated;

-- ---------------------------------------------------------------------------
-- Cases get a route; checklist items remember which rule they came from
-- ---------------------------------------------------------------------------
alter table public.cases add column route text check (route is null or private.valid_route(route));
update public.cases set route = case visa_type when 'C' then 'short_stay' when 'D' then 'study' end
 where route is null;
grant insert (route), update (route) on public.cases to authenticated;

alter table public.checklist_items
  add column rule_id text references public.rulebook_requirements (id) on delete set null,
  add column rule_version integer,
  add column rule_changed_at timestamptz;
create unique index checklist_items_rule_unique
  on public.checklist_items (case_id, rule_id) where rule_id is not null;
create index checklist_items_rule_idx on public.checklist_items (rule_id) where rule_id is not null;
-- Staff may acknowledge a changed rule (clear the flag); everything else stays server-side.
grant update (rule_changed_at) on public.checklist_items to authenticated;

alter table public.org_settings add column use_rulebook boolean not null default true;
grant update (use_rulebook) on public.org_settings to authenticated;

-- A case's route defaults from its visa type when the client sends none.
create function private.cases_default_route() returns trigger
language plpgsql as $$
begin
  if new.route is null then
    new.route := case new.visa_type when 'C' then 'short_stay' when 'D' then 'study' end;
  end if;
  return new;
end $$;
create trigger cases_default_route before insert on public.cases
  for each row execute function private.cases_default_route();

-- Applicant + case creation (single and import) accepts an optional route.
create or replace function private.insert_applicant_case(p_org uuid, r jsonb, p_reuse_by_email boolean)
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
    org_id, applicant_id, destination, visa_type, route, purpose, programme, intake,
    start_date, appointment_date, stage, assigned_to, tags, notes,
    opened_on, submitted_at, decided_at
  ) values (
    p_org, v_app, r ->> 'destination',
    coalesce(nullif(r ->> 'visa_type', '')::public.visa_type, 'C'),
    nullif(r ->> 'route', ''),
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

-- case_overview gains `route` (appended, so dependent functions keep working).
create or replace view public.case_overview with (security_invoker = true) as
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
  c.created_by, c.updated_by, c.created_at, c.updated_at,
  c.route
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

-- ---------------------------------------------------------------------------
-- Matching
-- ---------------------------------------------------------------------------
-- Does a targeted rule apply to this nationality / residence?
-- An unknown nationality only gets rules that apply to everyone.
-- Likewise an unknown country of residence only gets rules that do not depend on it.
create function private.rule_targets(
  p_nat_in char(2)[], p_nat_not_in char(2)[], p_res_in char(2)[], p_res_not_in char(2)[],
  p_nat char(2), p_res char(2)
) returns boolean
language sql immutable as $$
  select (p_nat_in is null or (p_nat is not null and p_nat = any (p_nat_in)))
     and (cardinality(p_nat_not_in) = 0 or (p_nat is not null and not (p_nat = any (p_nat_not_in))))
     and (p_res_in is null or (p_res is not null and p_res = any (p_res_in)))
     and (cardinality(p_res_not_in) = 0 or (p_res is not null and not (p_res = any (p_res_not_in))))
$$;

-- EU/EEA/Swiss citizens move freely: no visa or permit checklist applies to them.
create function private.is_eea_national(p_nat char(2)) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select 'eea' = any (n.flags) from public.rulebook_nationalities n where n.code = p_nat), false)
$$;
grant execute on function private.is_eea_national(char(2)) to authenticated, service_role;

-- Adds every matching active rulebook requirement the case does not have yet. Idempotent.
create function private.apply_rulebook_to_case(p_case uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.checklist_items
    (org_id, case_id, rule_id, rule_version, label, description, required, due_date, sort_order)
  select c.org_id, c.id, r.id, r.version, r.label, r.detail, r.required,
         case when r.due_days_before_start is not null and c.start_date is not null
              then c.start_date - r.due_days_before_start end,
         1000 + r.sort_order
  from public.cases c
  join public.applicants a on a.id = c.applicant_id
  join public.rulebook_guides g on g.destination = c.destination and g.route = c.route and g.active
  join public.rulebook_requirements r on r.guide_id = g.id and r.active
  where c.id = p_case
    and private.rule_targets(r.nat_in, r.nat_not_in, r.residence_in, r.residence_not_in, a.nationality, a.residence_country)
    and not private.is_eea_national(a.nationality)
  on conflict (case_id, rule_id) where rule_id is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.apply_rulebook(p_cases uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_case uuid; v_total integer := 0;
begin
  foreach v_case in array coalesce(p_cases, '{}') loop
    if not private.can_access_case(v_case, true) then raise exception 'forbidden'; end if;
    v_total := v_total + private.apply_rulebook_to_case(v_case);
  end loop;
  return v_total;
end $$;
grant execute on function public.apply_rulebook(uuid[]) to authenticated;

-- New cases: an organisation's own matching template wins; otherwise the rulebook fills the checklist.
create function private.cases_apply_rulebook() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.match_template(new.id) is null
     and coalesce((select use_rulebook from public.org_settings where org_id = new.org_id), true) then
    perform private.apply_rulebook_to_case(new.id);
  end if;
  return new;
end $$;
-- Named so it fires after cases_after_insert (triggers run in name order), once the template step ran.
create trigger cases_zz_apply_rulebook after insert on public.cases
  for each row execute function private.cases_apply_rulebook();

-- Key figures for one case (funds, fees, work rights ...), honouring RLS on the case.
create function public.case_rule_facts(p_case uuid)
returns table (id text, guide_id text, kind text, label text, value text, amount_eur numeric,
               confidence text, source_ids text[], last_checked date)
language sql stable security invoker set search_path = '' as $$
  select f.id, f.guide_id, f.kind, f.label, f.value, f.amount_eur, f.confidence, f.source_ids, f.last_checked
  from public.cases c
  join public.applicants a on a.id = c.applicant_id
  join public.rulebook_guides g on g.destination = c.destination and g.route = c.route and g.active
  join public.rulebook_facts f on f.guide_id = g.id and f.active
  where c.id = p_case
    and private.rule_targets(f.nat_in, f.nat_not_in, f.residence_in, f.residence_not_in, a.nationality, a.residence_country)
    and not private.is_eea_national(a.nationality)
  order by f.sort_order
$$;
grant execute on function public.case_rule_facts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Change propagation
-- ---------------------------------------------------------------------------
-- When a requirement's content changes, flag it on every open case that uses it.
create function private.rulebook_requirement_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.content_hash is distinct from old.content_hash or new.active is distinct from old.active then
    new.version := old.version + 1;
    new.updated_at := now();
    update public.checklist_items ci
       set rule_changed_at = now()
      from public.cases c
     where ci.rule_id = new.id and c.id = ci.case_id and private.is_open_stage(c.stage);
  end if;
  return new;
end $$;
create trigger rulebook_requirement_changed before update on public.rulebook_requirements
  for each row execute function private.rulebook_requirement_changed();

create function private.rulebook_fact_changed() returns trigger
language plpgsql as $$
begin
  if new.content_hash is distinct from old.content_hash or new.active is distinct from old.active then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger rulebook_fact_changed before update on public.rulebook_facts
  for each row execute function private.rulebook_fact_changed();

-- Open cases (all organisations) a change affects. Service-role/trigger use only.
create function private.rule_change_case_ids(p_change text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id
  from public.rulebook_changes ch
  join public.cases c on c.destination = any (ch.destinations)
   and (ch.routes is null or c.route = any (ch.routes))
   and private.is_open_stage(c.stage)
  join public.applicants a on a.id = c.applicant_id
  where ch.id = p_change
    and (ch.nat_in is null or a.nationality = any (ch.nat_in))
$$;

-- On a new change: one notification per owner/admin per organisation (with the count of
-- affected open cases), one per assigned advisor per case, and a timeline entry per case.
create function private.rulebook_change_published() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; v_admin uuid; v_title text;
begin
  if not new.notify then return new; end if;
  v_title := 'Rule change: ' || new.summary;
  if char_length(v_title) > 200 then v_title := left(v_title, 199) || '…'; end if;

  for r in
    select c.org_id, count(*)::integer as n
    from private.rule_change_case_ids(new.id) x join public.cases c on c.id = x
    group by c.org_id
  loop
    for v_admin in
      select user_id from public.memberships where org_id = r.org_id and role in ('owner', 'admin')
    loop
      perform private.notify(r.org_id, v_admin, 'rule_changed', v_title,
        r.n || case when r.n = 1 then ' open case is' else ' open cases are' end
          || ' affected. Effective ' || to_char(new.effective_on, 'DD Mon YYYY') || '.',
        null, 'rule:' || new.id);
    end loop;
  end loop;

  for r in
    select c.id, c.org_id, c.assigned_to
    from private.rule_change_case_ids(new.id) x join public.cases c on c.id = x
  loop
    insert into public.activity_events (org_id, case_id, actor_id, actor_type, type, payload)
    values (r.org_id, r.id, null, 'system', 'rule_changed',
            jsonb_build_object('change_id', new.id, 'summary', new.summary, 'effective_on', new.effective_on));
    if r.assigned_to is not null
       and not exists (select 1 from public.memberships m
                        where m.org_id = r.org_id and m.user_id = r.assigned_to and m.role in ('owner', 'admin')) then
      perform private.notify(r.org_id, r.assigned_to, 'rule_changed', v_title,
        'Your case may need different documents. Effective ' || to_char(new.effective_on, 'DD Mon YYYY') || '.',
        r.id, 'rule:' || new.id || ':' || r.id);
    end if;
  end loop;
  return new;
end $$;
create trigger rulebook_change_published after insert on public.rulebook_changes
  for each row execute function private.rulebook_change_published();

-- The caller's open cases affected by one change (RLS applies through case_overview).
create function public.rule_change_cases(p_change text)
returns setof public.case_overview
language sql stable security invoker set search_path = '' as $$
  select co.*
  from public.rulebook_changes ch
  join public.case_overview co on co.destination = any (ch.destinations::text[])
   and (ch.routes is null or co.route = any (ch.routes))
   and private.is_open_stage(co.stage)
   and (ch.nat_in is null or co.nationality = any (ch.nat_in::text[]))
  where ch.id = p_change
  order by co.start_date nulls last
$$;
grant execute on function public.rule_change_cases(text) to authenticated;

-- Counts of affected open cases per change for the caller's organisation (rulebook page).
create function public.rule_change_counts(p_org uuid)
returns table (change_id text, open_cases integer)
language sql stable security invoker set search_path = '' as $$
  select ch.id, count(co.id)::integer
  from public.rulebook_changes ch
  join public.case_overview co on co.org_id = p_org
   and co.destination = any (ch.destinations::text[])
   and (ch.routes is null or co.route = any (ch.routes))
   and private.is_open_stage(co.stage)
   and (ch.nat_in is null or co.nationality = any (ch.nat_in::text[]))
  group by ch.id
$$;
grant execute on function public.rule_change_counts(uuid) to authenticated;

grant execute on function private.rule_targets(char(2)[], char(2)[], char(2)[], char(2)[], char(2), char(2)) to authenticated, service_role;
grant execute on function private.valid_route(text) to authenticated, service_role;


-- New public functions: callable by signed-in users only (migration 07 revoked anon before they existed).
revoke execute on function public.apply_rulebook(uuid[]) from public, anon;
revoke execute on function public.case_rule_facts(uuid) from public, anon;
revoke execute on function public.rule_change_cases(text) from public, anon;
revoke execute on function public.rule_change_counts(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Sync: one function applies a compiled rulebook (built by rulebook/compile.ts). Used by
-- `npm run rulebook:sync`, by the app on deploy (service role) and by the tests. Unchanged rows
-- are left alone; changed requirements bump their version (the trigger above flags open cases);
-- rows missing from the payload are deactivated, never deleted; change-log entries are
-- insert-only and only notify when effective within the last 45 days.
-- ---------------------------------------------------------------------------
create function public.rulebook_apply(p jsonb, p_today date default current_date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_added text[]; v_changed text[]; v_retired text[]; v_facts integer; v_pub jsonb;
  v_cutoff date := p_today - 45;
begin
  if jsonb_typeof(p -> 'requirements') <> 'array' or coalesce(p ->> 'version', '') = '' then
    raise exception 'invalid_rulebook';
  end if;
  perform pg_advisory_xact_lock(hashtext('clearentry.rulebook'));

  insert into public.rulebook_sources (id, kind, publisher, published, title, url)
  select id, kind, publisher, published, title, url from jsonb_populate_recordset(null::public.rulebook_sources, p -> 'sources')
  on conflict (id) do update set kind = excluded.kind, publisher = excluded.publisher, published = excluded.published,
    title = excluded.title, url = excluded.url, updated_at = now()
  where (rulebook_sources.kind, rulebook_sources.publisher, rulebook_sources.published, rulebook_sources.title, rulebook_sources.url)
        is distinct from (excluded.kind, excluded.publisher, excluded.published, excluded.title, excluded.url);

  insert into public.rulebook_nationalities (code, name, schengen_visa, ireland_visa, flags, coverage)
  select code, name, schengen_visa, ireland_visa, flags, coverage from jsonb_populate_recordset(null::public.rulebook_nationalities, p -> 'nationalities')
  on conflict (code) do update set name = excluded.name, schengen_visa = excluded.schengen_visa, ireland_visa = excluded.ireland_visa,
    flags = excluded.flags, coverage = excluded.coverage, updated_at = now()
  where (rulebook_nationalities.name, rulebook_nationalities.schengen_visa, rulebook_nationalities.ireland_visa, rulebook_nationalities.flags, rulebook_nationalities.coverage)
        is distinct from (excluded.name, excluded.schengen_visa, excluded.ireland_visa, excluded.flags, excluded.coverage);

  insert into public.rulebook_guides (id, destination, route, level, title, summary, permit, links, last_checked, active)
  select id, destination, route, level, title, summary, permit, links, last_checked, true
    from jsonb_populate_recordset(null::public.rulebook_guides, p -> 'guides')
  on conflict (id) do update set destination = excluded.destination, route = excluded.route, level = excluded.level,
    title = excluded.title, summary = excluded.summary, permit = excluded.permit, links = excluded.links,
    last_checked = excluded.last_checked, active = true, updated_at = now();
  update public.rulebook_guides set active = false, updated_at = now()
   where active and id not in (select x ->> 'id' from jsonb_array_elements(p -> 'guides') x);

  create temp table _rq on commit drop as
    select * from jsonb_populate_recordset(null::public.rulebook_requirements, p -> 'requirements');
  select coalesce(array_agg(n.id order by n.id) filter (where o.id is null), '{}'),
         coalesce(array_agg(n.id order by n.id) filter (where o.id is not null and (o.content_hash <> n.content_hash or not o.active)), '{}')
    into v_added, v_changed
    from _rq n left join public.rulebook_requirements o on o.id = n.id;

  insert into public.rulebook_requirements (id, guide_id, kind, label, detail, required, due_days_before_start, sort_order,
      nat_in, nat_not_in, residence_in, residence_not_in, confidence, source_ids, last_checked, content_hash, active)
  select id, guide_id, kind, label, detail, required, due_days_before_start, sort_order,
      nat_in, coalesce(nat_not_in, '{}'), residence_in, coalesce(residence_not_in, '{}'), confidence, source_ids, last_checked, content_hash, true
    from _rq
  on conflict (id) do update set guide_id = excluded.guide_id, kind = excluded.kind, label = excluded.label, detail = excluded.detail,
    required = excluded.required, due_days_before_start = excluded.due_days_before_start, sort_order = excluded.sort_order,
    nat_in = excluded.nat_in, nat_not_in = excluded.nat_not_in, residence_in = excluded.residence_in,
    residence_not_in = excluded.residence_not_in, confidence = excluded.confidence, source_ids = excluded.source_ids,
    last_checked = excluded.last_checked, content_hash = excluded.content_hash, active = true
  where rulebook_requirements.content_hash is distinct from excluded.content_hash
     or rulebook_requirements.last_checked is distinct from excluded.last_checked
     or rulebook_requirements.sort_order is distinct from excluded.sort_order
     or not rulebook_requirements.active;
  with r as (
    update public.rulebook_requirements set active = false
     where active and id not in (select id from _rq) returning id
  ) select coalesce(array_agg(id order by id), '{}') into v_retired from r;

  create temp table _fa on commit drop as
    select * from jsonb_populate_recordset(null::public.rulebook_facts, p -> 'facts');
  select count(*) into v_facts from _fa n join public.rulebook_facts o on o.id = n.id where o.content_hash <> n.content_hash;
  insert into public.rulebook_facts (id, guide_id, kind, label, value, amount_eur, sort_order, nat_in, nat_not_in, residence_in,
      residence_not_in, confidence, source_ids, last_checked, content_hash, active)
  select id, guide_id, kind, label, value, amount_eur, sort_order, nat_in, coalesce(nat_not_in, '{}'), residence_in,
      coalesce(residence_not_in, '{}'), confidence, source_ids, last_checked, content_hash, true
    from _fa
  on conflict (id) do update set guide_id = excluded.guide_id, kind = excluded.kind, label = excluded.label, value = excluded.value,
    amount_eur = excluded.amount_eur, sort_order = excluded.sort_order, nat_in = excluded.nat_in, nat_not_in = excluded.nat_not_in,
    residence_in = excluded.residence_in, residence_not_in = excluded.residence_not_in, confidence = excluded.confidence,
    source_ids = excluded.source_ids, last_checked = excluded.last_checked, content_hash = excluded.content_hash, active = true
  where rulebook_facts.content_hash is distinct from excluded.content_hash
     or rulebook_facts.last_checked is distinct from excluded.last_checked
     or rulebook_facts.sort_order is distinct from excluded.sort_order
     or not rulebook_facts.active;
  update public.rulebook_facts set active = false where active and id not in (select id from _fa);

  -- Change log: insert-only, oldest first, so notifications go out in date order.
  with fresh as (
    select c.* from jsonb_populate_recordset(null::public.rulebook_changes, p -> 'changes') c
     where not exists (select 1 from public.rulebook_changes e where e.id = c.id)
  ), ins as (
    insert into public.rulebook_changes (id, effective_on, destinations, routes, nat_in, summary, detail, severity, source_ids, requirement_ids, notify)
    select id, effective_on, destinations, routes, nat_in, summary, detail, severity, source_ids, coalesce(requirement_ids, '{}'),
           effective_on >= v_cutoff
      from fresh order by effective_on, id
    returning id, notify, effective_on
  ) select coalesce(jsonb_agg(jsonb_build_object('id', id, 'notified', notify) order by effective_on, id), '[]') into v_pub from ins;

  insert into public.rulebook_meta (id, version, verified_on, synced_at) values (true, p ->> 'version', (p ->> 'verifiedOn')::date, now())
  on conflict (id) do update set version = excluded.version, verified_on = excluded.verified_on, synced_at = now();

  return jsonb_build_object('version', p ->> 'version', 'requirementsAdded', to_jsonb(v_added), 'requirementsChanged', to_jsonb(v_changed),
    'requirementsRetired', to_jsonb(v_retired), 'factsChanged', v_facts, 'changesPublished', v_pub);
end $$;
revoke execute on function public.rulebook_apply(jsonb, date) from public, anon, authenticated;
grant execute on function public.rulebook_apply(jsonb, date) to service_role;
