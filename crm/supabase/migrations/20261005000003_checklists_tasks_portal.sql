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
