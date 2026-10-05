// The single place that decides what a plan includes. Mirrored in the database
// (plan_limits / plan_features) and checked for drift by tests/unit/plans.test.ts.

export type Plan = 'free' | 'premium';
export type Feature = 'analytics' | 'live_tracking' | 'import' | 'export' | 'portal' | 'reports';
export type LimitKey = 'seats' | 'applicants';

export const PLAN_FEATURES: Record<Plan, readonly Feature[]> = {
  free: [],
  premium: ['analytics', 'live_tracking', 'import', 'export', 'portal', 'reports'],
};

/** null = unlimited */
export const PLAN_LIMITS: Record<Plan, Record<LimitKey, number | null>> = {
  free: { seats: 1, applicants: 10 },
  premium: { seats: null, applicants: null },
};

export const FEATURE_LABELS: Record<Feature, { name: string; blurb: string }> = {
  analytics: { name: 'Analytics dashboard', blurb: 'Funnel, acceptance rates, bottlenecks, cohorts and advisor performance.' },
  live_tracking: { name: 'Live tracking', blurb: 'Every screen updates instantly when a teammate changes something, plus presence.' },
  import: { name: 'CSV / XLSX import', blurb: 'Bring in your whole applicant list with automatic column matching.' },
  export: { name: 'CSV / XLSX export', blurb: 'Export any list or analytics view for management and clients.' },
  portal: { name: 'Applicant portal links', blurb: 'Let applicants upload documents themselves without an account.' },
  reports: { name: 'PDF intake reports', blurb: 'One-page intake summaries for management or client marketing.' },
};

export interface PlanSubject { plan: Plan | string }

function asPlan(p: string): Plan {
  return p === 'premium' ? 'premium' : 'free';
}

export function canUse(org: PlanSubject, feature: Feature): boolean {
  return PLAN_FEATURES[asPlan(org.plan)].includes(feature);
}

export function limitFor(org: PlanSubject, key: LimitKey): number | null {
  return PLAN_LIMITS[asPlan(org.plan)][key];
}

/** True when one more of `key` still fits. */
export function hasRoomFor(org: PlanSubject, key: LimitKey, currentCount: number, adding = 1): boolean {
  const limit = limitFor(org, key);
  return limit === null || currentCount + adding <= limit;
}

export const PLAN_NAMES: Record<Plan, string> = { free: 'Free', premium: 'Premium' };
export { asPlan };
