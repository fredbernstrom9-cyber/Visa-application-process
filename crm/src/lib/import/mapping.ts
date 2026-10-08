import { DESTINATION_CODES, countryName, matchCountry } from '@/lib/countries';
import type { CaseStage, VisaType } from '@/lib/domain';

export type FieldKey =
  | 'full_name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'nationality' | 'residence_country'
  | 'destination' | 'visa_type' | 'purpose' | 'programme' | 'intake' | 'start_date' | 'appointment_date'
  | 'stage' | 'advisor' | 'tags' | 'notes' | 'opened_on' | 'submitted_on' | 'decision_on';

export interface ImportField { key: FieldKey; label: string; required?: boolean; aliases: string[]; help?: string }

export const IMPORT_FIELDS: readonly ImportField[] = [
  { key: 'full_name', label: 'Full name', required: true, aliases: ['full name', 'name', 'applicant', 'applicant name', 'student', 'student name', 'candidate', 'fullname', 'client', 'client name'], help: 'Or map first + last name instead.' },
  { key: 'first_name', label: 'First name', aliases: ['first name', 'given name', 'firstname', 'forename'] },
  { key: 'last_name', label: 'Last name', aliases: ['last name', 'surname', 'family name', 'lastname'] },
  { key: 'email', label: 'E-mail', aliases: ['email', 'e-mail', 'email address', 'mail', 'e mail'], help: 'Used to match people you already have.' },
  { key: 'phone', label: 'Phone / WhatsApp', aliases: ['phone', 'mobile', 'whatsapp', 'tel', 'telephone', 'phone number', 'cell', 'phone whatsapp', 'mobile number'] },
  { key: 'nationality', label: 'Nationality', aliases: ['nationality', 'citizenship', 'passport', 'passport country', 'country of citizenship', 'citizen of'] },
  { key: 'residence_country', label: 'Country of residence', aliases: ['country of residence', 'residence', 'resident country', 'lives in', 'current country', 'residence country'] },
  { key: 'destination', label: 'Destination (EU / Schengen)', required: true, aliases: ['destination', 'destination country', 'target country', 'schengen state', 'applying to', 'study country', 'embassy', 'consulate', 'country'], help: 'Required unless you set a default below.' },
  { key: 'visa_type', label: 'Visa type', aliases: ['visa type', 'visa', 'type', 'category', 'visa category'] },
  { key: 'purpose', label: 'Purpose', aliases: ['purpose', 'reason', 'purpose of stay', 'purpose of travel'] },
  { key: 'programme', label: 'Programme / trip', aliases: ['programme', 'program', 'course', 'trip', 'degree', 'study programme', 'study program', 'major'] },
  { key: 'intake', label: 'Intake / cohort', aliases: ['intake', 'cohort', 'batch', 'semester', 'term', 'session', 'start term'] },
  { key: 'start_date', label: 'Start date', aliases: ['start date', 'start', 'course start', 'programme start', 'program start', 'arrival date', 'travel date', 'departure date', 'intake start', 'start of studies'] },
  { key: 'appointment_date', label: 'Appointment date', aliases: ['appointment', 'appointment date', 'vfs appointment', 'embassy appointment', 'interview date', 'biometrics date'] },
  { key: 'stage', label: 'Stage', aliases: ['stage', 'status', 'case status', 'pipeline stage', 'visa status'] },
  { key: 'advisor', label: 'Assigned advisor', aliases: ['advisor', 'assigned to', 'owner', 'case manager', 'counsellor', 'counselor', 'agent', 'assigned advisor', 'consultant'], help: 'Matched to your team by name or e-mail.' },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels', 'groups', 'tag'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'comments', 'remarks', 'note'] },
  { key: 'opened_on', label: 'Admitted / opened on', aliases: ['admission date', 'admitted on', 'date admitted', 'opened', 'opened on', 'created', 'application date', 'signed on', 'date signed'], help: 'Anchors analytics for historical cases.' },
  { key: 'submitted_on', label: 'Submitted on', aliases: ['submitted', 'submission date', 'submitted on', 'date submitted', 'lodged on'] },
  { key: 'decision_on', label: 'Decision date', aliases: ['decision date', 'decided', 'decision on', 'outcome date', 'date of decision'] },
];

export type ColumnMapping = Partial<Record<FieldKey, number | null>>;

export function normalizeHeader(h: unknown): string {
  return String(h ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Greedy best-match of spreadsheet columns to product fields (one column per field, one field per column). */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const norm = headers.map(normalizeHeader);
  const candidates: { field: FieldKey; col: number; score: number }[] = [];
  for (const f of IMPORT_FIELDS) {
    const aliases = [normalizeHeader(f.label), ...f.aliases.map(normalizeHeader), f.key.replace(/_/g, ' ')];
    norm.forEach((h, col) => {
      if (!h) return;
      let best = 0;
      aliases.forEach((a, i) => {
        if (h === a) best = Math.max(best, i < 2 ? 1 : 0.95);
        else if (h.includes(a) && a.length >= 4) best = Math.max(best, 0.6 + Math.min(a.length, 12) / 100);
        else if (a.includes(h) && h.length >= 4) best = Math.max(best, 0.5);
      });
      // a bare "country" column is ambiguous: prefer a specific match elsewhere
      if (f.key === 'destination' && h === 'country') best = Math.min(best, 0.55);
      if (best >= 0.5) candidates.push({ field: f.key, col, score: best });
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const mapping: ColumnMapping = {};
  const usedCols = new Set<number>();
  for (const c of candidates) {
    if (mapping[c.field] !== undefined || usedCols.has(c.col)) continue;
    mapping[c.field] = c.col;
    usedCols.add(c.col);
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Value parsers
// ---------------------------------------------------------------------------
export type Cell = string | number | boolean | Date | null | undefined;

export function cellText(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function validIso(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Returns an ISO date, null for blank, or 'invalid'. */
export function parseDateCell(v: Cell, fmt: 'dmy' | 'mdy' = 'dmy'): string | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'invalid' : (validIso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) ?? 'invalid');
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
      return validIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) ?? 'invalid';
    }
    return 'invalid';
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validIso(+m[1], +m[2], +m[3]) ?? 'invalid';
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const [a, b] = [+m[1], +m[2]];
    return (fmt === 'dmy' ? validIso(y, b, a) : validIso(y, a, b)) ?? 'invalid';
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})$/.exec(s);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return mi >= 0 ? (validIso(+m[3], mi + 1, +m[1]) ?? 'invalid') : 'invalid';
  }
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return mi >= 0 ? (validIso(+m[3], mi + 1, +m[2]) ?? 'invalid') : 'invalid';
  }
  return 'invalid';
}

export function parseVisaType(raw: string): VisaType | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^(c|type c|short|short[- ]?stay|schengen|tourist|visit(or)?|business|sc)$/.test(s)) return 'C';
  if (/^(d|type d|long|long[- ]?stay|national|student|study|work|d visa|nv|national visa)$/.test(s)) return 'D';
  if (/^(other|o)$/.test(s)) return 'other';
  return null;
}

const STAGE_WORDS: [RegExp, CaseStage][] = [
  [/^(admitted|signed|new|admitted ?\/ ?signed|enrolled|accepted|offer accepted|open)$/, 'admitted'],
  [/^(documents?|docs|documents in progress|collecting|in progress|document collection)$/, 'documents'],
  [/^(appointment|appointment booked|booked|appointment scheduled)$/, 'appointment'],
  [/^(submitted|applied|lodged|filed)$/, 'submitted'],
  [/^(decision pending|pending|waiting|awaiting decision|in review|processing)$/, 'decision_pending'],
  [/^(approved|granted|issued|visa granted|accepted visa|success(ful)?)$/, 'approved'],
  [/^(refused|rejected|denied|declined|refusal)$/, 'refused'],
  [/^(withdrawn|cancel(l)?ed|deferred|dropped)$/, 'withdrawn'],
];
export function parseStage(raw: string): CaseStage | null {
  const s = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!s) return null;
  for (const [re, stage] of STAGE_WORDS) if (re.test(s)) return stage;
  return null;
}

export function splitTags(raw: string): string[] {
  return [...new Set(raw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean))].slice(0, 30).map((t) => t.slice(0, 40));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (s: string) => EMAIL_RE.test(s) && s.length <= 320;

// ---------------------------------------------------------------------------
// Row building + validation
// ---------------------------------------------------------------------------
export interface MemberRef { id: string; name: string; email: string }

export interface ImportOptions {
  dateFormat: 'dmy' | 'mdy';
  defaults: { destination?: string | null; visaType?: VisaType | null; intake?: string | null; stage?: CaseStage | null; advisorId?: string | null };
  members: MemberRef[];
}

export interface ImportRowPayload {
  idx: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  residence_country: string | null;
  destination: string;
  visa_type: VisaType;
  purpose: string | null;
  programme: string | null;
  intake: string | null;
  start_date: string | null;
  appointment_date: string | null;
  stage: CaseStage;
  assigned_to: string | null;
  tags: string[];
  notes: string | null;
  opened_on: string | null;
  submitted_at: string | null;
  decided_at: string | null;
}

export interface RowIssue { row: number; field?: string; message: string }
export interface BuildResult {
  rows: ImportRowPayload[];
  errors: RowIssue[];
  warnings: RowIssue[];
  errorRowCount: number;
  blankRows: number;
}

const iso2ts = (d: string | null) => (d ? `${d}T12:00:00Z` : null);

export function buildImportRows(data: Cell[][], mapping: ColumnMapping, options: ImportOptions): BuildResult {
  const out: BuildResult = { rows: [], errors: [], warnings: [], errorRowCount: 0, blankRows: 0 };
  const get = (row: Cell[], key: FieldKey): string => {
    const col = mapping[key];
    return col === null || col === undefined ? '' : cellText(row[col]);
  };
  const raw = (row: Cell[], key: FieldKey): Cell => {
    const col = mapping[key];
    return col === null || col === undefined ? null : row[col];
  };

  data.forEach((row, i) => {
    const rowNo = i + 2; // header is row 1
    if (row.every((c) => cellText(c) === '')) { out.blankRows++; return; }
    const errs: RowIssue[] = [];
    const err = (field: FieldKey, message: string) => errs.push({ row: rowNo, field, message });
    const warn = (field: FieldKey, message: string) => out.warnings.push({ row: rowNo, field, message });

    let fullName = get(row, 'full_name');
    if (!fullName) fullName = [get(row, 'first_name'), get(row, 'last_name')].filter(Boolean).join(' ');
    if (!fullName) err('full_name', 'Name is missing');
    if (fullName.length > 200) err('full_name', 'Name is longer than 200 characters');

    const emailRaw = get(row, 'email').toLowerCase();
    let email: string | null = null;
    if (emailRaw) { if (isEmail(emailRaw)) email = emailRaw; else err('email', `"${emailRaw}" is not a valid e-mail address`); }

    const nationalityRaw = get(row, 'nationality');
    let nationality: string | null = null;
    if (nationalityRaw) { nationality = matchCountry(nationalityRaw); if (!nationality) err('nationality', `Unknown nationality "${nationalityRaw}". Use the country name or 2-letter code`); }

    const residenceRaw = get(row, 'residence_country');
    let residence: string | null = null;
    if (residenceRaw) { residence = matchCountry(residenceRaw); if (!residence) err('residence_country', `Unknown country "${residenceRaw}"`); }

    const destRaw = get(row, 'destination');
    let destination: string | null = null;
    if (destRaw) {
      destination = matchCountry(destRaw);
      if (!destination) err('destination', `Unknown destination "${destRaw}"`);
      else if (!DESTINATION_CODES.includes(destination)) { err('destination', `${countryName(destination)} is not an EU / Schengen destination`); destination = null; }
    } else if (options.defaults.destination) destination = options.defaults.destination;
    else err('destination', 'Destination is missing (map a column or choose a default)');

    const visaRaw = get(row, 'visa_type');
    let visa: VisaType = options.defaults.visaType ?? 'C';
    if (visaRaw) { const v = parseVisaType(visaRaw); if (v) visa = v; else err('visa_type', `Unknown visa type "${visaRaw}". Use C, D or Other`); }

    const stageRaw = get(row, 'stage');
    let stage: CaseStage = options.defaults.stage ?? 'admitted';
    if (stageRaw) { const s = parseStage(stageRaw); if (s) stage = s; else err('stage', `Unknown stage "${stageRaw}"`); }

    const dates: Partial<Record<FieldKey, string | null>> = {};
    for (const k of ['start_date', 'appointment_date', 'opened_on', 'submitted_on', 'decision_on'] as const) {
      const r = parseDateCell(raw(row, k) as Cell, options.dateFormat);
      if (r === 'invalid') { err(k, `"${get(row, k)}" is not a valid date`); dates[k] = null; } else dates[k] = r;
    }

    let assigned: string | null = options.defaults.advisorId ?? null;
    const advisorRaw = get(row, 'advisor');
    if (advisorRaw) {
      const q = advisorRaw.toLowerCase();
      const m = options.members.find((x) => x.email.toLowerCase() === q) ?? options.members.find((x) => x.name.toLowerCase() === q);
      if (m) assigned = m.id; else warn('advisor', `Advisor "${advisorRaw}" is not in your team: left unassigned`);
    }

    if ((stage === 'approved' || stage === 'refused') && !dates.decision_on) warn('decision_on', 'No decision date: today will be used, which affects timing analytics');
    if (['submitted', 'decision_pending', 'approved', 'refused'].includes(stage) && !dates.submitted_on) warn('submitted_on', 'No submission date: today will be used for timing analytics');

    if (errs.length > 0) {
      out.errors.push(...errs);
      out.errorRowCount++;
      return;
    }
    out.rows.push({
      idx: rowNo,
      full_name: fullName,
      email,
      phone: get(row, 'phone') || null,
      nationality,
      residence_country: residence,
      destination: destination!,
      visa_type: visa,
      purpose: get(row, 'purpose') || null,
      programme: get(row, 'programme') || null,
      intake: get(row, 'intake') || options.defaults.intake || null,
      start_date: dates.start_date ?? null,
      appointment_date: dates.appointment_date ?? null,
      stage,
      assigned_to: assigned,
      tags: splitTags(get(row, 'tags')),
      notes: get(row, 'notes') || null,
      opened_on: dates.opened_on ?? null,
      submitted_at: iso2ts(dates.submitted_on ?? null),
      decided_at: iso2ts(dates.decision_on ?? null),
    });
  });
  return out;
}

/** Which required fields are still unmapped (taking defaults and first+last name into account). */
export function missingRequired(mapping: ColumnMapping, defaults: ImportOptions['defaults']): string[] {
  const missing: string[] = [];
  const has = (k: FieldKey) => mapping[k] !== null && mapping[k] !== undefined;
  if (!has('full_name') && !(has('first_name') || has('last_name'))) missing.push('Full name');
  if (!has('destination') && !defaults.destination) missing.push('Destination');
  return missing;
}
