import type { Guide } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

export const IT: Guide[] = [
  {
    destination: 'IT', route: 'study', level: 'full', lastChecked: '2026-10-06',
    title: 'Italy: type D study visa, then a permesso di soggiorno',
    summary: 'Pre-enrol on Universitaly, get a type D study visa (deadline 30 November 2026 for the 2026/27 intake), then request the residence permit within 8 working days of arrival.',
    permit: 'Study visa (type D), then a permesso di soggiorno per studio',
    links: [
      { label: 'Universitaly: international students', url: 'https://www.universitaly.it/it/studenti-stranieri' },
      { label: 'Visa for Italy (Foreign Ministry tool)', url: 'https://vistoperitalia.esteri.it/' },
      { label: 'Ministry of the Interior: visa and residence permit', url: 'https://www.interno.gov.it/it/temi/immigrazione-e-asilo/modalita-dingresso/visto-e-permesso-soggiorno' },
    ],
    rules: [
      step('universitaly', 'Pre-enrol on Universitaly', ['it-universitaly', 'it-cons-ba-2026'], 'official', {
        due: MONTHS(6), detail: 'Pre-enrolment for visa purposes goes only through Universitaly; the university checks it and forwards it to the consulate.',
      }),
      step('visa', 'Apply for the type D study visa', ['it-cons-ba-2026', 'it-visto'], 'official', {
        due: MONTHS(2), detail: 'At the Italian embassy, consulate or visa centre. For 2026/27 bachelor\'s and master\'s programmes the deadline is 30 November 2026.',
      }),
      step('permesso', 'Request the residence permit within 8 working days of arrival', ['it-interno-visa', 'it-portale-costs'], 'official', {
        detail: 'Send the kit from a post office, then attend the Questura appointment for fingerprints.',
      }),
      step('health', 'Arrange health cover', ['it-ssn-700'], 'official', { detail: 'Private insurance, or voluntary registration with the national health service (€700 a year).' }),
      doc('passport', 'Passport, plus copies', ['it-cons-ba-2026'], 'official', { due: MONTHS(2) }),
      doc('universitaly-summary', 'Universitaly pre-enrolment summary', ['it-universitaly'], 'official', { due: MONTHS(2) }),
      doc('funds', 'Proof of funds: €10,179.85 for the academic year (lawful, traceable)', ['it-cons-ba-2026', 'it-tunis-2026'], 'official', { due: MONTHS(2), detail: 'Plus return travel and any unpaid tuition.' }),
      doc('accommodation', 'Proof of accommodation', ['it-cons-ba-2026'], 'official', { due: MONTHS(2) }),
      doc('insurance', 'Health insurance', ['it-cons-ba-2026'], 'official', { due: MONTHS(2) }),
      doc('form', 'National (D) visa application form and photo', ['it-cons-ba-2026'], 'official', { due: MONTHS(2) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€10,179.85 per academic year (≈ €848 a month) for 2026/27 and 2027/28; was €6,947.33', ['it-cons-ba-2026', 'it-tunis-2026'], 'official', { eur: 848.32 }),
      fact('fee-visa', 'fee', 'Study visa', '€50', ['it-hanoi-visa', 'it-brasilia-visa'], 'official', { eur: 50 }),
      fact('fee-permit', 'fee', 'Residence permit', '€100.46 (card €30.46 + €40 contribution + €30 postal fee) plus a revenue stamp', ['it-polizia-costs', 'it-portale-costs'], 'official', { eur: 100.46 }),
      fact('deadline', 'processing', 'Visa deadline', '30 November 2026 for 2026/27 bachelor\'s and master\'s programmes', ['it-cons-ba-2026'], 'official'),
      fact('work', 'work', 'Work while studying', 'Up to 20 hours a week, capped at 1,040 hours a year', ['it-work'], 'official'),
      fact('post', 'post_study', 'After graduating', 'Convert to a job-search permit of 9–12 months', ['it-study-norm', 'it-prefettura-conv'], 'official'),
      fact('insurance', 'insurance', 'Health cover', 'Private insurance, or the national health service for €700 a year', ['it-ssn-700', 'it-salute'], 'official'),
    ],
  },
];
