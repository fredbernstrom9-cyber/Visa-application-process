-- ============================================================================
-- 08 PLATFORM OVERVIEW (read-only, for the product owner)
-- Aggregate usage across ALL organisations. Contains no personal data: no applicant
-- names, e-mails, documents or notes, only counts, plans and dates. Callable by the
-- service role only; the application decides who the platform owner is (see
-- PLATFORM_ADMIN_USER_IDS) and never lets customers reach this function.
-- ============================================================================

create function public.platform_overview() returns jsonb
language sql stable security definer set search_path = '' as $$
  with org_rows as (
    select
      o.id, o.name, o.plan, o.subscription_status, o.created_at,
      (select count(*) from public.memberships m where m.org_id = o.id) as members,
      (select count(*) from public.applicants a where a.org_id = o.id) as applicants,
      (select count(*) from public.cases c where c.org_id = o.id) as cases,
      (select count(*) from public.cases c where c.org_id = o.id and private.is_open_stage(c.stage)) as open_cases,
      (select count(*) from public.cases c where c.org_id = o.id and c.stage = 'approved') as approved,
      (select count(*) from public.cases c where c.org_id = o.id and c.stage = 'refused') as refused,
      (select max(e.created_at) from public.activity_events e where e.org_id = o.id) as last_activity_at
    from public.organizations o
  ),
  weeks as (
    select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as week_start
  )
  select jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'organisations', (select count(*) from org_rows),
      'premium_organisations', (select count(*) from org_rows where plan = 'premium'),
      'free_organisations', (select count(*) from org_rows where plan = 'free'),
      'users', (select count(*) from public.profiles),
      'applicants', (select coalesce(sum(applicants), 0) from org_rows),
      'cases', (select coalesce(sum(cases), 0) from org_rows),
      'open_cases', (select coalesce(sum(open_cases), 0) from org_rows),
      'new_organisations_7d', (select count(*) from org_rows where created_at > now() - interval '7 days'),
      'new_organisations_30d', (select count(*) from org_rows where created_at > now() - interval '30 days'),
      'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
      'new_users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
      'active_organisations_7d', (select count(*) from org_rows where last_activity_at > now() - interval '7 days')
    ),
    'weekly_signups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start::date,
        'organisations', (select count(*) from org_rows r where r.created_at >= w.week_start and r.created_at < w.week_start + interval '1 week'),
        'users', (select count(*) from public.profiles p where p.created_at >= w.week_start and p.created_at < w.week_start + interval '1 week')
      ) order by w.week_start)
      from weeks w
    ), '[]'::jsonb),
    'organisations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'plan', r.plan, 'subscription_status', r.subscription_status, 'created_at', r.created_at,
        'members', r.members, 'applicants', r.applicants, 'cases', r.cases, 'open_cases', r.open_cases,
        'approved', r.approved, 'refused', r.refused, 'last_activity_at', r.last_activity_at
      ) order by r.created_at desc)
      from org_rows r
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.platform_overview() from public, anon, authenticated;
grant execute on function public.platform_overview() to service_role;
