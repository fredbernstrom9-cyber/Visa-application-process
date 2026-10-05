// Shared vocabulary: stages, roles, statuses. Pure data -- no React, safe on server and client.

export type CaseStage =
  | 'admitted' | 'documents' | 'appointment' | 'submitted' | 'decision_pending' | 'approved' | 'refused' | 'withdrawn';

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'violet' | 'orange';

export const STAGES: readonly { key: CaseStage; label: string; short: string; tone: Tone; hint: string }[] = [
  { key: 'admitted', label: 'Admitted / signed', short: 'Admitted', tone: 'neutral', hint: 'Offer accepted or contract signed' },
  { key: 'documents', label: 'Documents in progress', short: 'Documents', tone: 'info', hint: 'Collecting and verifying documents' },
  { key: 'appointment', label: 'Appointment booked', short: 'Appointment', tone: 'violet', hint: 'Consulate / VAC appointment secured' },
  { key: 'submitted', label: 'Submitted', short: 'Submitted', tone: 'warn', hint: 'Application lodged' },
  { key: 'decision_pending', label: 'Decision pending', short: 'Pending', tone: 'orange', hint: 'Waiting for the consulate' },
  { key: 'approved', label: 'Approved', short: 'Approved', tone: 'ok', hint: 'Visa granted' },
  { key: 'refused', label: 'Refused', short: 'Refused', tone: 'danger', hint: 'Visa refused' },
  { key: 'withdrawn', label: 'Withdrawn', short: 'Withdrawn', tone: 'neutral', hint: 'Applicant withdrew or deferred' },
];
export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<CaseStage, (typeof STAGES)[number]>;
export const OPEN_STAGES: readonly CaseStage[] = ['admitted', 'documents', 'appointment', 'submitted', 'decision_pending'];
export const CLOSED_STAGE_KEYS: readonly CaseStage[] = ['approved', 'refused', 'withdrawn'];
export const stageLabel = (s: string) => STAGE_BY_KEY[s as CaseStage]?.label ?? s;
export const isOpen = (s: string) => OPEN_STAGES.includes(s as CaseStage);

export type VisaType = 'C' | 'D' | 'other';
export const VISA_TYPES: readonly { key: VisaType; label: string; short: string }[] = [
  { key: 'C', label: 'Short-stay (Type C)', short: 'C · short stay' },
  { key: 'D', label: 'Long-stay (Type D)', short: 'D · long stay' },
  { key: 'other', label: 'Other', short: 'Other' },
];
export const visaLabel = (v: string) => VISA_TYPES.find((x) => x.key === v)?.short ?? v;

export type Role = 'owner' | 'admin' | 'advisor' | 'viewer';
export const ROLES: readonly { key: Role; label: string; blurb: string }[] = [
  { key: 'owner', label: 'Owner', blurb: 'Full control including billing and deleting the organisation.' },
  { key: 'admin', label: 'Admin', blurb: 'Manages team, checklists, settings and all applicants.' },
  { key: 'advisor', label: 'Advisor', blurb: 'Works on assigned applicants only (unless granted access to all).' },
  { key: 'viewer', label: 'Viewer', blurb: 'Read-only access to everything in the organisation.' },
];
export const roleLabel = (r: string) => ROLES.find((x) => x.key === r)?.label ?? r;
export const canWrite = (r: Role | null | undefined) => r === 'owner' || r === 'admin' || r === 'advisor';
export const isAdmin = (r: Role | null | undefined) => r === 'owner' || r === 'admin';

export type ItemStatus = 'missing' | 'received' | 'verified' | 'needs_redo';
export const ITEM_STATUSES: readonly { key: ItemStatus; label: string; tone: Tone }[] = [
  { key: 'missing', label: 'Missing', tone: 'neutral' },
  { key: 'received', label: 'Received', tone: 'info' },
  { key: 'verified', label: 'Verified', tone: 'ok' },
  { key: 'needs_redo', label: 'Needs redo', tone: 'danger' },
];
export const ITEM_STATUS_BY_KEY = Object.fromEntries(ITEM_STATUSES.map((s) => [s.key, s])) as Record<ItemStatus, (typeof ITEM_STATUSES)[number]>;

export type RiskKey = 'low' | 'medium' | 'high';
export const RISK_LEVELS: readonly { key: RiskKey; label: string; tone: Tone }[] = [
  { key: 'low', label: 'Low risk', tone: 'ok' },
  { key: 'medium', label: 'Medium risk', tone: 'warn' },
  { key: 'high', label: 'High risk', tone: 'danger' },
];
export const RISK_BY_KEY = Object.fromEntries(RISK_LEVELS.map((r) => [r.key, r])) as Record<RiskKey, (typeof RISK_LEVELS)[number]>;

export const REQUIREMENTS_NOTICE =
  'Requirements change often and differ by consulate and nationality. Always confirm the document list, fees and processing times with the consulate or the official visa portal before advising an applicant.';

export const SOURCE_STALE_DAYS = 90;
