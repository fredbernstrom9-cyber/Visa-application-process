'use client';

import { useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Destination, StageBadge } from '@/components/app/badges';
import { useLive } from '@/components/live/realtime-provider';
import { Alert, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { finishImportAction, importChunkAction, type ImportChunkResult } from '@/lib/actions/cases';
import { destinationOptions, flagEmoji } from '@/lib/countries';
import { STAGES, VISA_TYPES, type CaseStage, type VisaType } from '@/lib/domain';
import { downloadBlob, toCsv } from '@/lib/export';
import {
  autoMapColumns, buildImportRows, IMPORT_FIELDS, missingRequired, type Cell, type ColumnMapping, type FieldKey, type ImportOptions,
} from '@/lib/import/mapping';
import { useMembers } from '@/lib/queries/cases';
import { cn } from '@/lib/utils';

interface Parsed { filename: string; sheets: { name: string; data: Cell[][] }[] }

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10_000;

async function parseFile(file: File): Promise<Parsed> {
  if (file.size > MAX_BYTES) throw new Error('That file is larger than 10 MB. Split it into smaller files.');
  const lower = file.name.toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(lower)) {
    const data = await new Promise<string[][]>((resolve, reject) => {
      Papa.parse<string[]>(file, { skipEmptyLines: 'greedy', complete: (r) => resolve(r.data), error: reject });
    });
    return { filename: file.name, sheets: [{ name: 'CSV', data }] };
  }
  if (/\.xlsx$/.test(lower)) {
    const mod = await import('read-excel-file/browser');
    const sheets = await (mod.default as unknown as (f: File) => Promise<{ sheet: string; data: Cell[][] }[]>)(file);
    return { filename: file.name, sheets: sheets.map((s) => ({ name: s.sheet, data: s.data })) };
  }
  throw new Error('Unsupported file type. Upload a .csv or .xlsx file (re-save .xls files as .xlsx).');
}

type Step = 'upload' | 'map' | 'preview' | 'import';

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dateFormat, setDateFormat] = useState<'dmy' | 'mdy'>('dmy');
  const [defaults, setDefaults] = useState<ImportOptions['defaults']>({ visaType: 'D', stage: 'admitted' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<(ImportChunkResult & { skipped: number }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: members } = useMembers();
  const qc = useQueryClient();
  const { announce } = useLive();

  const sheet = parsed?.sheets[sheetIdx];
  const headerRowIdx = useMemo(() => sheet?.data.findIndex((r) => r.some((c) => String(c ?? '').trim() !== '')) ?? -1, [sheet]);
  const headers = useMemo(() => {
    if (!sheet || headerRowIdx < 0) return [];
    return sheet.data[headerRowIdx].map((c, i) => String(c ?? '').trim() || `Column ${i + 1}`);
  }, [sheet, headerRowIdx]);
  const body = useMemo(() => (sheet && headerRowIdx >= 0 ? sheet.data.slice(headerRowIdx + 1) : []), [sheet, headerRowIdx]);

  const options: ImportOptions = useMemo(() => ({
    dateFormat, defaults,
    members: (members ?? []).map((m) => ({ id: m.user_id, name: m.full_name, email: m.email })),
  }), [dateFormat, defaults, members]);
  const built = useMemo(() => (step === 'preview' || step === 'import' ? buildImportRows(body, mapping, options) : null), [step, body, mapping, options]);
  const missing = missingRequired(mapping, defaults);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const p = await parseFile(file);
      const first = p.sheets.findIndex((s) => s.data.length > 1);
      if (first < 0) throw new Error('No data rows found. The first row must contain column headers.');
      if (p.sheets[first].data.length - 1 > MAX_ROWS) throw new Error(`This sheet has more than ${MAX_ROWS.toLocaleString()} rows. Split the file and import in parts.`);
      setParsed(p);
      setSheetIdx(first);
      const hdr = p.sheets[first].data.find((r) => r.some((c) => String(c ?? '').trim() !== '')) ?? [];
      setMapping(autoMapColumns(hdr.map((c, i) => String(c ?? '').trim() || `Column ${i + 1}`)));
      setStep('map');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function changeSheet(i: number) {
    setSheetIdx(i);
    const s = parsed!.sheets[i];
    const hdr = s.data.find((r) => r.some((c) => String(c ?? '').trim() !== '')) ?? [];
    setMapping(autoMapColumns(hdr.map((c, k) => String(c ?? '').trim() || `Column ${k + 1}`)));
  }

  async function runImport() {
    if (!built || !parsed) return;
    setStep('import');
    setBusy(true);
    setError(null);
    const agg: ImportChunkResult & { skipped: number } = { cases_created: 0, applicants_created: 0, applicants_reused: 0, errors: [], plan_limit_reached: false, skipped: built.errorRowCount };
    const size = 200;
    for (let i = 0; i < built.rows.length; i += size) {
      const res = await importChunkAction(built.rows.slice(i, i + size));
      if (!res.ok) { setError(res.error); break; }
      agg.cases_created += res.data.cases_created;
      agg.applicants_created += res.data.applicants_created;
      agg.applicants_reused += res.data.applicants_reused;
      agg.errors.push(...res.data.errors);
      setProgress(Math.min(100, Math.round(((i + size) / built.rows.length) * 100)));
      if (res.data.plan_limit_reached) { agg.plan_limit_reached = true; break; }
    }
    agg.skipped += agg.errors.length;
    await finishImportAction({ filename: parsed.filename, created: agg.cases_created, skipped: agg.skipped });
    setResult(agg);
    setProgress(100);
    setBusy(false);
    void qc.invalidateQueries();
    announce(['cases', 'case', 'activity', 'analytics', 'filter-options', 'pipeline']);
    if (agg.cases_created > 0) toast.success(`Imported ${agg.cases_created} cases`);
  }

  function downloadErrors() {
    if (!built) return;
    const csv = toCsv(['Row', 'Field', 'Problem'], [...built.errors, ...(result?.errors ?? []).map((e) => ({ row: Number(e.index), field: 'database', message: e.error }))].map((e) => [e.row, e.field ?? '', e.message]));
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'import-errors.csv');
  }

  const steps: { key: Step; label: string }[] = [{ key: 'upload', label: 'Upload' }, { key: 'map', label: 'Match columns' }, { key: 'preview', label: 'Preview' }, { key: 'import', label: 'Import' }];

  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Progress">
        {steps.map((s, i) => {
          const idx = steps.findIndex((x) => x.key === step);
          const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
          return (
            <li key={s.key} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
              <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-semibold', state === 'done' && 'bg-ok text-white dark:text-background', state === 'current' && 'bg-primary text-primary-foreground', state === 'todo' && 'bg-muted text-muted-foreground')}>
                {state === 'done' ? <CheckCircle2 className="size-4" /> : i + 1}
              </span>
              <span className={cn(state === 'todo' && 'text-muted-foreground', state === 'current' && 'font-medium')}>{s.label}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {error && <Alert tone="danger" title="Something needs attention">{error}</Alert>}

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your applicant list</CardTitle>
            <CardDescription>CSV or XLSX, up to 10 MB / {MAX_ROWS.toLocaleString()} rows. The first row must contain column headers. Nothing is saved until you confirm.</CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="import-file"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors hover:border-primary hover:bg-accent/40 focus-within:border-primary"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground"><Upload className="size-5" /></span>
              <span className="font-medium">{busy ? 'Reading file…' : 'Drop a file here, or click to choose'}</span>
              <span className="text-sm text-muted-foreground">.csv or .xlsx</span>
              <input ref={inputRef} id="import-file" type="file" accept=".csv,.tsv,.txt,.xlsx" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <p className="mt-4 text-sm text-muted-foreground">
              Tip: people are matched on e-mail, so re-importing an updated list adds new cases instead of duplicating applicants.
              Include <em>admission</em>, <em>submission</em> and <em>decision</em> dates for historical cases to get accurate analytics from day one.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'map' && parsed && (
        <div className="grid gap-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-4" /> {parsed.filename}</CardTitle>
                <CardDescription>{body.length.toLocaleString()} data rows · {headers.length} columns. We matched columns automatically: check them and fix anything that is off.</CardDescription>
              </div>
              {parsed.sheets.length > 1 && (
                <Select value={sheetIdx} onChange={(e) => changeSheet(Number(e.target.value))} aria-label="Sheet" className="w-40">
                  {parsed.sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </Select>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Column in your file</TableHead><TableHead>Sample values</TableHead></TableRow></TableHeader>
                <TableBody>
                  {IMPORT_FIELDS.map((f) => {
                    const col = mapping[f.key];
                    const samples = col === null || col === undefined ? [] : body.slice(0, 3).map((r) => String(r[col] instanceof Date ? (r[col] as Date).toISOString().slice(0, 10) : r[col] ?? '')).filter(Boolean);
                    return (
                      <TableRow key={f.key}>
                        <TableCell className="min-w-44">
                          <span className="font-medium">{f.label}</span>{f.required && <span className="text-destructive"> *</span>}
                          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                        </TableCell>
                        <TableCell className="min-w-56">
                          <Select
                            aria-label={`Column for ${f.label}`}
                            value={col ?? ''}
                            onChange={(e) => setMapping((m) => ({ ...m, [f.key as FieldKey]: e.target.value === '' ? null : Number(e.target.value) }))}
                          >
                            <option value="">— not in my file —</option>
                            {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{samples.join(' · ') || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Defaults &amp; formats</CardTitle><CardDescription>Used when a column is missing or a cell is blank.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Default destination" htmlFor="d-dest" hint={mapping.destination == null ? 'Required: no destination column mapped.' : undefined}>
                <Select id="d-dest" value={defaults.destination ?? ''} onChange={(e) => setDefaults({ ...defaults, destination: e.target.value || null })}>
                  <option value="">None</option>
                  {destinationOptions().map((c) => <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>)}
                </Select>
              </Field>
              <Field label="Default visa type" htmlFor="d-visa">
                <Select id="d-visa" value={defaults.visaType ?? 'C'} onChange={(e) => setDefaults({ ...defaults, visaType: e.target.value as VisaType })}>
                  {VISA_TYPES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Default stage" htmlFor="d-stage">
                <Select id="d-stage" value={defaults.stage ?? 'admitted'} onChange={(e) => setDefaults({ ...defaults, stage: e.target.value as CaseStage })}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Default intake" htmlFor="d-intake"><Input id="d-intake" value={defaults.intake ?? ''} onChange={(e) => setDefaults({ ...defaults, intake: e.target.value || null })} placeholder="e.g. Sep 2027" /></Field>
              <Field label="Default advisor" htmlFor="d-adv">
                <Select id="d-adv" value={defaults.advisorId ?? ''} onChange={(e) => setDefaults({ ...defaults, advisorId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {(members ?? []).filter((m) => m.role !== 'viewer').map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
                </Select>
              </Field>
              <Field label="Date format in file" htmlFor="d-date" hint="Applies to text dates like 03/04/2026.">
                <Select id="d-date" value={dateFormat} onChange={(e) => setDateFormat(e.target.value as 'dmy' | 'mdy')}>
                  <option value="dmy">Day / Month / Year</option>
                  <option value="mdy">Month / Day / Year</option>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => { setStep('upload'); setParsed(null); }}><ArrowLeft /> Choose another file</Button>
            <div className="flex items-center gap-3">
              {missing.length > 0 && <span className="text-sm text-destructive">Still needed: {missing.join(', ')}</span>}
              <Button disabled={missing.length > 0} onClick={() => setStep('preview')}>Preview import <ArrowRight /></Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && built && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="py-4"><p className="text-2xl font-semibold text-ok">{built.rows.length.toLocaleString()}</p><p className="text-sm text-muted-foreground">rows ready to import</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className={cn('text-2xl font-semibold', built.errorRowCount ? 'text-danger' : '')}>{built.errorRowCount.toLocaleString()}</p><p className="text-sm text-muted-foreground">rows with errors (will be skipped)</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className={cn('text-2xl font-semibold', built.warnings.length ? 'text-warn' : '')}>{built.warnings.length.toLocaleString()}</p><p className="text-sm text-muted-foreground">warnings (imported anyway)</p></CardContent></Card>
          </div>

          {built.errors.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-danger" /> Rows that need fixing</CardTitle><CardDescription>Fix them in your file and import again, or continue without them.</CardDescription></div>
                <Button variant="outline" size="sm" onClick={downloadErrors}><Download /> Error report</Button>
              </CardHeader>
              <CardContent className="max-h-72 overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Field</TableHead><TableHead>Problem</TableHead></TableRow></TableHeader>
                  <TableBody>{built.errors.slice(0, 200).map((e, i) => <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell className="text-muted-foreground">{e.field}</TableCell><TableCell>{e.message}</TableCell></TableRow>)}</TableBody>
                </Table>
                {built.errors.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 200 of {built.errors.length}. Download the report for all.</p>}
              </CardContent>
            </Card>
          )}

          {built.warnings.length > 0 && (
            <Alert tone="warn" title={`${built.warnings.length} warnings`}>
              {built.warnings.slice(0, 4).map((w, i) => <span key={i} className="block">Row {w.row}: {w.message}</span>)}
              {built.warnings.length > 4 && <span className="block">…and {built.warnings.length - 4} more</span>}
            </Alert>
          )}

          <Card>
            <CardHeader><CardTitle>Preview</CardTitle><CardDescription>The first {Math.min(15, built.rows.length)} rows exactly as they will be created.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Name</TableHead><TableHead>Destination</TableHead><TableHead>Visa</TableHead><TableHead>Stage</TableHead><TableHead>Start</TableHead><TableHead>Intake</TableHead><TableHead>Tags</TableHead></TableRow></TableHeader>
                <TableBody>
                  {built.rows.slice(0, 15).map((r) => (
                    <TableRow key={r.idx}>
                      <TableCell className="text-muted-foreground">{r.idx}</TableCell>
                      <TableCell><span className="font-medium">{r.full_name}</span><p className="text-xs text-muted-foreground">{r.email}</p></TableCell>
                      <TableCell><Destination code={r.destination} /></TableCell>
                      <TableCell>{r.visa_type}</TableCell>
                      <TableCell><StageBadge stage={r.stage} short /></TableCell>
                      <TableCell>{r.start_date ?? '—'}</TableCell>
                      <TableCell>{r.intake ?? '—'}</TableCell>
                      <TableCell>{r.tags.map((t) => <Badge key={t} tone="info" className="mr-1">{t}</Badge>)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep('map')}><ArrowLeft /> Back to matching</Button>
            <Button disabled={built.rows.length === 0} onClick={runImport}>Import {built.rows.length.toLocaleString()} rows <ArrowRight /></Button>
          </div>
        </div>
      )}

      {step === 'import' && (
        <Card>
          <CardHeader><CardTitle>{busy ? 'Importing…' : 'Import finished'}</CardTitle><CardDescription>{busy ? 'Keep this tab open. Your team sees new applicants appear live.' : 'Summary of what happened.'}</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Progress value={progress} label="Import progress" />
            {result && (
              <>
                <ul className="grid gap-1 text-sm">
                  <li><strong>{result.cases_created}</strong> cases created</li>
                  <li><strong>{result.applicants_created}</strong> new applicants · <strong>{result.applicants_reused}</strong> matched to existing people by e-mail</li>
                  <li><strong>{result.skipped}</strong> rows skipped</li>
                </ul>
                {result.plan_limit_reached && <Alert tone="warn" title="Plan limit reached">Your plan&apos;s applicant limit stopped the import. Remaining rows were not imported.</Alert>}
                <div className="flex flex-wrap gap-2">
                  <Button asChild><Link href="/applicants">View applicants</Link></Button>
                  {(built?.errors.length || result.errors.length) ? <Button variant="outline" onClick={downloadErrors}><Download /> Error report</Button> : null}
                  <Button variant="outline" onClick={() => { setStep('upload'); setParsed(null); setResult(null); setProgress(0); }}>Import another file</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
