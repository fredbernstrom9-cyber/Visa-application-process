// Study guides for the 19 EU states that were "basic" in the ClearEntry checker.
// Figures were checked on 6 October 2026. Where only one secondary source or an older official
// document supports a figure, it is marked "check" so advisors confirm it with the consulate.
import type { Guide } from '../types';
import { doc, eur, fact, MONTHS, step } from './helpers';
import { studyGuide } from './study-builder';

const VISA_FREE = { notFlag: 'schengen_visa' as const };

export const EU_STUDY: Guide[] = [
  studyGuide({
    cc: 'AT', name: 'Austria', permit: 'residence permit "Student" (Aufenthaltsbewilligung Student)', src: 'at-oead-student',
    summary: 'Apply at the Austrian embassy or consulate in the country of residence before entry; after approval collect a D visa (valid 4 months) to travel and pick up the permit. Visa-free nationals may instead apply in Austria after arriving.',
    links: [
      { label: 'OeAD: residence permit Student', url: 'https://oead.at/en/to-austria/entry-and-residence/residence-permit-student-no-mobility-programme' },
      { label: 'Migration portal: study in Austria', url: 'https://www.migration.gv.at/en/living-and-working-in-austria/study-in-austria/' },
    ],
    funds: { label: 'Proof of funds for 12 months: €722.58 a month (under 24) or €1,308.39 (24 and over)', sources: ['at-oead-student'], conf: 'official', detail: '2026 amounts, proven twelve months in advance.' },
    steps: [
      step('apply-abroad', 'Apply at the Austrian embassy or consulate in the country of residence', ['at-oead-student'], 'official', { due: MONTHS(4), detail: 'Decision within 90 days of a complete application (another 90 if documents are requested). Fee €218.' }),
      step('apply-in-austria', 'Alternative: apply at the residence authority in Austria after visa-free entry', ['at-oead-student'], 'official', { for: VISA_FREE, optional: true }),
      step('d-visa', 'Collect the D visa (valid 4 months) and the permit in Austria', ['at-oead-student'], 'official', { for: { flag: 'schengen_visa' } }),
    ],
    docs: [
      doc('photo', 'Photo (ICAO criteria, under 6 months old)', ['at-oead-student'], 'official', { due: MONTHS(4) }),
      doc('accommodation', 'Accommodation confirmation (at least 3 months)', ['at-oead-student'], 'official', { due: MONTHS(4) }),
      doc('police', 'Police clearance certificate, legalised and translated', ['at-oead-student'], 'official', { due: MONTHS(4) }),
    ],
    docsDueMonths: 4,
    facts: [
      fact('funds', 'funds', 'Funds required (2026)', '€722.58 a month under 24; €1,308.39 a month from 24; 12 months in advance', ['at-oead-student', 'emn-funds-2025'], 'multi', { eur: 722.58 }),
      fact('fee', 'fee', 'Application fee', '€218 (non-refundable)', ['at-oead-student'], 'official', { eur: 218 }),
      fact('tuition', 'fee', 'Tuition at public universities', '€726.72 a semester for third-country students', ['b-aut'], 'official', { eur: 726.72 }),
      fact('work', 'work', 'Work while studying', 'Up to 20 hours a week without a labour market test (employment permit needed)', ['at-oead-student', 'b-aut'], 'multi'),
      fact('post', 'post_study', 'After graduating', 'One renewal for 12 months to look for work or start a business', ['at-oead-student', 'b-aut'], 'multi'),
      fact('processing', 'processing', 'Decision time', '90 days from a complete application', ['at-oead-student'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'BE', name: 'Belgium', permit: 'long-stay (D) student visa, then a residence card (A card)', src: 'be-checklist-2026',
    summary: 'Apply for a long-stay student visa at the Belgian embassy, with a medical certificate from an accredited doctor and a criminal record certificate. The minimum funds rose to €1,062 a month for 2026–27.',
    links: [
      { label: 'Immigration Office (IBZ)', url: 'https://dofi.ibz.be/en' },
      { label: 'Belgian embassy checklist (example: Beirut, April 2026)', url: 'https://lebanon.diplomatie.belgium.be/sites/default/files/2026-04/Checklist%20-%20Long%20stay%20Academic%20Visa%2008.04.2026_3.pdf' },
    ],
    funds: { label: 'Proof of funds: €1,062 a month (2026–27)', sources: ['be-checklist-2026', 'be-belga-2026'], conf: 'multi', detail: 'Blocked account, scholarship or a sponsor\'s Annex 32 commitment. Private institutions: deposit of €12,744.' },
    insurance: { label: 'Health insurance (at least €30,000 cover for the first 3 months)', sources: ['be-checklist-2026'], conf: 'official' },
    steps: [
      step('get-admitted', 'Get the standard admission certificate from the institution', ['be-checklist-2026'], 'official', { due: MONTHS(5) }),
      step('medical', 'Get the medical certificate from an embassy-accredited doctor', ['be-checklist-2026'], 'official', { due: MONTHS(3), detail: 'Issued within 6 months, with all tests and X-rays.' }),
      step('fee', 'Pay the Immigration Office administrative fee (redevance)', ['be-redevance-2026', 'be-checklist-2026'], 'check', { due: MONTHS(3) }),
      step('visa', 'Apply for the long-stay student visa', ['be-checklist-2026'], 'official', { due: MONTHS(3) }),
    ],
    docs: [
      doc('form', 'Signed application form and photo (3.5 × 4.5 cm)', ['be-checklist-2026'], 'official'),
      doc('medical-cert', 'Medical certificate from an accredited doctor', ['be-checklist-2026'], 'official'),
      doc('criminal', 'Criminal record certificate (18+), issued within 6 months', ['be-checklist-2026'], 'official'),
      doc('fee-proof', 'Proof of payment of the administrative fee', ['be-checklist-2026'], 'official'),
      doc('private-extra', 'Private institutions: diploma with 13/20 average, transcript, B2 language certificate and study plan', ['be-checklist-2026'], 'official', { optional: true }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€1,062 a month for 2026–27 (was €835)', ['be-checklist-2026', 'be-belga-2026'], 'multi', { eur: 1062 }),
      fact('fee-redevance', 'fee', 'Immigration Office fee (students)', '€251 from January 2026 (public-school students without a scholarship)', ['be-redevance-2026'], 'check', { eur: 251 }),
      fact('change', 'note', 'Recent change', 'The minimum funds rose 27% for 2026–27; older guides still quote €835', ['be-belga-2026'], 'check'),
    ],
  }),

  studyGuide({
    cc: 'BG', name: 'Bulgaria', permit: 'long-stay (D) visa for study, then a residence permit', src: 'b-bgr',
    summary: 'Get the admission letter (confirmed by the Ministry of Education for non-EU students), apply for a type D visa, then a residence permit from the Migration Directorate. Bulgaria has used the euro since 1 January 2026.',
    links: [{ label: 'Ministry of Foreign Affairs: studying in Bulgaria', url: 'https://www.mfa.bg/en/155' }],
    funds: { label: 'Proof of funds: at least the Bulgarian minimum monthly salary for each month', sources: ['emn-funds-2025'], conf: 'official' },
    steps: [
      step('get-admitted', 'Get the admission letter from the university', ['b-bgr'], 'official', { due: MONTHS(5) }),
      step('visa', 'Apply for the type D visa at the Bulgarian consulate', ['b-bgr'], 'official', { due: MONTHS(3) }),
      step('permit', 'Apply for the residence permit after arrival', ['b-bgr'], 'official'),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'At least the minimum monthly salary in Bulgaria for each month of stay', ['emn-funds-2025'], 'official'),
      fact('euro', 'note', 'Currency', 'Bulgaria adopted the euro on 1 January 2026; older guides quote leva', ['b-bgr'], 'check'),
    ],
  }),

  studyGuide({
    cc: 'HR', name: 'Croatia', permit: 'temporary stay for study (biometric residence permit)', src: 'b-hrv',
    summary: 'Apply for temporary stay for study at the Croatian mission abroad or, for visa-free nationals, at the police administration in Croatia. Funds are set as a share of the average monthly salary.',
    links: [{ label: 'Ministry of the Interior: residence permits', url: 'https://mup.gov.hr/aliens-281621/stay-and-work/biometric-residence-permit/281683' }],
    funds: { label: 'Proof of funds: 25% of the Croatian average monthly salary for each month', sources: ['emn-funds-2025'], conf: 'official' },
    steps: [
      step('get-admitted', 'Get admitted', ['b-hrv'], 'official', { due: MONTHS(5) }),
      step('apply', 'Apply for temporary stay for study (mission abroad, or police in Croatia if visa-free)', ['b-hrv'], 'official', { due: MONTHS(3) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '25% of the average monthly salary per month (≈ €330 on 2024 data)', ['emn-funds-2025'], 'official', { eur: 329.5 }),
    ],
  }),

  studyGuide({
    cc: 'CY', name: 'Cyprus', permit: 'entry and residence permit for students (the university applies)', src: 'b-cyp',
    summary: 'Cyprus is in the EU but not in Schengen. The university applies to the Civil Registry and Migration Department for the entry permit; days in Cyprus do not count toward the Schengen 90/180 limit.',
    links: [{ label: 'Migration Department: students', url: 'https://www.gov.cy/mip-md/en/documents/students/' }],
    funds: { label: 'Proof of funds (amount set by ministerial decree; ask the university)', sources: ['emn-funds-2025', 'b-cyp'], conf: 'check' },
    steps: [
      step('university-applies', 'The university applies for the entry permit', ['b-cyp'], 'official', { due: MONTHS(4) }),
      step('permit', 'Apply for the temporary residence permit after arrival', ['b-cyp'], 'official'),
    ],
    facts: [
      fact('schengen', 'note', 'Not in Schengen', 'Days spent in Cyprus do not count toward the Schengen 90/180 limit', ['b-cyp'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'CZ', name: 'Czechia', permit: 'long-term visa for study (over 90 days), then long-term residence', src: 'cz-mzv-study',
    summary: 'Apply in person at the Czech embassy; decision within 60 days. Funds follow a formula based on the subsistence minimum (CZK 3,130): CZK 115,810 for a 12-month stay.',
    links: [
      { label: 'Ministry of the Interior: schools and students', url: 'https://www.mvcr.cz/mvcren/article/information-for-schools-and-students.aspx' },
      { label: 'Czech embassy (example: Tel Aviv): long-term visa for study', url: 'https://mzv.gov.cz/telaviv/en/visa_and_consular_services/visas/long_term_visas_and_residence_permits/long_term_visa_for_study.html' },
    ],
    funds: { label: 'Proof of funds: CZK 115,810 for 12 months (CZK 78,250 for 6 months)', sources: ['cz-mzv-study', 'cz-mpsv-em'], conf: 'official', detail: '15 × the subsistence minimum for the first month plus 2 × it for each further month; subsistence minimum CZK 3,130.' },
    insurance: { label: 'Travel medical insurance for the whole stay', sources: ['cz-mzv-study'], conf: 'official', detail: 'Needed before the visa is issued, not at submission.' },
    steps: [
      step('apply', 'Apply in person at the Czech embassy', ['cz-mzv-study'], 'official', { due: MONTHS(3), detail: 'Fee CZK 2,500; decision within 60 days.' }),
    ],
    docs: [
      doc('form', 'Application form, signed, and two photos', ['cz-mzv-study'], 'official'),
      doc('accommodation', 'Proof of accommodation', ['cz-mzv-study'], 'official'),
      doc('criminal', 'Criminal record extracts (nationality and residence countries)', ['cz-mzv-study'], 'official'),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'CZK 115,810 for a year (≈ €4,630); formula 15× + 2× the subsistence minimum (CZK 3,130)', ['cz-mzv-study', 'cz-mpsv-em'], 'official', { eur: eur(115810 / 12, 'CZK') }),
      fact('fee', 'fee', 'Visa fee', 'CZK 2,500', ['cz-mzv-study'], 'official', { eur: eur(2500, 'CZK') }),
      fact('processing', 'processing', 'Decision time', 'Up to 60 days', ['cz-mzv-study'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'DK', name: 'Denmark', permit: 'residence permit for higher education (SIRI)', src: 'b-dnk',
    summary: 'Create a case order ID, pay the fee and submit at a Danish mission (or a SIRI office in Denmark), then give biometrics. Denmark is not bound by the EU students directive; national rules apply.',
    links: [{ label: 'New to Denmark: higher education', url: 'https://www.nyidanmark.dk/en-GB/You-want-to-apply/Study/Higher-Education' }],
    funds: { label: 'Proof of funds: DKK 7,426 a month (2026), up to DKK 89,112', sources: ['b-dnk'], conf: 'official' },
    steps: [
      step('case-order', 'Create a case order ID and pay the fee (DKK 3,060)', ['b-dnk'], 'official', { due: MONTHS(3) }),
      step('submit', 'Submit at a Danish mission abroad or a SIRI office in Denmark', ['b-dnk'], 'official', { due: MONTHS(3) }),
      step('biometrics', 'Have facial photo and fingerprints recorded', ['b-dnk'], 'official', { due: MONTHS(2.5) }),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'DKK 7,426 a month (2026 level); at most DKK 89,112 for studies over a year', ['b-dnk'], 'official', { eur: eur(7426, 'DKK') }),
      fact('fee', 'fee', 'Processing fee', 'DKK 3,060', ['b-dnk'], 'official', { eur: eur(3060, 'DKK') }),
      fact('processing', 'processing', 'Processing time', '2 months, up to 3 if more information is needed', ['b-dnk'], 'official'),
      fact('work', 'work', 'Work while studying', '90 hours a month September–May; full-time in June, July and August', ['b-dnk'], 'official'),
      fact('post', 'post_study', 'After graduating', 'Job-seeking permit; for some degrees applied for after 1 October 2026 it is 6 months or 1 year (PhD: 3 years)', ['b-dnk'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'EE', name: 'Estonia', permit: 'temporary residence permit for study', src: 'b-est',
    summary: 'Apply for the temporary residence permit for study; the answer comes within 90 days and the card within 30 days after that. Income must be four times the subsistence level for each month of stay.',
    links: [{ label: 'Police and Border Guard Board: residence permit for study', url: 'https://www.politsei.ee/en/instructions/residence-permit-for-study' }],
    funds: { label: 'Proof of income: four times the subsistence level per month (€800 a month on the 2025 level)', sources: ['b-est', 'emn-funds-2025'], conf: 'multi' },
    insurance: { label: 'Health insurance contract', sources: ['b-est'], conf: 'official' },
    steps: [
      step('apply', 'Apply for the temporary residence permit for study', ['b-est'], 'official', { due: MONTHS(4), detail: 'Decision within 90 days; card within 30 days after that.' }),
    ],
    facts: [
      fact('funds', 'funds', 'Income required', '4 × the subsistence level (€200 in 2025) = €800 a month; the level is set each year in the State Budget Act', ['b-est', 'emn-funds-2025'], 'multi', { eur: 800 }),
      fact('work', 'work', 'Work while studying', 'Allowed as long as it does not interfere with full-time studies', ['b-est'], 'official'),
      fact('processing', 'processing', 'Decision time', '90 days, then 30 days for the card', ['b-est'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'FI', name: 'Finland', permit: 'first residence permit for studies (Migri)', src: 'b-fin',
    summary: 'Apply online in Enter Finland and visit a Finnish mission to prove identity. Show €9,600 in a personal bank account for a year of study, plus proof that tuition can be paid.',
    links: [
      { label: 'Migri: studying in Finland', url: 'https://migri.fi/en/studying-in-finland' },
      { label: 'Migri: income requirement for students', url: 'https://migri.fi/en/income-requirement-for-students' },
    ],
    funds: { label: 'Bank statement: €9,600 for a year (€800 a month), in the student\'s own account', sources: ['fi-migri-income'], conf: 'official', detail: 'Covering the last 6 months. Sponsor commitments are not accepted; grants reduce the amount.' },
    insurance: { label: 'Private medical and pharmaceutical insurance', sources: ['b-fin'], conf: 'official' },
    steps: [
      step('apply', 'Apply online in Enter Finland and pay the fee', ['b-fin'], 'official', { due: MONTHS(4) }),
      step('identify', 'Visit a Finnish mission to prove identity', ['b-fin'], 'official', { due: MONTHS(3.5) }),
    ],
    docs: [
      doc('tuition', 'Proof of funds for the tuition fee (or a scholarship)', ['b-fin'], 'official'),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '€800 a month; €9,600 in the account for studies of a year or more', ['fi-migri-income', 'emn-funds-2025'], 'official', { eur: 800 }),
      fact('work', 'work', 'Work while studying', 'An average of 30 hours a week; unlimited in holidays', ['b-fin'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'GR', name: 'Greece', permit: 'national (D) visa for study, then a residence permit', src: 'b-grc',
    summary: 'Get a national (D) visa for study at the Greek consulate, then apply for the residence permit at the Decentralised Administration\'s one-stop service.',
    links: [{ label: 'Ministry of Migration and Asylum: residence permit categories', url: 'https://migration.gov.gr/en/migration-policy/metanasteusi-stin-ellada/katigories-adeion-diamonis-politon-triton-choron-dikaiologitika%E2%80%8B/' }],
    funds: { label: 'Proof of funds: at least €650 a month', sources: ['emn-funds-2025'], conf: 'official', detail: 'Older university guides still quote €400; the EMN reply of October 2025 gives €650.' },
    insurance: { label: 'Insurance covering medical repatriation and emergency treatment', sources: ['gr-uoc-guide'], conf: 'check' },
    steps: [
      step('visa', 'Apply for the national (D) visa for study', ['gr-uoc-guide', 'b-grc'], 'check', { due: MONTHS(3) }),
      step('permit', 'Apply for the residence permit at the Decentralised Administration', ['gr-uoc-guide', 'b-grc'], 'check'),
    ],
    docs: [
      doc('criminal', 'Criminal record certificate', ['gr-uoc-guide'], 'check'),
      doc('medical', 'Medical certificate', ['gr-uoc-guide'], 'check'),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', 'At least €650 a month', ['emn-funds-2025'], 'official', { eur: 650 }),
    ],
  }),

  studyGuide({
    cc: 'HU', name: 'Hungary', permit: 'residence permit for study', src: 'b-hun',
    summary: 'Apply at a Hungarian mission in the country of nationality or residence, or in Hungary through the Enter Hungary platform. Decision within 60 days.',
    links: [
      { label: 'Immigration authority: students', url: 'https://oif.gov.hu/factsheets/residence-of-the-student-pupil' },
      { label: 'Enter Hungary', url: 'https://enterhungary.gov.hu/eh/' },
    ],
    funds: { label: 'Proof of sufficient resources (bank statement or scholarship)', sources: ['b-hun', 'emn-funds-2025'], conf: 'multi', detail: 'No fixed threshold: assessed case by case.' },
    insurance: { label: 'Comprehensive health insurance', sources: ['b-hun'], conf: 'official' },
    steps: [
      step('apply', 'Apply at a Hungarian mission, or online via Enter Hungary', ['b-hun'], 'official', { due: MONTHS(3) }),
    ],
    docs: [
      doc('language', 'Proof of language proficiency', ['b-hun'], 'official'),
      doc('photo', 'One facial photograph', ['b-hun'], 'official'),
    ],
    facts: [
      fact('work', 'work', 'Work while studying', 'Up to 30 hours a week in term; full-time for up to 90 days a year outside term', ['b-hun'], 'official'),
      fact('processing', 'processing', 'Decision time', 'Within 60 days of submission', ['b-hun'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'LV', name: 'Latvia', permit: 'residence permit for studies', src: 'b-lva',
    summary: 'Apply for a residence permit for studies at an accredited higher-education institution. Sources disagree on the funds amount, so confirm it with the Office of Citizenship and Migration Affairs before advising.',
    links: [{ label: 'Office of Citizenship and Migration Affairs: studies', url: 'https://www.pmlp.gov.lv/en/studies' }],
    funds: { label: 'Proof of funds for each month of the permit (amount: confirm with the authority)', sources: ['emn-funds-2025', 'b-lva'], conf: 'check',
      detail: 'Latvia told the EMN €740 a month (October 2025, equal to that year\'s minimum wage); the authority\'s own page, last updated in 2022, still says €500.' },
    steps: [step('apply', 'Apply for the residence permit for studies', ['b-lva'], 'official', { due: MONTHS(3) })],
    facts: [fact('funds', 'funds', 'Funds required', 'Sources disagree: €740 a month (EMN, October 2025) vs €500 (authority page from 2022)', ['emn-funds-2025', 'b-lva'], 'check', { eur: 740 })],
  }),

  studyGuide({
    cc: 'LT', name: 'Lithuania', permit: 'temporary residence permit for studies (MIGRIS)', src: 'b-ltu',
    summary: 'Apply through MIGRIS for a national visa and temporary residence permit for studies. Funds: half the minimum monthly wage for each month of the permit.',
    links: [{ label: 'Migration Department: students', url: 'https://www.migracija.lt/en/esu-studentas1' }],
    funds: { label: 'Proof of funds: half the Lithuanian minimum monthly wage for each month', sources: ['b-ltu', 'emn-funds-2025'], conf: 'multi' },
    steps: [step('apply', 'Apply in MIGRIS', ['b-ltu'], 'official', { due: MONTHS(3) })],
    facts: [fact('funds', 'funds', 'Funds required', '0.5 × the minimum monthly wage per month (€519 on the 2025 wage of €1,038; higher in 2026)', ['b-ltu', 'emn-funds-2025'], 'multi', { eur: 519 })],
  }),

  studyGuide({
    cc: 'LU', name: 'Luxembourg', permit: 'temporary authorisation to stay, then a residence permit for students', src: 'b-lux',
    summary: 'The authorisation to stay must be approved before entering Luxembourg. Then: type D visa if needed, declaration of arrival within 3 days and the residence permit within 3 months.',
    links: [{ label: 'Guichet.lu: students from third countries', url: 'https://guichet.public.lu/en/citoyens/immigration/plus-3-mois/ressortissant-tiers/etudiant/etudiant-pays-tiers.html' }],
    funds: { label: 'Proof of resources: at least 80% of the social inclusion income (REVIS) a month', sources: ['b-lux', 'emn-funds-2025'], conf: 'multi' },
    insurance: { label: 'Health insurance covering illness in Luxembourg', sources: ['b-lux'], conf: 'official' },
    steps: [
      step('authorisation', 'Apply for the temporary authorisation to stay (fee €80)', ['b-lux'], 'official', { due: MONTHS(4) }),
      step('visa', 'Apply for the type D visa after approval', ['b-lux'], 'official', { for: { flag: 'schengen_visa' }, due: MONTHS(2) }),
      step('arrival', 'Declare arrival at the commune within 3 days', ['b-lux'], 'official'),
      step('permit', 'Apply for the residence permit within 3 months', ['b-lux'], 'official'),
    ],
    facts: [
      fact('funds', 'funds', 'Funds required', '80% of REVIS a month (€1,214.40 on the 2025 level)', ['b-lux', 'emn-funds-2025'], 'multi', { eur: 1214.4 }),
      fact('fee', 'fee', 'Authorisation fee', '€80', ['b-lux'], 'official', { eur: 80 }),
      fact('work', 'work', 'Work while studying', 'An average of 15 hours a week over a month; unlimited in holidays', ['b-lux'], 'official'),
    ],
  }),

  studyGuide({
    cc: 'MT', name: 'Malta', permit: 'residence permit for study (Identità)', src: 'b-mlt',
    summary: 'Visa-required nationals first get a visa issued for education; the residence permit application is then made in person in Malta for full-time courses at MQF level 5 or higher.',
    links: [{ label: 'Identità: study permits', url: 'https://identita.gov.mt/expatriates-unit-main-page/noneu-nationals/non-employment-permits/study-research-trainees-volunteers-interns/' }],
    funds: { label: 'Proof of sufficient resources (ask the institution for the current amount)', sources: ['b-mlt'], conf: 'check' },
    steps: [
      step('visa', 'Get a visa issued for education purposes', ['b-mlt'], 'official', { for: { flag: 'schengen_visa' }, due: MONTHS(3) }),
      step('permit', 'Apply in person in Malta for the residence permit (fee €50)', ['b-mlt'], 'official'),
    ],
    facts: [fact('fee', 'fee', 'Application fee', '€50', ['b-mlt'], 'official', { eur: 50 })],
  }),

  studyGuide({
    cc: 'PT', name: 'Portugal', permit: 'residence visa for study (D4), then a residence permit from AIMA', src: 'b-prt',
    summary: 'Apply for the D4 residence visa for higher education at the consulate or its visa centre, then apply for the residence permit with AIMA during the visa\'s 4-month validity.',
    links: [{ label: 'Portuguese visa portal', url: 'https://vistos.mne.gov.pt/en/national-visas/general-information/type-of-visa' }],
    funds: { label: 'Proof of means: bank statements for the last 6 months', sources: ['pt-vfs-d4'], conf: 'check', detail: 'Not required for scholarship holders or applicants from Portuguese-speaking countries, per the consulate checklist.' },
    insurance: { label: 'Travel insurance covering medical expenses and repatriation', sources: ['pt-vfs-d4'], conf: 'check' },
    steps: [
      step('visa', 'Apply for the D4 residence visa', ['pt-vfs-d4', 'b-prt'], 'check', { due: MONTHS(3), detail: 'At least 30 working days of processing.' }),
      step('aima', 'Apply for the residence permit with AIMA within the visa\'s 4 months', ['b-prt'], 'official'),
    ],
    docs: [doc('police', 'Police clearance (valid 3 months), from nationality or residence country', ['pt-vfs-d4'], 'check')],
    facts: [fact('processing', 'processing', 'Processing time', 'At least 30 working days after submission or interview', ['pt-vfs-d4'], 'check')],
  }),

  studyGuide({
    cc: 'RO', name: 'Romania', permit: 'long-stay study visa (D/SD), then a residence permit', src: 'b-rou',
    summary: 'Non-EU students need a Letter of Acceptance to Studies and proof that tuition is paid before applying for the D/SD visa; the residence permit follows in Romania.',
    links: [{ label: 'General Inspectorate for Immigration: studies', url: 'https://igi.mai.gov.ro/en/studies/' }],
    funds: { label: 'Proof of funds (for the residence permit universities cite at least €3,000 in a Romanian bank)', sources: ['ro-upit'], conf: 'check' },
    steps: [
      step('acceptance', 'Get the Letter of Acceptance to Studies', ['ro-upit', 'b-rou'], 'check', { due: MONTHS(5) }),
      step('tuition', 'Pay the tuition fees', ['ro-upit'], 'check', { due: MONTHS(4) }),
      step('visa', 'Apply for the D/SD visa at the Romanian embassy', ['ro-upit', 'b-rou'], 'check', { due: MONTHS(3) }),
      step('permit', 'Apply for the residence permit in Romania', ['b-rou'], 'official'),
    ],
    facts: [
      fact('post', 'post_study', 'After graduating', 'Residence can be extended 9 months to look for work', ['b-rou'], 'official'),
      fact('fees', 'fee', 'Fees cited by universities', 'Consular fee about €120; residence permit RON 260', ['ro-upit'], 'check'),
    ],
  }),

  studyGuide({
    cc: 'SK', name: 'Slovakia', permit: 'temporary residence for the purpose of study', src: 'sk-euraxess-2026',
    summary: 'Enter with a national (D) visa (or visa-free) and apply to the Foreign Police for temporary residence for study. Documents must not be older than 90 days; the criminal record must be apostilled and translated into Slovak.',
    links: [{ label: 'Ministry of the Interior: residence of foreigners', url: 'https://www.minv.sk/?residence-of-an-foreigner=' }],
    funds: { label: 'Proof of funds if asked (not on the July 2026 checklist)', sources: ['sk-euraxess-2026'], conf: 'check' },
    steps: [
      step('entry', 'Enter on a national (D) visa, an EU permit or visa-free', ['sk-euraxess-2026'], 'official', { due: MONTHS(2) }),
      step('apply', 'Apply to the Foreign Police for temporary residence for study', ['sk-euraxess-2026'], 'official', { detail: 'Decision within 90 days; card 30 days later (€10) or 2 days (€39).' }),
    ],
    docs: [
      doc('confirmation', 'Confirmation of study', ['sk-euraxess-2026'], 'official'),
      doc('criminal', 'Criminal record extract, apostilled and translated into Slovak', ['sk-euraxess-2026'], 'official'),
    ],
    facts: [
      fact('processing', 'processing', 'Decision time', '90 days, plus 30 days for the card', ['sk-euraxess-2026'], 'official'),
      fact('fee', 'fee', 'Card fee', '€10 (standard) or €39 (2-day)', ['sk-euraxess-2026'], 'official', { eur: 10 }),
    ],
  }),

  studyGuide({
    cc: 'SI', name: 'Slovenia', permit: 'temporary residence permit for study', src: 'b-svn',
    summary: 'Apply for a temporary residence permit for study at a Slovenian mission abroad, or at the administrative unit in Slovenia if lawfully present.',
    links: [{ label: 'InfoTujci: temporary residence permit', url: 'https://infotujci.si/en/third-country-nationals/temporary-residence-permit/' }],
    funds: { label: 'Proof of sufficient means of subsistence (ask the administrative unit for the current amount)', sources: ['b-svn'], conf: 'check' },
    steps: [step('apply', 'Apply for the temporary residence permit for study', ['b-svn'], 'check', { due: MONTHS(3) })],
    facts: [],
  }),
];
