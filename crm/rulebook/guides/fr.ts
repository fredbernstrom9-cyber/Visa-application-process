import type { Guide } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

/**
 * Countries of residence covered by Campus France's "Études en France" procedure (75 countries and
 * territories, French list checked 6 October 2026 [fr-cf-eef-list]). It depends on where the student
 * lives, not on nationality. The English page lists 74 and omits Pakistan; the French list includes it.
 */
export const EEF_RESIDENCE = [
  'ZA', 'AO', 'AM', 'AZ', 'DZ', 'SA', 'AR', 'BH', 'BD', 'BJ', 'MM', 'BO', 'BR', 'BF', 'BI', 'KH', 'CM', 'CA', 'CL',
  'CN', 'CO', 'KM', 'CG', 'KR', 'CI', 'DJ', 'AE', 'EG', 'EC', 'US', 'ET', 'GA', 'GE', 'GH', 'GN', 'HT', 'HK', 'IN',
  'ID', 'IQ', 'IR', 'IL', 'JP', 'JO', 'KE', 'KW', 'LB', 'MG', 'MY', 'ML', 'MA', 'MU', 'MR', 'MX', 'NP', 'NG', 'PK',
  'PE', 'QA', 'CF', 'CD', 'DO', 'GB', 'RU', 'RW', 'SN', 'SG', 'TW', 'TD', 'TH', 'TG', 'TN', 'TR', 'UA', 'VN',
];

const EEF = { residenceIn: EEF_RESIDENCE };
const NOT_EEF = { residenceNotIn: EEF_RESIDENCE };

export const FR: Guide[] = [
  {
    destination: 'FR', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'France: long-stay student visa (VLS-TS)',
    summary: 'Get a long-stay student visa (VLS-TS) before travelling, then validate it online within 3 months of arrival. Students living in one of the 75 "Études en France" countries apply through Campus France first.',
    permit: 'VLS-TS "étudiant": a long-stay visa that works as a residence permit once validated',
    links: [
      { label: 'France-Visas: student visa', url: 'https://france-visas.gouv.fr/en/etudiant' },
      { label: 'Campus France: Études en France procedure', url: 'https://www.campusfrance.org/en/application-etudes-en-france-procedure' },
      { label: 'ANEF: validate or renew a permit', url: 'https://administration-etrangers-en-france.interieur.gouv.fr' },
      { label: 'CVEC payment', url: 'https://cvec.etudiant.gouv.fr/' },
    ],
    rules: [
      step('eef-apply', 'Apply through Études en France (Campus France)', ['fr-cf-eef-list', 'fr-cf-eef-proc'], 'official', {
        for: EEF, due: MONTHS(7),
        detail: 'The applicant lives in an "Études en France" country, so most programmes are applied to through the Campus France platform: pay the country fee, usually attend an interview, then complete the pre-consular step on the same platform once admitted.',
      }),
      step('direct-apply', 'Apply directly to the French institution', ['fr-cf-noneef', 'fr-cf-eef-list'], 'official', {
        for: NOT_EEF, due: MONTHS(7),
        detail: 'The country of residence is not on the Études en France list: apply directly to the institution (or via the preliminary admission request for a first-year bachelor\'s), then go straight to the visa.',
      }),
      step('visa', 'Apply for the long-stay student visa on France-Visas', ['fr-fv-student', 'fr-decree-2026-526'], 'official', {
        due: MONTHS(3),
        detail: 'Create the application on France-Visas and book the visa-centre appointment for fingerprints and photo. Apply at least 3 months before departure.',
      }),
      step('validate', 'Validate the VLS-TS online within 3 months of arrival', ['fr-sp-r52684', 'fr-cf-validate'], 'official', {
        detail: 'On the ANEF website, with the online tax (€150 for students since 1 May 2026). An unvalidated VLS-TS stops being valid as a residence permit.',
      }),
      step('cvec', 'Pay the CVEC and register with French social security', ['fr-cvec', 'fr-sp-f2231'], 'official', {
        detail: 'CVEC student life contribution: €105 for 2026/27, paid before enrolment.',
      }),
      doc('passport', 'Passport valid for the whole stay, plus copies', ['fr-fv-student'], 'official', { due: MONTHS(3) }),
      doc('admission', 'Admission letter from the French institution', ['fr-fv-student'], 'official', { due: MONTHS(3) }),
      doc('eef-confirmation', 'Études en France / Campus France confirmation', ['fr-cf-eef-proc'], 'official', { for: EEF, due: MONTHS(3) }),
      doc('funds', 'Proof of funds: €877.50 a month', ['fr-decree-2026-526', 'fr-cf-funds-2026'], 'official', {
        due: MONTHS(3), detail: 'Bank statements, scholarship certificate or sponsor letter. Threshold in force for applications from 1 August 2026 (was €615).',
      }),
      doc('accommodation', 'Proof of accommodation for the first months', ['fr-fv-student'], 'official', { due: MONTHS(3) }),
      doc('photos', 'Passport photos', ['fr-fv-student'], 'official', { due: MONTHS(3) }),
      doc('fv-receipt', 'France-Visas application receipt', ['fr-fv-student'], 'official', { due: MONTHS(3) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€877.50 a month (€10,530 a year), for applications from 1 August 2026', ['fr-decree-2026-526', 'fr-cf-funds-2026'], 'official', { eur: 877.5 }),
      fact('fee-visa', 'fee', 'Long-stay student visa', '€50', ['fr-fv-fees'], 'official', { eur: 50 }),
      fact('fee-validation', 'fee', 'VLS-TS validation (online, after arrival)', '€150 since 1 May 2026 (was €75)', ['fr-sp-r52684', 'fr-sp-a18881'], 'official', { eur: 150 }),
      fact('fee-eef', 'fee', 'Campus France / Études en France fee', 'Set per country by the local Campus France office', ['fr-cf-eef-proc'], 'official', { for: EEF }),
      fact('fee-cvec', 'fee', 'CVEC student life contribution (2026/27)', '€105', ['fr-cvec'], 'official', { eur: 105 }),
      fact('work', 'work', 'Work while studying', 'Up to 964 hours a year (60% of full-time), no separate permit', ['fr-sp-f2713'], 'official'),
      fact('post', 'post_study', 'After graduating', '12-month residence card to look for work or start a business (eligible diplomas such as a master\'s)', ['fr-sp-f17319'], 'official'),
      fact('processing', 'processing', 'Timing', 'Apply at least 3 months before departure; Études en France adds several weeks, so start 6–9 months ahead', ['fr-cf-eef-proc'], 'official'),
      fact('insurance', 'insurance', 'Health cover', 'Register with French social security after arrival (free basic cover for students)', ['fr-sp-f2231'], 'official'),
    ],
  },
];
