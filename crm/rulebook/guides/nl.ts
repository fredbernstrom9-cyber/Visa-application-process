import type { Guide } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

export const NL: Guide[] = [
  {
    destination: 'NL', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Netherlands: residence permit for study (applied for by the university)',
    summary: 'The university (a recognised sponsor) applies to the IND on the student\'s behalf. Nationalities that need an MVV collect it at a Dutch embassy after approval; MVV-exempt nationalities collect the residence card after arrival.',
    permit: 'Residence permit for study; the university applies to the IND',
    links: [
      { label: 'IND: student residence permit', url: 'https://ind.nl/en/residence-permits/study/student-residence-permit-for-university-or-higher-professional-education' },
      { label: 'IND: MVV exemptions', url: 'https://ind.nl/en/mvv-exemptions' },
      { label: 'IND: income requirements for study', url: 'https://ind.nl/en/income-requirements-study' },
      { label: 'NetherlandsWorldwide: MVV sticker', url: 'https://www.netherlandsworldwide.nl/visa-the-netherlands/mvv-long-stay' },
    ],
    rules: [
      step('sponsor', 'Confirm the institution is a recognised sponsor', ['nl-ind-student'], 'official', { due: MONTHS(7), detail: 'Only institutions on the IND public register can bring non-EU students.' }),
      step('ind-application', 'Let the university apply to the IND', ['nl-ind-student', 'nl-ind-income'], 'official', {
        due: MONTHS(3.5), detail: 'The student pays the fee to the university and proves €1,130.77 a month (or deposits it with the university).',
      }),
      step('mvv', 'Collect the MVV entry visa within 3 months of approval', ['nl-nw-mvv'], 'official', {
        for: { notFlag: 'mvv_exempt' }, due: MONTHS(1), detail: 'Book an appointment at the embassy or consulate named in the IND letter; collection can take up to 10 working days.',
      }),
      step('residence-card', 'Register with the municipality and collect the residence card', ['nl-ind-student'], 'official', {
        detail: 'After arrival. Keep up study progress: universities report students who fall behind.',
      }),
      doc('passport', 'Passport, plus copies', ['nl-ind-student'], 'official', { due: MONTHS(3.5) }),
      doc('admission', 'Admission from a recognised-sponsor institution', ['nl-ind-student'], 'official', { due: MONTHS(3.5) }),
      doc('funds', 'Proof of funds: €1,130.77 a month (or deposit with the university)', ['nl-ind-amounts-2026', 'nl-ind-income'], 'official', { due: MONTHS(3.5) }),
      doc('antecedents', 'Signed antecedents certificate (IND form)', ['nl-ind-student'], 'official', { due: MONTHS(3.5) }),
      doc('insurance', 'Health insurance', ['nl-ind-student'], 'official', { due: MONTHS(1) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€1,130.77 a month (1 January – 31 December 2026, university and HBO)', ['nl-ind-amounts-2026', 'nl-ind-income'], 'official', { eur: 1130.77 }),
      fact('fee', 'fee', 'IND application fee (study)', '€254 in 2026 (was €243)', ['nl-rug-fee', 'nl-ind-fees'], 'official', { eur: 254 }),
      fact('work', 'work', 'Work while studying', '16 hours a week in term or full-time in June–August; the employer needs a work permit (TWV)', ['nl-ind-intl-students', 'nl-business-twv'], 'official'),
      fact('post', 'post_study', 'After graduating', 'Orientation year: up to 12 months to look for work, no work permit needed', ['nl-ind-orientation'], 'official'),
      fact('processing', 'processing', 'Timing', '3 months to collect the MVV after approval; collection takes up to 10 working days', ['nl-nw-mvv'], 'official', { for: { notFlag: 'mvv_exempt' } }),
    ],
  },
];
