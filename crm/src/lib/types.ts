import type { CaseStage, Confidence, ItemStatus, Role, Route, VisaType } from './domain';

/** One row of the case_overview view (a case joined with its applicant, advisor and live risk). */
export interface CaseRow {
  id: string;
  org_id: string;
  applicant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  residence_country: string | null;
  destination: string;
  visa_type: VisaType;
  route: Route | null;
  purpose: string | null;
  programme: string | null;
  intake: string | null;
  start_date: string | null;
  appointment_date: string | null;
  stage: CaseStage;
  max_stage_ord: number;
  assigned_to: string | null;
  advisor_name: string | null;
  advisor_avatar: string | null;
  tags: string[];
  notes: string | null;
  opened_on: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  stage_changed_at: string;
  docs_total: number;
  docs_verified: number;
  docs_received: number;
  docs_pct: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  risk_reason: string | null;
  days_to_start: number | null;
  est_days_needed: number | null;
  slack_days: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  org_id: string;
  user_id: string;
  role: Role;
  can_view_all: boolean;
  created_at: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'premium';
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

export interface OrgSettings {
  org_id: string;
  default_processing_days: number;
  default_appointment_wait_days: number;
  default_doc_prep_days: number;
  high_buffer_days: number;
  medium_buffer_days: number;
  processing_times_confirmed: boolean;
  /** Fill new cases from the ClearEntry rulebook when no own template matches. */
  use_rulebook: boolean;
}

export interface ProcessingTime {
  id: string;
  org_id: string;
  destination: string;
  visa_type: 'any' | VisaType;
  processing_days: number;
  appointment_wait_days: number;
  doc_prep_days: number;
  source_note: string | null;
}

export interface ChecklistItem {
  id: string;
  org_id: string;
  case_id: string;
  template_item_id: string | null;
  label: string;
  description: string | null;
  required: boolean;
  status: ItemStatus;
  due_date: string | null;
  comment: string | null;
  verified_by: string | null;
  verified_at: string | null;
  sort_order: number;
  updated_at: string;
  updated_by: string | null;
  /** Set when the item came from the ClearEntry rulebook. */
  rule_id: string | null;
  rule_version: number | null;
  /** Set when the rulebook changed this rule after it was added; cleared when staff acknowledge it. */
  rule_changed_at: string | null;
}

export interface ItemFile {
  id: string;
  org_id: string;
  case_id: string;
  item_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_via: 'staff' | 'portal';
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  org_id: string;
  name: string;
  destination: string;
  visa_type: VisaType;
  nationality: string | null;
  official_source_name: string | null;
  official_source_url: string | null;
  source_last_checked: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateItem {
  id: string;
  org_id: string;
  template_id: string;
  label: string;
  description: string | null;
  required: boolean;
  due_days_before_start: number | null;
  sort_order: number;
}

export interface Task {
  id: string;
  org_id: string;
  case_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  status: 'open' | 'done';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface ActivityRow {
  id: string;
  org_id: string;
  case_id: string | null;
  applicant_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  actor_type: 'user' | 'applicant' | 'system';
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  org_id: string;
  type: string;
  title: string;
  body: string | null;
  case_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PortalLink {
  id: string;
  org_id: string;
  case_id: string;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
}

export interface SavedView {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  page: 'applicants' | 'pipeline';
  config: Record<string, unknown>;
  shared: boolean;
}

export interface DeadlineItem {
  org_id: string;
  kind: 'start_date' | 'appointment' | 'document' | 'task';
  ref_id: string;
  case_id: string;
  applicant_name: string;
  title: string | null;
  due_date: string;
  owner_id: string | null;
  stage: CaseStage;
}

export interface AuditRow {
  id: number;
  org_id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  can_view_all: boolean;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ---- ClearEntry rulebook (read-only, shared by every organisation) ---------------------------

export interface RuleSource {
  id: string;
  kind: 'official' | 'secondary';
  publisher: string;
  published: string;
  title: string;
  url: string;
}

export interface RuleGuide {
  id: string;
  destination: string;
  route: Route;
  level: 'full' | 'basic';
  title: string;
  summary: string;
  permit: string | null;
  links: { label: string; url: string }[];
  last_checked: string;
}

export interface RuleRequirement {
  id: string;
  guide_id: string;
  kind: 'document' | 'step';
  label: string;
  detail: string | null;
  required: boolean;
  due_days_before_start: number | null;
  sort_order: number;
  nat_in: string[] | null;
  nat_not_in: string[];
  residence_in: string[] | null;
  residence_not_in: string[];
  confidence: Confidence;
  source_ids: string[];
  last_checked: string;
  version: number;
  active: boolean;
}

export interface RuleFact {
  id: string;
  guide_id: string;
  kind: 'funds' | 'fee' | 'work' | 'post_study' | 'processing' | 'insurance' | 'salary' | 'duration' | 'note';
  label: string;
  value: string;
  amount_eur: number | null;
  confidence: Confidence;
  source_ids: string[];
  last_checked: string;
  /** Targeting (present when read from the table; case_rule_facts already filters). */
  nat_in?: string[] | null;
  nat_not_in?: string[];
  residence_in?: string[] | null;
  residence_not_in?: string[];
}

export interface RuleChange {
  id: string;
  effective_on: string;
  destinations: string[];
  routes: Route[] | null;
  nat_in: string[] | null;
  summary: string;
  detail: string | null;
  severity: 'info' | 'action';
  source_ids: string[];
  requirement_ids: string[];
  published_at: string;
}

export interface RulebookMeta {
  version: string;
  verified_on: string;
  synced_at: string;
}
