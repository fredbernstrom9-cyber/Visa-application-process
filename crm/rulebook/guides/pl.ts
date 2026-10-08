import type { Guide } from '../types';
import { doc, eur, fact, MONTHS, step } from './helpers';

export const PL: Guide[] = [
  {
    destination: 'PL', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Poland: national (D) study visa, then a temporary residence permit',
    summary: 'Get a national (D) study visa via e-Konsulat before travelling, then apply online (MOS) for a temporary residence permit before the visa expires. Since August 2025 universities must check B2 in the language of instruction.',
    permit: 'National (D) visa for study, then a temporary residence permit (karta pobytu)',
    links: [
      { label: 'Study in Poland: visa', url: 'https://study.gov.pl/visa-application' },
      { label: 'MOS: residence permit for studies', url: 'https://mos.cudzoziemcy.gov.pl/en/informacje/na-studia_EN' },
      { label: 'e-Konsulat', url: 'https://secure.e-konsulat.gov.pl' },
    ],
    rules: [
      step('admission', 'Get admitted to an accredited full-time programme (B2 language proof)', ['pl-b2', 'pl-notes'], 'official', {
        due: MONTHS(7), detail: 'Since 1 August 2025 universities must verify at least B2 in the language of instruction with a recognised certificate.',
      }),
      step('visa', 'Register in e-Konsulat and apply for the national (D) study visa', ['pl-study-gov', 'pl-visa-fee-2026'], 'official', { due: MONTHS(3.5), detail: 'Fee €200 since 1 January 2026.' }),
      step('mos', 'Apply online (MOS) for the temporary residence permit before the visa expires', ['pl-mos-studies', 'pl-mos-only'], 'official', {
        detail: 'Paper applications are no longer accepted; fingerprints at the voivodeship office.',
      }),
      doc('passport', 'Passport, plus copies', ['pl-study-gov'], 'official', { due: MONTHS(3.5) }),
      doc('admission-letter', 'Admission letter for an accredited full-time programme', ['pl-study-gov'], 'official', { due: MONTHS(3.5) }),
      doc('language', 'Language certificate, B2 or higher', ['pl-b2'], 'official', { due: MONTHS(3.5) }),
      doc('funds', 'Proof of funds: PLN 1,010 a month plus return travel', ['pl-funds', 'pl-uw-funds'], 'official', { due: MONTHS(3.5) }),
      doc('insurance', 'Health insurance', ['pl-study-gov'], 'official', { due: MONTHS(3.5) }),
      doc('accommodation', 'Proof of accommodation', ['pl-study-gov'], 'official', { due: MONTHS(3.5) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'PLN 1,010 a month (≈ €238), plus return travel, tuition and housing', ['pl-funds', 'pl-uw-funds'], 'official', { eur: eur(1010, 'PLN') }),
      fact('fee-visa', 'fee', 'National (D) visa', '€200 from 1 January 2026 (was €135)', ['pl-visa-fee-2026', 'pl-visa-fee-2024'], 'official', { eur: 200 }),
      fact('fee-permit', 'fee', 'Temporary residence permit + card', 'PLN 340 + PLN 100', ['pl-udsc-fees'], 'official', { eur: eur(440, 'PLN') }),
      fact('work', 'work', 'Work while studying', 'Full-time students may work without a work permit', ['pl-work'], 'official'),
      fact('post', 'post_study', 'After graduating', 'One-time 9-month permit to look for work or start a business', ['pl-graduate'], 'official'),
      fact('processing', 'processing', 'Timing', 'Consulates decide within 15 calendar days of the fee payment, extendable to 30', ['pl-iran-visa'], 'official'),
    ],
  },
];
