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
      update (destination, visa_type, processing_days, appointment_wait_days, doc_prep_days, source_note),
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
grant insert (org_id, template_id, label, description, required, due_days_before_start, sort_order),
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
