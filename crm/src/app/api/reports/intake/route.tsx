import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse, type NextRequest } from 'next/server';
import { getOrgContext } from '@/lib/auth/session';
import { stageLabel } from '@/lib/domain';
import { parseFilters, toRpcFilters } from '@/lib/filters';
import { canUse } from '@/lib/plans';
import { IntakeReport, type IntakeReportModel } from '@/lib/reports/intake';
import { createSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FUNNEL: Record<string, string> = {
  admitted: 'Admitted', documents: 'Documents started', appointment: 'Appointment booked', submitted: 'Submitted',
  decision_pending: 'Decision pending', decided: 'Decision made', approved: 'Approved',
};

export async function GET(request: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!canUse(ctx.org, 'reports')) return NextResponse.json({ error: 'Reports are part of the Premium plan' }, { status: 402 });

  const filters = parseFilters(request.nextUrl.searchParams);
  const p = { p_org: ctx.org.id, p_filters: toRpcFilters(filters) };
  const supabase = await createSupabaseServer();
  const count = async (extra: Record<string, unknown>) => {
    const { count: n } = await supabase.rpc('filtered_cases', { ...p, p_filters: { ...p.p_filters, open: 'true', ...extra } }, { count: 'exact', head: true });
    return n ?? 0;
  };
  const [kpi, funnel, acc, stages, high, medium, low, openTotal] = await Promise.all([
    supabase.rpc('analytics_kpis', p), supabase.rpc('analytics_funnel', p), supabase.rpc('analytics_acceptance', { ...p, p_dimension: 'destination' }),
    supabase.rpc('analytics_stage_times', p), count({ risk: ['high'] }), count({ risk: ['medium'] }), count({ risk: ['low'] }), count({}),
  ]);
  const err = [kpi, funnel, acc, stages].find((r) => r.error);
  if (err?.error) return NextResponse.json({ error: err.error.message }, { status: 500 });

  const k = (kpi.data as { current: Record<string, number | null> }).current;
  const f = (funnel.data as { step: string; reached: number | string }[]).map((r) => ({ step: r.step, value: Number(r.reached) }));
  const slow = (stages.data as { stage: string; finished: number | string; avg_days: number | string | null }[])
    .filter((s) => Number(s.finished) > 0 && s.avg_days !== null)
    .reduce<{ label: string; days: number } | null>((best, s) => (!best || Number(s.avg_days) > best.days ? { label: stageLabel(s.stage), days: Number(s.avg_days) } : best), null);

  const parts: string[] = [];
  if (filters.opened_from || filters.opened_to) parts.push(`admitted ${filters.opened_from ?? 'start'} to ${filters.opened_to ?? 'today'}`);
  for (const [key, label] of [['intake', 'Intake'], ['destination', 'Destination'], ['nationality', 'Nationality'], ['visa_type', 'Visa type'], ['risk', 'Risk']] as const) {
    const v = filters[key];
    if (v?.length) parts.push(`${label}: ${v.join(', ')}`);
  }
  const intake = filters.intake?.length ? filters.intake.join(', ') : 'All intakes';
  const model: IntakeReportModel = {
    orgName: ctx.org.name,
    title: `Intake summary: ${intake}`,
    filterSummary: parts.length ? parts.join(' · ') : 'All applicants',
    generatedOn: new Date().toISOString().slice(0, 10),
    generatedBy: `by ${ctx.user.fullName}`,
    kpis: [
      { label: 'Applicants in scope', value: String(k.total ?? 0) },
      { label: 'Active cases', value: String(k.active ?? 0) },
      { label: 'Acceptance rate', value: k.acceptance_rate === null ? '-' : `${k.acceptance_rate}%`, note: `${k.approved ?? 0} approved · ${k.refused ?? 0} refused` },
      { label: 'High-risk open cases', value: String(k.high_risk ?? 0) },
      { label: 'Median days, admission to decision', value: k.median_admission_to_decision_days === null ? '-' : `${k.median_admission_to_decision_days} d` },
      { label: 'Documents verified (open cases)', value: k.docs_verified_pct === null ? '-' : `${k.docs_verified_pct}%` },
    ],
    funnel: f.map((r, i) => ({ label: FUNNEL[r.step] ?? r.step, value: r.value, conversion: i === 0 || f[i - 1].value === 0 ? null : Math.round((r.value / f[i - 1].value) * 100) })),
    acceptance: (acc.data as { key: string; decided: number | string; approved: number | string; rate: number | string }[]).map((a) => ({ key: a.key, decided: Number(a.decided), approved: Number(a.approved), rate: Number(a.rate) })),
    risk: { high, medium, low, unscored: Math.max(0, openTotal - high - medium - low) },
    slowestStage: slow,
  };

  const pdf = await renderToBuffer(<IntakeReport m={model} />);
  await supabase.rpc('log_client_activity', { p_org: ctx.org.id, p_type: 'report_generated', p_payload: { name: 'intake summary' } });
  const filename = `intake-summary-${intake.replace(/[^\w]+/g, '-').toLowerCase()}-${model.generatedOn}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  });
}
