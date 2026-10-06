import type { Guide } from '../types';
import { doc, eur, fact, MONTHS, step } from './helpers';

export const SE: Guide[] = [
  {
    destination: 'SE', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Sweden: residence permit for studies',
    summary: 'Apply online for a residence permit for studies after paying the first tuition instalment, and get it before travelling. New rules for permits decided from 11 June 2026: 15-hour weekly work cap in term, minimum study results and address reporting.',
    permit: 'Residence permit for studies, granted before travel',
    links: [
      { label: 'Migration Agency: higher education', url: 'https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html' },
      { label: 'University Admissions: key dates', url: 'https://www.universityadmissions.se/en/key-dates-and-deadlines/' },
    ],
    rules: [
      step('ua', 'Apply on University Admissions (SEK 900 fee)', ['se-ua-fee', 'se-ua-dates'], 'official', { due: MONTHS(8), detail: 'First round for autumn closes in mid-January.' }),
      step('tuition', 'Pay the first tuition instalment', ['se-mv-apply'], 'official', { due: MONTHS(4) }),
      step('permit', 'Apply online for the residence permit (SEK 1,500)', ['se-mv-apply', 'se-mdu'], 'official', { due: MONTHS(4), detail: 'Right after paying; show SEK 10,656 a month.' }),
      step('address', 'Report the address to the Migration Agency within 30 days of arrival', ['se-mv-rules'], 'official', { detail: 'New since 11 June 2026; also whenever the student moves.' }),
      step('results', 'Meet the study-results rule each year', ['se-mv-rules', 'se-sis-rules'], 'official', { detail: '37.5 credits in year 1, 45 credits a year after that (permits decided from 11 June 2026).' }),
      doc('passport', 'Passport, plus copies', ['se-mv-apply'], 'official', { due: MONTHS(4) }),
      doc('selection', 'Notification of selection (admission)', ['se-mv-apply'], 'official', { due: MONTHS(4) }),
      doc('tuition-receipt', 'Receipt for the first tuition instalment', ['se-mv-apply'], 'official', { due: MONTHS(4) }),
      doc('funds', 'Proof of funds: SEK 10,656 a month', ['se-mdu', 'se-kau', 'se-mv-apply'], 'multi', { due: MONTHS(4) }),
      doc('insurance', 'Comprehensive health insurance (if the permit is shorter than 12 months)', ['se-mv-apply'], 'official', { due: MONTHS(4) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'SEK 10,656 a month (≈ €969) for 10 months of each study year (2026)', ['se-mdu', 'se-kau', 'se-mv-apply'], 'multi', { eur: eur(10656, 'SEK') }),
      fact('fee-ua', 'fee', 'University Admissions application', 'SEK 900', ['se-ua-fee'], 'official', { eur: eur(900, 'SEK') }),
      fact('fee-permit', 'fee', 'Residence permit', 'SEK 1,500', ['se-mv-apply'], 'official', { eur: eur(1500, 'SEK') }),
      fact('work', 'work', 'Work while studying', 'Permits decided from 11 June 2026: at most 15 hours a week in term, no limit in June–August', ['se-mv-rules', 'se-sis-rules'], 'official'),
      fact('post', 'post_study', 'After graduating', 'Up to 12 months to look for work', ['se-mv-jobseek'], 'official'),
    ],
  },
];
