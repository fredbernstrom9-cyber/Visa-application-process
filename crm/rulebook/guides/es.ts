import type { Guide } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

export const ES: Guide[] = [
  {
    destination: 'ES', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Spain: student visa (stay authorisation for studies), then a TIE card',
    summary: 'Apply for a student visa at the Spanish consulate for the place of residence, then apply for a TIE card within a month of arrival for stays over 180 days. Nationals who do not need a Schengen visa may instead enter and apply in Spain within 60 days, according to Spanish consulates.',
    permit: 'Student visa (stay authorisation for studies), then a TIE card for stays over 180 days',
    links: [
      { label: 'Ministry of Inclusion: sheet 1 (stay for studies)', url: 'https://www.inclusion.gob.es/en/web/migraciones/w/estancia-por-estudios' },
      { label: 'Spanish embassies and consulates', url: 'https://www.exteriores.gob.es/en/EmbajadasConsulados/Paginas/index.aspx' },
    ],
    rules: [
      step('admission', 'Get the admission letter and pay enrolment fees', ['es-sheet1'], 'official', { due: MONTHS(5), detail: 'Full-time programme leading to a qualification.' }),
      step('criminal-record', 'Get criminal record certificates (stays over 180 days)', ['es-consulate-req'], 'official', {
        due: MONTHS(3.5), detail: 'Applicants over 16: from every country lived in during the last 5 years, legalised or apostilled, with translations.',
      }),
      step('visa', 'Apply for the student visa at the consulate', ['es-sheet1', 'es-ankara'], 'official', {
        due: MONTHS(2), detail: 'At least 2 months before the course starts. Once the authorisation is approved the consulate has up to a month to issue the visa.',
      }),
      step('apply-in-spain', 'Alternative: enter visa-free and apply in Spain within 60 days', ['es-santiago'], 'check', {
        for: { notFlag: 'schengen_visa' }, optional: true,
        detail: 'Reported by Spain\'s consulate in Santiago de Chile for nationals who do not need a Schengen visa. Confirm with the consulate before relying on it.',
      }),
      step('tie', 'Apply for the TIE card within 1 month of arrival', ['es-consulate-req'], 'official', { detail: 'At the police station in the province where the authorisation was processed.' }),
      doc('passport', 'Passport valid for the stay (consulates often ask for at least 1 year)', ['es-sheet1'], 'official', { due: MONTHS(2) }),
      doc('form', 'National visa application form and photo', ['es-consulate-req'], 'official', { due: MONTHS(2) }),
      doc('admission-letter', 'Admission letter and proof that fees are paid', ['es-sheet1'], 'official', { due: MONTHS(2) }),
      doc('funds', 'Proof of funds: €600 a month', ['es-sheet1', 'es-iprem-2026'], 'official', { due: MONTHS(2), detail: '100% of the 2026 IPREM, unless accommodation for the whole stay is paid.' }),
      doc('insurance', 'Health insurance from an insurer authorised in Spain', ['es-consulate-req'], 'official', { due: MONTHS(2) }),
      doc('criminal-record-cert', 'Criminal record certificate, apostilled and translated (stays > 180 days)', ['es-consulate-req'], 'official', { due: MONTHS(2) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€600 a month (100% of the 2026 IPREM)', ['es-sheet1', 'es-iprem-2026'], 'official', { eur: 600 }),
      fact('fee-visa', 'fee', 'Student visa', 'Set per nationality: see the consulate\'s fee list', ['es-chile-fees'], 'official'),
      fact('fee-tie', 'fee', 'TIE card', 'Paid with form 790-012', ['es-guide'], 'check'),
      fact('work', 'work', 'Work while studying', 'Up to 30 hours a week, included in the student authorisation', ['es-sheet4bis', 'es-rd'], 'official'),
      fact('post', 'post_study', 'After graduating', 'Residence permit to look for work or start a business (information sheet 20); length not confirmed on official pages', ['es-sheet20'], 'check'),
      fact('processing', 'processing', 'Timing', 'Apply at least 2 months before the course; the consulate has up to a month to issue the visa after approval', ['es-ankara'], 'official'),
    ],
  },
];
