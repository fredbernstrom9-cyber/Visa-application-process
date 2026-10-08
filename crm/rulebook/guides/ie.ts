import type { Guide } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

const NOT_CTA = { notFlag: 'cta' as const };

export const IE: Guide[] = [
  {
    destination: 'IE', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Ireland: study visa (if visa-required), Stamp 2 and IRP card',
    summary: 'Visa-required nationals apply online (AVATS) for a long-term (D) study visa; others show their documents at the border. All then register for an IRP card. British citizens need nothing under the Common Travel Area. Ireland is not in Schengen.',
    permit: 'Study visa (for visa-required nationals), then Stamp 2 permission and an IRP card',
    links: [
      { label: 'Irish Immigration: long-term study visa', url: 'https://www.irishimmigration.ie/coming-to-study-in-ireland/what-are-my-study-visa-options/how-to-apply-for-long-term-study-visa/' },
      { label: 'Irish Immigration: visa offices', url: 'https://www.irishimmigration.ie/visa-offices/' },
      { label: 'Third Level Graduate Programme (Stamp 1G)', url: 'https://www.irishimmigration.ie/my-situation-has-changed-since-i-arrived-in-ireland/third-level-graduate-programme/' },
    ],
    rules: [
      step('eligible-course', 'Get accepted on an eligible course (ILEP or TrustEd Ireland provider)', ['ie-ilep', 'ie-trusted'], 'official', {
        for: NOT_CTA, due: MONTHS(7), detail: 'Full-time only. Since February 2026 providers need TrustEd Ireland authorisation to recruit non-EEA students.',
      }),
      step('fees-insurance', 'Pay the required fees and buy private medical insurance', ['ie-insurance'], 'official', { for: NOT_CTA, due: MONTHS(3.5) }),
      step('visa', 'Apply online (AVATS) for a long-term (D) study visa', ['ie-longterm-visa', 'ie-visa-offices'], 'official', {
        for: { flag: 'ireland_visa' }, due: MONTHS(3), detail: 'Send the documents to the visa office that handles the applicant\'s country and show immediate access to €10,000.',
      }),
      step('border', 'Show the study documents at immigration control', ['ie-visa-list', 'ie-finances'], 'official', {
        for: { notFlag: 'ireland_visa', notIn: ['GB'] }, detail: 'Acceptance letter, fee receipt, proof of €10,000 and insurance.',
      }),
      step('irp', 'Register for the IRP card within 90 days', ['ie-register', 'ie-bq'], 'official', { for: NOT_CTA, detail: 'First-time registrations take place at Burgh Quay, Dublin. €300.' }),
      step('cta', 'No visa or permit needed (Common Travel Area)', ['ie-cta', 'uk-cta'], 'official', { for: { flag: 'cta' } }),
      doc('passport', 'Passport, plus copies', ['ie-longterm-visa'], 'official', { due: MONTHS(3) }),
      doc('acceptance', 'Acceptance letter for an eligible course', ['ie-longterm-visa', 'ie-ilep'], 'official', { for: NOT_CTA, due: MONTHS(3) }),
      doc('fee-receipt', 'Tuition fee receipt', ['ie-longterm-visa'], 'official', { for: NOT_CTA, due: MONTHS(3) }),
      doc('funds', 'Proof of immediate access to €10,000', ['ie-finances', 'ie-finance-2025'], 'official', { for: NOT_CTA, due: MONTHS(3) }),
      doc('insurance', 'Private medical insurance', ['ie-insurance'], 'official', { for: NOT_CTA, due: MONTHS(3) }),
      doc('avats', 'AVATS application summary and photos', ['ie-longterm-visa'], 'official', { for: { flag: 'ireland_visa' }, due: MONTHS(3) }),
      doc('admission-cta', 'Admission letter', ['ie-cta'], 'official', { for: { flag: 'cta' } }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'Immediate access to €10,000 for one academic year; degree students may use an education bond instead (pilot)', ['ie-finances', 'ie-finance-2025'], 'official', { eur: 833.33, for: NOT_CTA }),
      fact('fee-visa', 'fee', 'Visa (single entry)', '€60', ['ie-fees'], 'official', { eur: 60, for: { flag: 'ireland_visa' } }),
      fact('fee-irp', 'fee', 'IRP registration', '€300', ['ie-register'], 'official', { eur: 300, for: NOT_CTA }),
      fact('work', 'work', 'Work while studying', '20 hours a week in term; 40 in June–September and 15 December–15 January', ['ie-student-perm'], 'official', { for: NOT_CTA }),
      fact('post', 'post_study', 'After graduating', 'Stamp 1G: 12 months after a level 8 degree, up to 24 months after level 9+', ['ie-1g'], 'official', { for: NOT_CTA }),
      fact('schengen', 'note', 'Not in Schengen', 'A Schengen visa does not cover Ireland, and Irish permission does not cover Schengen countries', ['ie-visa-list'], 'official'),
      fact('visa-2026', 'note', 'New visa requirement', 'Nicaragua, Saint Kitts and Nevis and Saint Lucia need an Irish visa from 15 June 2026', ['ie-si-2026-242'], 'official', { for: { in: ['NI', 'KN', 'LC'] } }),
    ],
  },
];
