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
