// ClearEntry rulebook: the source format.
//
// The rulebook is authored here as typed data, validated by tests/unit/rulebook.test.ts and
// pushed to the database by `npm run rulebook:sync` (scripts/rulebook-sync.ts). Every rule and
// fact cites one or more sources by id; nothing goes in without a source.
//
// Country codes are ISO 3166-1 alpha-2 (as stored on applicants and cases), plus XK for Kosovo.

export type Iso2 = string;

/** The route a case follows. Mirrors private.valid_route() in the database. */
export type Route = 'study' | 'short_stay' | 'work' | 'research' | 'traineeship' | 'family';

/**
 * How sure we are.
 *  official  confirmed on an official government or EU source
 *  multi     confirmed by two or more independent sources
 *  check     one source only, or sources disagree: verify before acting
 */
export type Confidence = 'official' | 'multi' | 'check';

/** Nationality flags a rule can target (see nationalities.ts for who has which). */
export type Flag =
  | 'eea'             // EU / EEA / Swiss citizen: free movement, no visa or permit route applies
  | 'schengen_visa'   // needs a Schengen short-stay (C) visa
  | 'ireland_visa'    // needs an Irish entry visa
  | 'cta'             // Common Travel Area (British citizens in Ireland)
  | 'de41'            // §41(1) AufenthV: may enter Germany visa-free and apply there, any purpose
  | 'de41_no_work'    // §41(2) AufenthV: same, but not for employment
  | 'mvv_exempt'      // exempt from the Dutch MVV entry visa
  | 'aps';            // Germany requires an APS certificate (academic records from CN, IN, VN)

/**
 * Who a rule applies to. All given conditions must hold.
 * `flag` / `notFlag` are resolved to explicit nationality lists when the rulebook is compiled.
 * `residenceIn` / `residenceNotIn` target the country the applicant lives in (consulate-specific rules).
 */
export interface Target {
  flag?: Flag;
  notFlag?: Flag;
  in?: Iso2[];
  notIn?: Iso2[];
  residenceIn?: Iso2[];
  residenceNotIn?: Iso2[];
}

export interface Rule {
  /** Unique within its guide; becomes `<CC>.<route>.<key>` in the database. Keep it stable. */
  key: string;
  kind: 'document' | 'step';
  label: string;
  detail?: string;
  /** Optional items are shown but do not count toward "documents verified". */
  optional?: boolean;
  /** Suggested due date, counted back from the case's start date. */
  dueDaysBeforeStart?: number;
  for?: Target;
  sources: string[];
  conf: Confidence;
}

export type FactKind =
  | 'funds' | 'fee' | 'work' | 'post_study' | 'processing' | 'insurance' | 'salary' | 'duration' | 'note';

export interface Fact {
  key: string;
  kind: FactKind;
  label: string;
  value: string;
  /** For comparisons and totals. Converted at the rulebook's FX rates when the source is not in euros. */
  amountEur?: number;
  for?: Target;
  sources: string[];
  conf: Confidence;
}

export interface Guide {
  destination: Iso2;
  route: Route;
  /** full = checked document list and key figures; basic = official entry point and EU-wide baseline only. */
  level: 'full' | 'basic';
  title: string;
  summary: string;
  permit?: string;
  lastChecked: string; // YYYY-MM-DD
  links: { label: string; url: string }[];
  rules: Rule[];
  facts: Fact[];
}

export interface Source {
  kind: 'official' | 'secondary';
  publisher: string;
  /** Publication date as shown by the publisher ("2026, June 22"), or "n.d." */
  published: string;
  title: string;
  url: string;
}

export interface Change {
  id: string;
  effectiveOn: string; // YYYY-MM-DD
  destinations: Iso2[];
  routes?: Route[];
  /** Limit to some nationalities (explicit list or a flag). */
  for?: Pick<Target, 'in' | 'flag'>;
  summary: string;
  detail?: string;
  severity: 'info' | 'action';
  sources: string[];
  /** Rule keys (`<CC>.<route>.<key>`) this change touched. */
  rules?: string[];
}

export interface Nationality {
  code: Iso2;
  name: string;
  flags: Flag[];
  /** full = individually checked notes exist; basic = visa status only. */
  coverage: 'full' | 'basic';
}
