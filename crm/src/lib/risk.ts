// TypeScript mirror of private.risk_calc() in supabase/migrations/*_risk_views_analytics.sql.
// The database is the source of truth for every list and chart; this copy powers the
// "simulate your settings" preview and is parity-tested against the SQL function.

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskSettings {
  processingDays: number;
  appointmentWaitDays: number;
  docPrepDays: number;
  highBufferDays: number;
  mediumBufferDays: number;
}

export interface RiskInput extends RiskSettings {
  stage: string;
  startDate: string | null;       // YYYY-MM-DD
  appointmentDate: string | null; // YYYY-MM-DD
  submittedAt: string | null;     // ISO timestamp
  docsTotal: number;
  docsVerified: number;
  today: string;                  // YYYY-MM-DD
}

export interface RiskResult {
  level: RiskLevel | null;
  reason: string | null;
  daysToStart: number | null;
  estDaysNeeded: number | null;
  slackDays: number | null;
  docsPct: number | null;
}

const STAGE_ORD: Record<string, number> = {
  admitted: 1, documents: 2, appointment: 3, submitted: 4, decision_pending: 5, approved: 6, refused: 6, withdrawn: 0,
};
export const CLOSED_STAGES = ['approved', 'refused', 'withdrawn'] as const;

export function stageOrd(stage: string): number {
  return STAGE_ORD[stage] ?? 0;
}
export function isOpenStage(stage: string): boolean {
  return !(CLOSED_STAGES as readonly string[]).includes(stage);
}

const DAY = 86_400_000;
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);
}

export function computeRisk(i: RiskInput): RiskResult {
  const none: RiskResult = { level: null, reason: null, daysToStart: null, estDaysNeeded: null, slackDays: null, docsPct: null };
  if (!isOpenStage(i.stage)) return none;
  const pct = i.docsTotal > 0 ? Math.round((100 * i.docsVerified) / i.docsTotal) : 0;
  if (!i.startDate) return { ...none, reason: 'No start date set', docsPct: pct };

  const ord = stageOrd(i.stage);
  const dts = daysBetween(i.startDate, i.today);
  const parts: string[] = [dts >= 0 ? `Starts in ${dts}d` : `Started ${-dts}d ago`];
  let pre: number;
  let procRem: number;

  if (ord >= 4) {
    const submittedDay = i.submittedAt ? new Date(i.submittedAt).toISOString().slice(0, 10) : null;
    const since = Math.max(submittedDay ? daysBetween(i.today, submittedDay) : 0, 0);
    pre = 0;
    procRem = Math.max(i.processingDays - since, 0);
    parts.push(`submitted ${since}d ago`);
  } else {
    // integer ceil(prep * (1 - pct/100)) -- avoids float drift that SQL numeric does not have
    const docRem = Math.floor((i.docPrepDays * (100 - pct) + 99) / 100);
    let apptRem: number;
    if (i.appointmentDate) {
      const until = daysBetween(i.appointmentDate, i.today);
      apptRem = Math.max(until, 0);
      parts.push(until < 0 ? 'appointment date passed' : `appointment in ${until}d`);
    } else if (ord >= 3) {
      apptRem = 0;
      parts.push('appointment booked');
    } else {
      apptRem = i.appointmentWaitDays;
      parts.push('no appointment');
    }
    pre = Math.max(docRem, apptRem);
    procRem = i.processingDays;
    parts.push(i.docsTotal > 0 ? `${pct}% docs verified` : 'no checklist');
  }

  const need = pre + procRem;
  const slack = dts - need;
  const level: RiskLevel = dts < 0 ? 'high' : slack < i.highBufferDays ? 'high' : slack < i.mediumBufferDays ? 'medium' : 'low';
  parts.push(`needs ~${need}d`);
  return { level, reason: parts.join(' · '), daysToStart: dts, estDaysNeeded: need, slackDays: slack, docsPct: pct };
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  processingDays: 30, appointmentWaitDays: 14, docPrepDays: 21, highBufferDays: 0, mediumBufferDays: 14,
};
