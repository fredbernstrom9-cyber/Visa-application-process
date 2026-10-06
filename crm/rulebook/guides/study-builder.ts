// Builder for national study guides that follow the EU students directive (2016/801):
// a common core (passport, admission, funds, insurance) plus each country's own steps, documents
// and figures. Keeps the 19 country files short and consistent.
import type { Confidence, Fact, Guide, Iso2, Rule } from '../types';
import { doc, MONTHS } from './helpers';

export interface StudySpec {
  cc: Iso2;
  name: string;
  permit: string;
  summary: string;
  links: { label: string; url: string }[];
  /** Main official source for the national procedure. */
  src: string;
  /** Funds wording for the document item, e.g. "€722.58 a month (under 24)". */
  funds: { label: string; sources: string[]; conf: Confidence; detail?: string };
  insurance?: { label: string; sources: string[]; conf: Confidence; detail?: string };
  /** Steps in order, before the shared documents. */
  steps: Rule[];
  /** Extra documents after the shared core. */
  docs?: Rule[];
  facts: Fact[];
  /** Months before the start date by which documents should be ready. */
  docsDueMonths?: number;
}

export function studyGuide(s: StudySpec): Guide {
  const due = MONTHS(s.docsDueMonths ?? 3);
  return {
    destination: s.cc, route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: `${s.name}: ${s.permit}`,
    summary: s.summary,
    permit: s.permit,
    links: s.links,
    rules: [
      ...s.steps,
      doc('passport', 'Valid passport, plus copies', [s.src, 'dir-2016-801'], 'official', { due }),
      doc('admission', 'Admission letter from a recognised higher-education institution', [s.src, 'dir-2016-801'], 'official', { due }),
      doc('funds', s.funds.label, s.funds.sources, s.funds.conf, { due, detail: s.funds.detail }),
      doc('insurance', s.insurance?.label ?? 'Health insurance for the whole stay', s.insurance?.sources ?? [s.src, 'dir-2016-801'], s.insurance?.conf ?? 'official', { due, detail: s.insurance?.detail }),
      ...(s.docs ?? []),
    ],
    facts: s.facts,
  };
}
