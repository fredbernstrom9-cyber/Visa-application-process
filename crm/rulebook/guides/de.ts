import type { Guide } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

const VISA_FIRST = { notIn: ['AU', 'IL', 'JP', 'CA', 'KR', 'NZ', 'GB', 'US', 'AD', 'BR', 'SV', 'HN', 'MC', 'SM'] };
const MAY_APPLY_IN_DE = { in: ['AU', 'IL', 'JP', 'CA', 'KR', 'NZ', 'GB', 'US', 'AD', 'BR', 'SV', 'HN', 'MC', 'SM'] };

export const DE: Guide[] = [
  {
    destination: 'DE', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Germany: national (D) visa for study, then a residence permit',
    summary: 'Most students get a national (D) study visa before travelling and then a residence permit from the local foreigners office. Nationals of the §41 AufenthV states (Australia, Israel, Japan, Canada, South Korea, New Zealand, UK, US; and for study also Andorra, Brazil, El Salvador, Honduras, Monaco, San Marino) may enter visa-free and apply in Germany within 90 days.',
    permit: 'National (D) visa for study, then a residence permit under §16b Residence Act',
    links: [
      { label: 'Consular Services Portal: visa for study', url: 'https://digital.diplo.de/studium' },
      { label: 'Visa Navigator (Federal Foreign Office)', url: 'https://digital.diplo.de/navigator/en/visa' },
      { label: 'Federal Foreign Office: blocked account', url: 'https://www.auswaertiges-amt.de/en/sperrkonto-388600' },
      { label: 'Make it in Germany: students', url: 'https://www.make-it-in-germany.com/en/looking-for-foreign-professionals/entering/admission-labour-market/students' },
    ],
    rules: [
      step('aps', 'Get the APS certificate (Academic Evaluation Centre)', ['de-aps-uniassist', 'de-aps-india', 'de-aps-china', 'de-aps-vietnam'], 'official', {
        for: { flag: 'aps' }, due: MONTHS(10),
        detail: 'Required before university admission and the visa for applicants whose school or university records come from China, India or Vietnam. Do this first: it can take weeks.',
      }),
      step('admission', 'Get admitted (directly or through uni-assist)', ['de-csp-study'], 'official', { due: MONTHS(6), detail: 'Keep the admission letter (Zulassungsbescheid).' }),
      step('blocked-account', 'Open a blocked account and deposit €11,904', ['de-ffo-sperrkonto', 'de-daad-costs'], 'official', {
        due: MONTHS(3.5),
        detail: 'With an approved provider; €992 a month can then be withdrawn in Germany. A recognised scholarship or a formal obligation letter (Verpflichtungserklärung) can replace it.',
      }),
      step('visa', 'Apply for the national (D) study visa on the Consular Services Portal', ['de-csp-study', 'de-ffo-visa'], 'official', {
        for: VISA_FIRST, due: MONTHS(3.5), detail: 'Then attend the appointment at the German mission or its visa centre. Fee €75.',
      }),
      step('visa-or-in-germany', 'Choose: visa first, or enter visa-free and apply in Germany', ['de-aufenthv-41', 'de-uk-41', 'de-bamf-entry'], 'official', {
        for: MAY_APPLY_IN_DE, due: MONTHS(2),
        detail: 'Under §41 AufenthV this nationality may enter visa-free and apply for the student residence permit at the local foreigners office within 90 days. No work until a permit allowing it is issued.',
      }),
      step('register', 'Register the address, then apply for the residence permit', ['de-berlin-permit'], 'official', {
        detail: 'After arrival: register at the citizens\' office, then apply at the foreigners office with enrolment certificate, insurance and funds proof. Fee €100.',
      }),
      doc('passport', 'Passport, plus copies', ['de-csp-study'], 'official', { due: MONTHS(3.5) }),
      doc('admission-letter', 'Admission letter (Zulassungsbescheid)', ['de-csp-study'], 'official', { due: MONTHS(3.5) }),
      doc('aps-certificate', 'APS certificate', ['de-aps-uniassist'], 'official', { for: { flag: 'aps' }, due: MONTHS(3.5) }),
      doc('funds', 'Blocked account confirmation (€11,904) or scholarship / obligation letter', ['de-ffo-sperrkonto'], 'official', {
        due: MONTHS(3.5), detail: 'Only the provider\'s official opening confirmation is accepted.',
      }),
      doc('insurance', 'Health insurance confirmation', ['de-ffo-visa'], 'official', { due: MONTHS(3.5), detail: 'Incoming/travel cover until enrolment, then statutory or approved private student insurance.' }),
      doc('certificates', 'Certificates, transcripts and language certificate', ['de-csp-study'], 'official', { due: MONTHS(3.5) }),
      doc('csp-form', 'Visa application from the Consular Services Portal', ['de-csp-study'], 'official', { for: VISA_FIRST, due: MONTHS(3.5) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€992 a month (€11,904 a year), usually in a blocked account; unchanged for winter semester 2026/27', ['de-ffo-sperrkonto', 'de-daad-costs', 'de-sanjose-2025'], 'multi', { eur: 992 }),
      fact('funds-outlook', 'note', 'Expected change', 'A BAföG reform approved by the cabinet in August 2026 would raise student support rates from summer semester 2027, which usually raises the blocked-account amount. Not law yet.', ['de-bafoeg-2026'], 'check'),
      fact('fee-visa', 'fee', 'National (D) visa', '€75', ['de-ffo-visa', 'de-sanjose-2025'], 'multi', { eur: 75, for: VISA_FIRST }),
      fact('fee-permit', 'fee', 'Residence permit (foreigners office)', '€100', ['de-berlin-permit'], 'official', { eur: 100 }),
      fact('work', 'work', 'Work while studying', '140 full or 280 half days a year without approval (or 20 hours a week in term, unlimited in breaks)', ['de-mig-students'], 'official'),
      fact('post', 'post_study', 'After graduating', 'Up to 18 months to look for a job; any job allowed meanwhile', ['de-mig-after'], 'official'),
      fact('processing', 'processing', 'Timing', 'Several weeks after the appointment; appointment waits can be far longer in high-demand countries', ['de-ffo-visa'], 'official'),
    ],
  },
];
