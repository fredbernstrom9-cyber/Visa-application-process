// Work, research, traineeship and family routes.
//
// "basic" guides carry the EU-wide baseline set by the directives (what every applicant must show)
// plus the national authority's official entry point. They do not claim national figures.
// Denmark and Ireland are not bound by these directives and get national guides only where
// we have checked them. Full guides (DE, NL, FR work) carry checked national figures.
import type { Guide, Iso2, Route } from '../types';
import { doc, fact, MONTHS, step } from './helpers';

const EU27: readonly Iso2[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];
const NOT_BOUND: readonly Iso2[] = ['DK', 'IE'];

const NAME: Record<Iso2, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia',
  FI: 'Finland', FR: 'France', DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy', LV: 'Latvia',
  LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands', PL: 'Poland', PT: 'Portugal', RO: 'Romania',
  SK: 'Slovakia', SI: 'Slovenia', ES: 'Spain', SE: 'Sweden',
};

/** The national authority's official page (checked) and its source id, per country. */
const AUTHORITY: Record<Iso2, { label: string; url: string; src: string }> = {
  AT: { label: 'Austrian migration portal', url: 'https://www.migration.gv.at/en/', src: 'b-aut' },
  BE: { label: 'Immigration Office (IBZ)', url: 'https://dofi.ibz.be/en', src: 'b-bel' },
  BG: { label: 'Ministry of Foreign Affairs of Bulgaria', url: 'https://www.mfa.bg/en/155', src: 'b-bgr' },
  HR: { label: 'Ministry of the Interior of Croatia', url: 'https://mup.gov.hr/aliens-281621/stay-and-work/biometric-residence-permit/281683', src: 'b-hrv' },
  CY: { label: 'Civil Registry and Migration Department', url: 'https://www.gov.cy/mip-md/en/documents/students/', src: 'b-cyp' },
  CZ: { label: 'Ministry of the Interior of Czechia', url: 'https://www.mvcr.cz/mvcren/article/information-for-schools-and-students.aspx', src: 'b-cze' },
  DK: { label: 'New to Denmark (SIRI)', url: 'https://www.nyidanmark.dk/en-GB/You-want-to-apply/Study/Higher-Education', src: 'b-dnk' },
  EE: { label: 'Police and Border Guard Board', url: 'https://www.politsei.ee/en/instructions/residence-permit-for-study', src: 'b-est' },
  FI: { label: 'Finnish Immigration Service (Migri)', url: 'https://migri.fi/en/studying-in-finland', src: 'b-fin' },
  FR: { label: 'Service-Public.fr', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2231?lang=en', src: 'fr-sp-f2231' },
  DE: { label: 'Make it in Germany', url: 'https://www.make-it-in-germany.com/en/looking-for-foreign-professionals/entering/admission-labour-market/students', src: 'de-mig-students' },
  GR: { label: 'Ministry of Migration and Asylum', url: 'https://migration.gov.gr/en/migration-policy/metanasteusi-stin-ellada/katigories-adeion-diamonis-politon-triton-choron-dikaiologitika%E2%80%8B/', src: 'b-grc' },
  HU: { label: 'Immigration and Asylum Office', url: 'https://oif.gov.hu/factsheets/residence-of-the-student-pupil', src: 'b-hun' },
  IE: { label: 'Irish Immigration Service Delivery', url: 'https://www.irishimmigration.ie/visa-offices/', src: 'ie-visa-offices' },
  IT: { label: 'Visa for Italy (Foreign Ministry)', url: 'https://vistoperitalia.esteri.it/', src: 'it-visto' },
  LV: { label: 'Office of Citizenship and Migration Affairs', url: 'https://www.pmlp.gov.lv/en/studies', src: 'b-lva' },
  LT: { label: 'Migration Department of Lithuania', url: 'https://www.migracija.lt/en/esu-studentas1', src: 'b-ltu' },
  LU: { label: 'Guichet.lu', url: 'https://guichet.public.lu/en/citoyens/immigration/plus-3-mois/ressortissant-tiers/etudiant/etudiant-pays-tiers.html', src: 'b-lux' },
  MT: { label: 'Identità', url: 'https://identita.gov.mt/expatriates-unit-main-page/noneu-nationals/non-employment-permits/study-research-trainees-volunteers-interns/', src: 'b-mlt' },
  NL: { label: 'IND', url: 'https://ind.nl/en/required-amounts-income-requirements', src: 'nl-ind-amounts-2026' },
  PL: { label: 'Office for Foreigners (MOS)', url: 'https://mos.cudzoziemcy.gov.pl/en/informacje/na-studia_EN', src: 'pl-mos-studies' },
  PT: { label: 'Portuguese visa portal', url: 'https://vistos.mne.gov.pt/en/national-visas/general-information/type-of-visa', src: 'b-prt' },
  RO: { label: 'General Inspectorate for Immigration', url: 'https://igi.mai.gov.ro/en/studies/', src: 'b-rou' },
  SK: { label: 'Ministry of the Interior of Slovakia', url: 'https://www.minv.sk/?residence-of-an-foreigner=', src: 'b-svk' },
  SI: { label: 'InfoTujci', url: 'https://infotujci.si/en/third-country-nationals/temporary-residence-permit/', src: 'b-svn' },
  ES: { label: 'Ministry of Inclusion: migration', url: 'https://www.inclusion.gob.es/en/web/migraciones/w/estancia-por-estudios', src: 'es-sheet1' },
  SE: { label: 'Swedish Migration Agency', url: 'https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html', src: 'se-mv-apply' },
};

const PORTAL = { label: 'EU Immigration Portal', url: 'https://home-affairs.ec.europa.eu/policies/migration-and-asylum/eu-immigration-portal_en' };

function basic(cc: Iso2, route: Route, title: string, summary: string, directive: string, rules: Guide['rules']): Guide {
  const a = AUTHORITY[cc];
  return {
    destination: cc, route, level: 'basic', lastChecked: '2026-10-06',
    title: `${NAME[cc]}: ${title}`,
    summary: `${summary} National amounts, fees and forms vary: confirm them with ${a.label}.`,
    links: [{ label: a.label, url: a.url }, PORTAL],
    rules: [
      ...rules,
      step('confirm-national', `Confirm the national requirements with ${a.label}`, [a.src, 'ec-portal'], 'official', { due: MONTHS(4) }),
    ],
    facts: [fact('baseline', 'note', 'What this checklist covers', `The EU-wide minimum from ${directive}. ${NAME[cc]} may ask for more.`, [directive === 'Directive (EU) 2021/1883' ? 'dir-2021-1883' : directive === 'Directive 2003/86/EC' ? 'dir-2003-86' : 'dir-2016-801'], 'official')],
  };
}

const blueCardRules = (cc: Iso2): Guide['rules'] => [
  doc('passport', 'Valid travel document', ['dir-2021-1883'], 'official', { due: MONTHS(3) }),
  doc('contract', 'Work contract or binding job offer of at least 6 months for highly qualified employment', ['dir-2021-1883'], 'official', { due: MONTHS(3) }),
  doc('qualification', 'Proof of higher professional qualifications (degree, or professional experience where accepted)', ['dir-2021-1883'], 'official', { due: MONTHS(3) }),
  doc('salary', `Salary at or above ${NAME[cc]}'s Blue Card threshold`, ['dir-2021-1883'], 'official', { due: MONTHS(3), detail: 'Set nationally at 1.0–1.6 times the average gross annual salary; lower for shortage occupations and recent graduates where the country allows it.' }),
  doc('regulated', 'For regulated professions: recognition or authorisation to practise', ['dir-2021-1883'], 'official', { optional: true }),
  doc('insurance', 'Sickness insurance (unless covered through the job)', ['dir-2021-1883'], 'official', { due: MONTHS(3) }),
];

const researchRules: Guide['rules'] = [
  doc('passport', 'Valid travel document', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('hosting', 'Hosting agreement with an approved research organisation', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('financial', 'Research organisation\'s statement of financial responsibility (if required)', ['dir-2016-801'], 'official', { optional: true }),
  doc('resources', 'Proof of sufficient resources', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('insurance', 'Sickness insurance', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
];

const traineeRules: Guide['rules'] = [
  doc('passport', 'Valid travel document', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('agreement', 'Traineeship agreement with the host entity (theoretical and practical training)', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('degree', 'Higher-education degree obtained in the last 2 years, or current studies leading to one', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('resources', 'Proof of sufficient resources', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
  doc('insurance', 'Sickness insurance', ['dir-2016-801'], 'official', { due: MONTHS(3) }),
];

const familyRules: Guide['rules'] = [
  doc('passport', 'Valid travel document for each family member', ['dir-2003-86'], 'official', { due: MONTHS(3) }),
  doc('relationship', 'Proof of the family relationship (marriage or birth certificates, legalised and translated)', ['dir-2003-86'], 'official', { due: MONTHS(3) }),
  doc('sponsor-permit', 'Sponsor\'s residence permit (valid for at least a year, with reasonable prospects of permanent residence)', ['dir-2003-86'], 'official', { due: MONTHS(3) }),
  doc('accommodation', 'Accommodation regarded as normal for a comparable family', ['dir-2003-86'], 'official', { due: MONTHS(3) }),
  doc('resources', 'Sponsor\'s stable and regular resources', ['dir-2003-86'], 'official', { due: MONTHS(3) }),
  doc('insurance', 'Sickness insurance for the family', ['dir-2003-86'], 'official', { due: MONTHS(3) }),
];

const BOUND = EU27.filter((c) => !NOT_BOUND.includes(c));

const FULL_WORK: Guide[] = [
  {
    destination: 'DE', route: 'work', level: 'full', lastChecked: '2026-10-06',
    title: 'Germany: EU Blue Card',
    summary: 'For holders of a German or comparable foreign degree with a job offer of at least 6 months paying at least €50,700 a year in 2026 (€45,934.20 in shortage occupations and for new entrants). §41 nationals may apply in Germany.',
    permit: 'EU Blue Card (§18g Residence Act)',
    links: [{ label: 'Federal Employment Agency: EU Blue Card 2026', url: 'https://www.arbeitsagentur.de/vor-ort/zav/working-and-living-in-germany/iss-en/issue-03-2026/blue-card' }],
    rules: [
      step('recognition', 'Check the degree is recognised or comparable (anabin / ZAB)', ['de-ba-bluecard-2026'], 'official', { due: MONTHS(5) }),
      step('visa', 'Apply for the national (D) visa for employment', ['de-ba-bluecard-2026', 'de-ffo-visa'], 'official', { for: { notFlag: 'de41' }, due: MONTHS(3) }),
      step('in-germany', 'Alternative: enter visa-free and apply at the foreigners office within 90 days', ['de-aufenthv-41'], 'official', { for: { flag: 'de41' }, optional: true }),
      ...blueCardRules('DE').filter((r) => r.key !== 'salary'),
      doc('salary', 'Contract paying at least €50,700 a year (€45,934.20 for shortage occupations / new entrants)', ['de-ba-bluecard-2026'], 'official', { due: MONTHS(3) }),
    ],
    facts: [
      fact('salary', 'salary', 'Minimum salary 2026', '€50,700 gross a year; €45,934.20 in shortage occupations and for new entrants', ['de-ba-bluecard-2026'], 'official', { eur: 50700 }),
      fact('pr', 'duration', 'Permanent residence', 'After 27 months (A1 German) or 21 months (B1 German)', ['de-ba-bluecard-2026'], 'official'),
      fact('fee-visa', 'fee', 'National (D) visa', '€75', ['de-ffo-visa'], 'official', { eur: 75, for: { notFlag: 'de41' } }),
    ],
  },
  {
    destination: 'NL', route: 'work', level: 'full', lastChecked: '2026-10-06',
    title: 'Netherlands: highly skilled migrant or EU Blue Card',
    summary: 'The employer, a recognised sponsor, applies to the IND. Gross monthly salary from 1 July 2026: €5,942 (30 and over), €4,357 (under 30), €3,122 for recent graduates; EU Blue Card €5,942 (reduced €4,754).',
    permit: 'Residence permit as a highly skilled migrant, or EU Blue Card',
    links: [{ label: 'IND: income requirements', url: 'https://ind.nl/en/required-amounts-income-requirements' }],
    rules: [
      step('sponsor', 'The employer (recognised sponsor) applies to the IND', ['nl-ind-amounts-2026'], 'official', { due: MONTHS(3) }),
      step('mvv', 'Collect the MVV entry visa after approval', ['nl-nw-mvv'], 'official', { for: { notFlag: 'mvv_exempt' }, due: MONTHS(1) }),
      doc('passport', 'Valid passport', ['nl-ind-amounts-2026'], 'official', { due: MONTHS(3) }),
      doc('contract', 'Employment contract meeting the income requirement', ['nl-ind-amounts-2026'], 'official', { due: MONTHS(3) }),
      doc('antecedents', 'Signed antecedents certificate', ['nl-ind-student'], 'official', { due: MONTHS(3) }),
    ],
    facts: [
      fact('hsm-30', 'salary', 'Highly skilled migrant, 30 and over', '€5,942 gross a month (1 July – 31 December 2026)', ['nl-ind-amounts-2026'], 'official', { eur: 5942 }),
      fact('hsm-u30', 'salary', 'Highly skilled migrant, under 30', '€4,357 gross a month', ['nl-ind-amounts-2026'], 'official', { eur: 4357 }),
      fact('hsm-grad', 'salary', 'Reduced criterion (graduates, orientation year)', '€3,122 gross a month', ['nl-ind-amounts-2026'], 'official', { eur: 3122 }),
      fact('bluecard', 'salary', 'EU Blue Card', '€5,942 gross a month; reduced €4,754', ['nl-ind-amounts-2026'], 'official', { eur: 5942 }),
    ],
  },
  {
    destination: 'FR', route: 'work', level: 'full', lastChecked: '2026-10-06',
    title: 'France: "talent – carte bleue européenne"',
    summary: 'Multi-year "talent – carte bleue européenne" residence card for highly qualified employment paying at least €59,373 gross a year (1.5 × the reference salary of €39,582 set in August 2025).',
    permit: 'Carte de séjour pluriannuelle "talent – carte bleue européenne"',
    links: [{ label: 'France-Visas', url: 'https://france-visas.gouv.fr/en/' }],
    rules: [
      step('visa', 'Apply for the long-stay "talent" visa on France-Visas', ['fr-talent-2025'], 'check', { due: MONTHS(3) }),
      ...blueCardRules('FR').filter((r) => r.key !== 'salary'),
      doc('salary', 'Contract paying at least €59,373 gross a year', ['fr-talent-2025', 'fr-talent-deloitte'], 'multi', { due: MONTHS(3) }),
    ],
    facts: [
      fact('salary', 'salary', 'Minimum salary', '€59,373 gross a year (arrêté of 21 August 2025)', ['fr-talent-2025', 'fr-talent-deloitte'], 'multi', { eur: 59373 }),
      fact('salarie-qualifie', 'salary', '"Talent – salarié qualifié" (for comparison)', '€39,582 gross a year', ['fr-talent-2025', 'fr-talent-deloitte'], 'multi', { eur: 39582 }),
    ],
  },
];

const FULL_WORK_CODES = FULL_WORK.map((g) => g.destination);

export const EU_ROUTES: Guide[] = [
  ...FULL_WORK,
  ...BOUND.filter((c) => !FULL_WORK_CODES.includes(c)).map((cc) => basic(cc, 'work', 'EU Blue Card',
    'Highly qualified employment under the recast EU Blue Card directive.', 'Directive (EU) 2021/1883', blueCardRules(cc))),
  ...BOUND.map((cc) => basic(cc, 'research', 'researchers (hosting agreement)',
    'Researchers hosted by an approved research organisation under the students and researchers directive.', 'Directive (EU) 2016/801', researchRules)),
  ...BOUND.map((cc) => basic(cc, 'traineeship', 'trainees',
    'Trainees with a traineeship agreement under the students and researchers directive.', 'Directive (EU) 2016/801', traineeRules)),
  ...BOUND.map((cc) => basic(cc, 'family', 'family reunification',
    'Family members joining a non-EU sponsor who lives in the country under the family reunification directive.', 'Directive 2003/86/EC', familyRules)),
];
