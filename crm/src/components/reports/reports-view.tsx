'use client';

import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CaseFilterBar } from '@/components/app/filter-bar';
import { useOrg } from '@/components/app/org-context';
import { PageHeader } from '@/components/app/page-header';
import { PremiumGate } from '@/components/app/upgrade';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CASE_EXPORT_HEADERS, caseExportRow, downloadBlob, downloadTable } from '@/lib/export';
import { filtersToParams, parseFilters, type CaseFilters } from '@/lib/filters';
import { fetchAllCases } from '@/lib/queries/cases';
import { logExportAction } from '@/lib/actions/cases';

export function ReportsView() {
  const { org } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [busy, setBusy] = useState<string | null>(null);
  const setFilters = (f: CaseFilters) => { const q = filtersToParams(f).toString(); router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }); };

  async function pdf() {
    setBusy('pdf');
    try {
      const res = await fetch(`/api/reports/intake?${filtersToParams(filters)}`);
      if (!res.ok) throw new Error(res.status === 402 ? 'Reports are part of the Premium plan' : 'Could not generate the report');
      const cd = res.headers.get('content-disposition') ?? '';
      downloadBlob(await res.blob(), /filename="([^"]+)"/.exec(cd)?.[1] ?? 'intake-summary.pdf');
      toast.success('Report generated');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  async function exportCases(extra: CaseFilters, name: string, format: 'csv' | 'xlsx') {
    setBusy(name);
    try {
      const rows = await fetchAllCases(org.id, { ...filters, ...extra });
      await downloadTable({ filename: `${name}-${new Date().toISOString().slice(0, 10)}`, format, headers: CASE_EXPORT_HEADERS, rows: rows.map(caseExportRow), sheet: name });
      void logExportAction({ what: name, rows: rows.length });
      toast.success(`Exported ${rows.length} rows`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Reports & exports" description="One-page summaries for management or client marketing, and data exports for any list. Filters apply to everything below." />
      <PremiumGate feature="reports">
        <div className="mb-5 rounded-xl border bg-card p-3"><CaseFilterBar filters={filters} onChange={setFilters} hide={['stage', 'tag']} datesLabel="Cases admitted between" /></div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="size-4" /> Intake summary (PDF)</CardTitle>
              <CardDescription>A single page with headline numbers, the pipeline funnel, acceptance by destination, open cases by risk and the main bottleneck. Aggregates only: safe to share with management or clients.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">Tip: filter to one intake above to report on that cohort.</p>
              <Button className="justify-self-start" loading={busy === 'pdf'} onClick={() => void pdf()}><FileDown /> Generate PDF</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-4" /> Data exports</CardTitle>
              <CardDescription>Download the applicant list matching the filters. Spreadsheet formulas in text cells are neutralised.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {([['applicants', 'All applicants', {}], ['open-at-risk', 'Open cases at risk (high + medium)', { open: true, risk: ['high', 'medium'] }], ['decisions', 'Decided cases', { decided: true }]] as const).map(([key, label, extra]) => (
                <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="outline" loading={busy === key} onClick={() => void exportCases(extra as CaseFilters, key, 'csv')}>CSV</Button>
                    <Button size="sm" variant="outline" loading={busy === key} onClick={() => void exportCases(extra as CaseFilters, key, 'xlsx')}>XLSX</Button>
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Chart data can be exported from the Overview dashboard (per chart, or everything as one workbook).</p>
            </CardContent>
          </Card>
        </div>
      </PremiumGate>
    </>
  );
}
