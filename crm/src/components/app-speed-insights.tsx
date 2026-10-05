'use client';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { redactVitalEvent } from '@/lib/speed-insights';

/** Vercel Speed Insights (page performance), with pages that contain secret links excluded. */
export function AppSpeedInsights() {
  return <SpeedInsights beforeSend={(event) => redactVitalEvent(event)} />;
}
