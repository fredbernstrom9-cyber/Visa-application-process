'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useLive } from '@/components/live/realtime-provider';
import { useOrg } from '@/components/app/org-context';
import { TagInput } from '@/components/app/tag-input';
import { Alert } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { addCaseAction, createApplicantAction, updateApplicantAction, updateCaseAction } from '@/lib/actions/cases';
import { applyRulebookAction } from '@/lib/actions/checklists';
import { countryOptions, destinationOptions, flagEmoji } from '@/lib/countries';
import { defaultRoute, ROUTES, STAGES, VISA_TYPES, type VisaType } from '@/lib/domain';
import { useFilterOptions, useMembers } from '@/lib/queries/cases';
import type { CaseRow } from '@/lib/types';

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; row: CaseRow }
  | { kind: 'add-case'; applicantId: string; applicantName: string };

interface FormState {
  full_name: string; email: string; phone: string; nationality: string; residence_country: string;
  destination: string; visa_type: string; route: string; purpose: string; programme: string; intake: string;
  start_date: string; appointment_date: string; assigned_to: string; stage: string; tags: string[]; notes: string;
}

function initial(mode: Mode, defaultAdvisor: string): FormState {
  if (mode.kind === 'edit') {
    const r = mode.row;
    return {
      full_name: r.full_name, email: r.email ?? '', phone: r.phone ?? '', nationality: r.nationality ?? '', residence_country: r.residence_country ?? '',
      destination: r.destination, visa_type: r.visa_type, route: r.route ?? '', purpose: r.purpose ?? '', programme: r.programme ?? '', intake: r.intake ?? '',
      start_date: r.start_date ?? '', appointment_date: r.appointment_date ?? '', assigned_to: r.assigned_to ?? '', stage: r.stage, tags: r.tags, notes: r.notes ?? '',
    };
  }
  return {
    full_name: '', email: '', phone: '', nationality: '', residence_country: '', destination: '', visa_type: 'D', route: 'study', purpose: '', programme: '', intake: '',
    start_date: '', appointment_date: '', assigned_to: defaultAdvisor, stage: 'admitted', tags: [], notes: '',
  };
}

export function ApplicantFormDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (o: boolean) => void; mode: Mode }) {
  // The body mounts only while the dialog is open, so every opening starts from fresh state.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <ApplicantFormBody mode={mode} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ApplicantFormBody({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const { user, role } = useOrg();
  const { data: members } = useMembers();
  const { data: filterOptions } = useFilterOptions();
  const router = useRouter();
  const qc = useQueryClient();
  const { announce } = useLive();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [v, setV] = useState<FormState>(() => initial(mode, role === 'advisor' ? user.id : ''));

  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => fieldErrors[k]?.[0] ?? null;
  const personFields = mode.kind !== 'add-case';
  const advisors = (members ?? []).filter((m) => m.role !== 'viewer');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const caseFields = {
      destination: v.destination, visa_type: v.visa_type, route: v.route || null, purpose: v.purpose, programme: v.programme, intake: v.intake,
      start_date: v.start_date, appointment_date: v.appointment_date, assigned_to: v.assigned_to || null, tags: v.tags, notes: v.notes,
    };
    const person = { full_name: v.full_name, email: v.email, phone: v.phone, nationality: v.nationality, residence_country: v.residence_country };
    start(async () => {
      let res;
      if (mode.kind === 'create') res = await createApplicantAction({ ...person, ...caseFields, stage: v.stage });
      else if (mode.kind === 'add-case') res = await addCaseAction({ applicantId: mode.applicantId, ...caseFields, stage: v.stage });
      else {
        const r1 = await updateApplicantAction(mode.row.applicant_id, person);
        res = r1.ok ? await updateCaseAction(mode.row.id, caseFields) : r1;
      }
      if (!res.ok) { setError(res.error); setFieldErrors(res.fieldErrors ?? {}); return; }
      toast.success(mode.kind === 'edit' ? 'Changes saved' : 'Applicant added');
      if (mode.kind === 'edit') {
        const r = mode.row;
        const rulesMayDiffer = (v.route || null) !== r.route || v.destination !== r.destination
          || (v.nationality || null) !== r.nationality || (v.residence_country || null) !== r.residence_country;
        if (rulesMayDiffer && v.route) {
          const a = await applyRulebookAction({ caseIds: [r.id] });
          if (a.ok && a.data.added > 0) toast.info(`Added ${a.data.added} rulebook items for the new destination, route or nationality. Remove any that no longer apply.`);
        }
      }
      onClose();
      void qc.invalidateQueries();
      announce(['cases', 'case', 'analytics', 'filter-options']);
      if (mode.kind !== 'edit') {
        const caseId = (res.data as { caseId: string }).caseId;
        router.push(`/cases/${caseId}`);
      }
    });
  }

  const title = mode.kind === 'create' ? 'New applicant' : mode.kind === 'edit' ? 'Edit applicant' : `New case for ${mode.applicantName}`;
  return (
    <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode.kind === 'create' ? 'Creates the applicant and their visa case. A matching checklist is applied automatically.' : 'Requirements must be confirmed with the consulate or official portal.'}
          </DialogDescription>
        </DialogHeader>
        <datalist id="intake-suggestions">{(filterOptions?.intakes ?? []).map((i) => <option key={i} value={i} />)}</datalist>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          {personFields && (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicant</legend>
              <Field label="Full name" htmlFor="f-name" required error={err('full_name')} className="sm:col-span-2"><Input id="f-name" value={v.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="off" required /></Field>
              <Field label="E-mail" htmlFor="f-email" error={err('email')}><Input id="f-email" type="email" value={v.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Phone / WhatsApp" htmlFor="f-phone" error={err('phone')}><Input id="f-phone" type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 7…" /></Field>
              <Field label="Nationality" htmlFor="f-nat" error={err('nationality')}>
                <Select id="f-nat" value={v.nationality} onChange={(e) => set('nationality', e.target.value)}>
                  <option value="">Select…</option>
                  {countryOptions().map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Country of residence" htmlFor="f-res" error={err('residence_country')}>
                <Select id="f-res" value={v.residence_country} onChange={(e) => set('residence_country', e.target.value)}>
                  <option value="">Select…</option>
                  {countryOptions().map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
              </Field>
            </fieldset>
          )}
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visa case</legend>
            <Field label="Destination (EU / Schengen)" htmlFor="f-dest" required error={err('destination')}>
              <Select id="f-dest" value={v.destination} onChange={(e) => set('destination', e.target.value)} required>
                <option value="">Select…</option>
                {destinationOptions().map((c) => <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</option>)}
              </Select>
            </Field>
            <Field label="Route" htmlFor="f-route" hint="Picks the rulebook checklist." error={err('route')}>
              <Select id="f-route" value={v.route} onChange={(e) => {
                const r = ROUTES.find((x) => x.key === e.target.value);
                setV((p) => ({ ...p, route: e.target.value, visa_type: r ? r.visa : p.visa_type }));
              }}>
                <option value="">No route (own checklist only)</option>
                {ROUTES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </Select>
            </Field>
            <Field label="Visa type" htmlFor="f-visa" required>
              <Select id="f-visa" value={v.visa_type} onChange={(e) => {
                const vt = e.target.value as VisaType;
                setV((p) => ({ ...p, visa_type: vt, route: p.route && ROUTES.find((x) => x.key === p.route)?.visa === vt ? p.route : (defaultRoute(vt) ?? '') }));
              }}>
                {VISA_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Purpose" htmlFor="f-purpose" error={err('purpose')}><Input id="f-purpose" value={v.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Study, internship, business…" /></Field>
            <Field label="Programme / trip" htmlFor="f-prog" error={err('programme')}><Input id="f-prog" value={v.programme} onChange={(e) => set('programme', e.target.value)} placeholder="MSc Management" /></Field>
            <Field label="Intake / cohort" htmlFor="f-intake" error={err('intake')}><Input id="f-intake" value={v.intake} onChange={(e) => set('intake', e.target.value)} placeholder="Sep 2027" list="intake-suggestions" /></Field>
            <Field label="Stage" htmlFor="f-stage">
              <Select id="f-stage" value={v.stage} onChange={(e) => set('stage', e.target.value)} disabled={mode.kind === 'edit'}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="f-start" hint="Drives the risk score." error={err('start_date')}><Input id="f-start" type="date" value={v.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
            <Field label="Appointment date" htmlFor="f-appt" error={err('appointment_date')}><Input id="f-appt" type="date" value={v.appointment_date} onChange={(e) => set('appointment_date', e.target.value)} /></Field>
            <Field label="Assigned advisor" htmlFor="f-advisor">
              <Select id="f-advisor" value={v.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {advisors.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="f-tags"><TagInput id="f-tags" value={v.tags} onChange={(t) => set('tags', t)} /></Field>
            <Field label="Notes" htmlFor="f-notes" className="sm:col-span-2" error={err('notes')}><Textarea id="f-notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} rows={3} /></Field>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={pending}>{mode.kind === 'edit' ? 'Save changes' : 'Create'}</Button>
          </DialogFooter>
        </form>
    </>
  );
}
