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
  select s.stage, s.ord,
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
