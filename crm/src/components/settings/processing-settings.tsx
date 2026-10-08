'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { RiskBadge } from '@/components/app/badges';
import { useOrg } from '@/components/app/org-context';
import { Alert, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { saveProcessingTimesAction, saveRiskSettingsAction } from '@/lib/actions/settings';
import { countryName, destinationOptions, flagEmoji } from '@/lib/countries';
import { addDays, isoDate } from '@/lib/filters';
import { computeRisk, DEFAULT_RISK_SETTINGS } from '@/lib/risk';
import { useOrgSettings } from '@/lib/queries/case-data';

interface Row { key: string; destination: string; visa_type: 'any' | 'C' | 'D' | 'other'; processing_days: number; appointment_wait_days: number; doc_prep_days: number; source_note: string }
const num = (v: string) => Math.max(0, Math.min(365, Math.round(Number(v) || 0)));

function RiskSimulator({ s }: { s: { processing: number; wait: number; prep: number; high: number; medium: number } }) {
  const [days, setDays] = useState(45);
  const [appt, setAppt] = useState(false);
  const [pct, setPct] = useState(40);
  const today = isoDate(new Date());
  const r = useMemo(() => computeRisk({
    stage: appt ? 'appointment' : 'documents', startDate: addDays(today, days), appointmentDate: appt ? addDays(today, Math.min(days, s.wait)) : null, submittedAt: null,
    docsTotal: 10, docsVerified: Math.round(pct / 10), today,
    processingDays: s.processing, appointmentWaitDays: s.wait, docPrepDays: s.prep, highBufferDays: s.high, mediumBufferDays: s.medium,
  }), [days, appt, pct, s, today]);
  return (
    <Card>
      <CardHeader><CardTitle>Try your settings</CardTitle><CardDescription>See how a case would score with the numbers above. Nothing is saved.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <Field label="Days until start" htmlFor="sim-days"><Input id="sim-days" type="number" min={0} max={730} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))} /></Field>
        <Field label="Documents verified (%)" htmlFor="sim-pct"><Input id="sim-pct" type="number" min={0} max={100} step={10} value={pct} onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="size-4" checked={appt} onChange={(e) => setAppt(e.target.checked)} /> Appointment booked</label>
        <div className="sm:col-span-3"><RiskBadge level={r.level} reason={r.reason} showReason /></div>
      </CardContent>
    </Card>
  );
}

export function ProcessingSettings() {
  const { isAdmin, settings: ctxSettings } = useOrg();
  const { data, isLoading } = useOrgSettings();
  const qc = useQueryClient();
  const [pending, start] = useTransition();
  const [vals, setVals] = useState({ processing: 30, wait: 14, prep: 21, high: 0, medium: 14 });
  const [rows, setRows] = useState<Row[]>([]);
  const [newDest, setNewDest] = useState('');
  const [confirmed, setConfirmed] = useState(ctxSettings?.processing_times_confirmed ?? false);

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    /* initialise the editable copy once the server data arrives */
    /* eslint-disable react-hooks/set-state-in-effect */
    setVals({ processing: s.default_processing_days, wait: s.default_appointment_wait_days, prep: s.default_doc_prep_days, high: s.high_buffer_days, medium: s.medium_buffer_days });
    setConfirmed(s.processing_times_confirmed);
    setRows(data.times.map((t) => ({ key: t.id, destination: t.destination, visa_type: t.visa_type, processing_days: t.processing_days, appointment_wait_days: t.appointment_wait_days, doc_prep_days: t.doc_prep_days, source_note: t.source_note ?? '' })));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data]);

  if (isLoading) return <Skeleton className="h-96" />;
  const disabled = !isAdmin;
  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const saveAll = (confirm: boolean) => start(async () => {
    const a = await saveRiskSettingsAction({
      default_processing_days: vals.processing, default_appointment_wait_days: vals.wait, default_doc_prep_days: vals.prep,
      high_buffer_days: vals.high, medium_buffer_days: vals.medium, confirm,
    });
    if (!a.ok) { toast.error(a.error); return; }
    const b = await saveProcessingTimesAction(rows.map((r) => ({ destination: r.destination, visa_type: r.visa_type, processing_days: r.processing_days, appointment_wait_days: r.appointment_wait_days, doc_prep_days: r.doc_prep_days, source_note: r.source_note })));
    if (!b.ok) { toast.error(b.error); return; }
    toast.success(confirm ? 'Saved and confirmed' : 'Settings saved');
    if (confirm) setConfirmed(true);
    void qc.invalidateQueries();
  });

  return (
    <div className="grid gap-5">
      {!confirmed && <Alert tone="info" title="Step 1 of setup">Enter how long things take for your destinations, then press <strong>Save &amp; confirm</strong>. Until then risk scores use the organisation defaults below.</Alert>}
      {confirmed && <Alert tone="ok" title="Processing times confirmed"><CheckCircle2 className="hidden" />Re-check them whenever consulates change their published waiting times.</Alert>}

      <Card>
        <CardHeader><CardTitle>Organisation defaults</CardTitle><CardDescription>Used for any destination you have not set below. All values are in days.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Visa processing time" htmlFor="d-proc" hint="From lodging the application to the decision."><Input id="d-proc" type="number" min={0} max={365} disabled={disabled} value={vals.processing} onChange={(e) => setVals({ ...vals, processing: num(e.target.value) })} /></Field>
          <Field label="Appointment wait" htmlFor="d-wait" hint="Time to get a consulate / VAC appointment."><Input id="d-wait" type="number" min={0} max={365} disabled={disabled} value={vals.wait} onChange={(e) => setVals({ ...vals, wait: num(e.target.value) })} /></Field>
          <Field label="Document preparation" htmlFor="d-prep" hint="Time to collect and verify a full file."><Input id="d-prep" type="number" min={0} max={365} disabled={disabled} value={vals.prep} onChange={(e) => setVals({ ...vals, prep: num(e.target.value) })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk thresholds</CardTitle>
          <CardDescription>Slack = days until start − estimated days still needed. A case is <strong>high</strong> risk when slack falls below the first value, <strong>medium</strong> below the second, otherwise <strong>low</strong>. Past start dates are always high.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="High risk below (days of slack)" htmlFor="r-high"><Input id="r-high" type="number" min={-90} max={365} disabled={disabled} value={vals.high} onChange={(e) => setVals({ ...vals, high: Math.round(Number(e.target.value) || 0) })} /></Field>
          <Field label="Medium risk below (days of slack)" htmlFor="r-med"><Input id="r-med" type="number" min={-90} max={365} disabled={disabled} value={vals.medium} onChange={(e) => setVals({ ...vals, medium: Math.round(Number(e.target.value) || 0) })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per destination</CardTitle>
          <CardDescription>Override the defaults for specific destinations, and optionally per visa type (a specific type beats “All types”).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Destination</TableHead><TableHead>Visa</TableHead><TableHead>Processing</TableHead><TableHead>Appointment</TableHead><TableHead>Doc prep</TableHead><TableHead>Source / note</TableHead><TableHead><span className="sr-only">Remove</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="whitespace-nowrap font-medium">{flagEmoji(r.destination)} {countryName(r.destination)}</TableCell>
                    <TableCell>
                      <Select aria-label={`Visa type for ${countryName(r.destination)}`} className="w-28" disabled={disabled} value={r.visa_type} onChange={(e) => setRow(r.key, { visa_type: e.target.value as Row['visa_type'] })}>
                        <option value="any">All types</option><option value="C">Type C</option><option value="D">Type D</option><option value="other">Other</option>
                      </Select>
                    </TableCell>
                    {(['processing_days', 'appointment_wait_days', 'doc_prep_days'] as const).map((k) => (
                      <TableCell key={k}><Input aria-label={`${k.replace(/_/g, ' ')} for ${countryName(r.destination)}`} className="w-20" type="number" min={0} max={365} disabled={disabled} value={r[k]} onChange={(e) => setRow(r.key, { [k]: num(e.target.value) })} /></TableCell>
                    ))}
                    <TableCell><Input aria-label={`Source for ${countryName(r.destination)}`} className="min-w-40" disabled={disabled} value={r.source_note} maxLength={300} placeholder="e.g. VFS Paris, checked 1 Oct" onChange={(e) => setRow(r.key, { source_note: e.target.value })} /></TableCell>
                    <TableCell>{!disabled && <Button size="icon-sm" variant="ghost" aria-label={`Remove ${countryName(r.destination)}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!disabled && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Add a destination" htmlFor="add-dest" className="w-64">
                <Select id="add-dest" value={newDest} onChange={(e) => setNewDest(e.target.value)}>
                  <option value="">Select…</option>
                  {destinationOptions().map((c) => <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>)}
                </Select>
              </Field>
              <Button variant="outline" disabled={!newDest} onClick={() => {
                setRows((rs) => [...rs, { key: crypto.randomUUID(), destination: newDest, visa_type: rs.some((r) => r.destination === newDest && r.visa_type === 'any') ? 'D' : 'any', processing_days: vals.processing, appointment_wait_days: vals.wait, doc_prep_days: vals.prep, source_note: '' }]);
                setNewDest('');
              }}><Plus /> Add</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <RiskSimulator s={vals} />

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Button loading={pending} onClick={() => saveAll(true)}>Save &amp; confirm</Button>
          <Button variant="outline" loading={pending} onClick={() => saveAll(false)}>Save</Button>
          <Button variant="ghost" onClick={() => { setVals({ processing: DEFAULT_RISK_SETTINGS.processingDays, wait: DEFAULT_RISK_SETTINGS.appointmentWaitDays, prep: DEFAULT_RISK_SETTINGS.docPrepDays, high: DEFAULT_RISK_SETTINGS.highBufferDays, medium: DEFAULT_RISK_SETTINGS.mediumBufferDays }); }}>Reset defaults</Button>
        </div>
      ) : <Alert tone="info">Only owners and admins can change these values.</Alert>}
    </div>
  );
}
