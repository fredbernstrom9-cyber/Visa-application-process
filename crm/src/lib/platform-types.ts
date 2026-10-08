/** Shape returned by the service-role-only SQL function public.platform_overview() (aggregates only, no personal data). */
export interface PlatformOrg {
  id: string;
  name: string;
  plan: 'free' | 'premium' | string;
  subscription_status: string | null;
  created_at: string;
  members: number;
  applicants: number;
  cases: number;
  open_cases: number;
  approved: number;
  refused: number;
  last_activity_at: string | null;
}

export interface PlatformOverviewData {
  generated_at: string;
  totals: {
    organisations: number; premium_organisations: number; free_organisations: number;
    users: number; applicants: number; cases: number; open_cases: number;
    new_organisations_7d: number; new_organisations_30d: number; new_users_7d: number; new_users_30d: number;
    active_organisations_7d: number;
  };
  weekly_signups: { week_start: string; organisations: number; users: number }[];
  organisations: PlatformOrg[];
}
