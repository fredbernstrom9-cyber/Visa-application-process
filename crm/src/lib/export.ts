import { countryName } from '@/lib/countries';
import { stageLabel, visaLabel } from '@/lib/domain';
import type { CaseRow } from '@/lib/types';

type Cell = string | number | boolean | Date | null | undefined;

/**
 * CSV/Excel formula injection guard: a text cell that starts with = + - @ (or tab / CR) would be
 * executed as a formula by Excel / Sheets, so it is prefixed with an apostrophe.
 */
export function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const esc = (c: Cell): string => {
    if (c === null || c === undefined) return '';
    const s = c instanceof Date ? c.toISOString().slice(0, 10) : typeof c === 'string' ? safeText(c) : String(c);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadTable(opts: { filename: string; format: 'csv' | 'xlsx'; headers: string[]; rows: Cell[][]; sheet?: string }) {
  const { filename, format, headers, rows } = opts;
  if (format === 'csv') {
    downloadBlob(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
    return;
  }
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const data = [
    headers.map((h) => ({ value: h, fontWeight: 'bold' as const })),
    ...rows.map((r) => r.map((c) => (c === null || c === undefined || c === '' ? null : typeof c === 'number' || typeof c === 'boolean' || c instanceof Date ? c : String(c)))),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await (writeExcelFile as any)(data, { sheet: opts.sheet ?? 'Export' }).toBlob();
  downloadBlob(blob, `${filename}.xlsx`);
}

export const CASE_EXPORT_HEADERS = [
  'Name', 'E-mail', 'Phone', 'Nationality', 'Residence', 'Destination', 'Visa type', 'Purpose', 'Programme / trip', 'Intake',
  'Start date', 'Appointment date', 'Stage', 'Risk', 'Risk reason', 'Docs verified %', 'Advisor', 'Tags', 'Admitted / opened',
  'Submitted', 'Decided', 'Notes',
];

export function caseExportRow(c: CaseRow): Cell[] {
  return [
    c.full_name, c.email, c.phone, countryName(c.nationality), countryName(c.residence_country), countryName(c.destination),
    visaLabel(c.visa_type), c.purpose, c.programme, c.intake, c.start_date, c.appointment_date, stageLabel(c.stage),
    c.risk_level ?? 'unscored', c.risk_reason, c.docs_pct, c.advisor_name, c.tags.join(', '), c.opened_on,
    c.submitted_at?.slice(0, 10) ?? null, c.decided_at?.slice(0, 10) ?? null, c.notes,
  ];
}

/** Multi-sheet XLSX workbook (used by "Export everything" on the dashboard). */
export async function downloadWorkbook(filename: string, sheets: { sheet: string; headers: string[]; rows: Cell[][] }[]) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const book = sheets.map((s) => ({
    sheet: s.sheet.slice(0, 31),
    data: [
      s.headers.map((h) => ({ value: h, fontWeight: 'bold' as const })),
      ...s.rows.map((r) => r.map((c) => (c === null || c === undefined || c === '' ? null : typeof c === 'number' || typeof c === 'boolean' || c instanceof Date ? c : String(c)))),
    ],
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await (writeExcelFile as any)(book).toBlob();
  downloadBlob(blob, `${filename}.xlsx`);
}
