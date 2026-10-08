// Schengen short stays (≤ 90 days in any 180) are harmonised by the Visa Code, so one guide is
// generated per Schengen state from the same checked rules. Nationality notes (visa cascades,
// refusal rates, embassy restrictions) are attached as targeted facts.
import type { Fact, Guide, Iso2 } from '../types';
import { doc, fact, step } from './helpers';

/** The 29 Schengen states (Bulgaria and Romania fully since 1 January 2025). */
export const SCHENGEN: readonly Iso2[] = [
  'AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH',
];

const NAME: Record<Iso2, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland',
  FR: 'France', DE: 'Germany', GR: 'Greece', HU: 'Hungary', IS: 'Iceland', IT: 'Italy', LV: 'Latvia', LI: 'Liechtenstein',
  LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands', NO: 'Norway', PL: 'Poland', PT: 'Portugal',
  RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia', ES: 'Spain', SE: 'Sweden', CH: 'Switzerland',
};

const VISA = { flag: 'schengen_visa' as const };
const FREE = { notFlag: 'schengen_visa' as const };

/** Notes about one nationality that hold for every Schengen destination. */
const NATIONALITY_NOTES: Fact[] = [
  fact('in-cascade', 'note', 'Visa cascade', 'After two Schengen visas used lawfully in the last 3 years, residents of India can get a 2-year multiple-entry visa, then up to 5 years', ['eeas-india'], 'official', { for: { in: ['IN'] } }),
  fact('gcc-5y', 'note', 'Five-year visa', 'Since April 2024 first-time applicants living in and applying from Saudi Arabia, Bahrain or Oman can be given a 5-year multiple-entry visa, at the consulate\'s discretion', ['ec-gcc-2024', 'ey-gcc'], 'official', { for: { in: ['SA', 'BH', 'OM'] } }),
  fact('qa-kw', 'note', 'Visa still required', 'The EU proposed visa-free travel for Qatar and Kuwait in 2022, but it is not in force', ['ec-qatar-kuwait'], 'official', { for: { in: ['QA', 'KW'] } }),
  fact('kw-cascade', 'note', 'Visa cascade', 'Kuwait has its own cascade of longer multiple-entry visas after good travel history', ['ec-legal-docs'], 'official', { for: { in: ['KW'] } }),
  fact('dz-refusals', 'note', 'High refusal rate', 'About 31% of Schengen short-stay applications in Algeria were refused in 2025 (14.6% worldwide)', ['ec-stats-2025'], 'official', { for: { residenceIn: ['DZ'] } }),
  fact('gh-refusals', 'note', 'High refusal rate', 'About 46.5% of applications in Ghana were refused in 2025 (14.6% worldwide)', ['ec-stats-2025'], 'official', { for: { residenceIn: ['GH'] } }),
  fact('ng-refusals', 'note', 'High refusal rate', 'Close to 48% of applications in Nigeria were refused in 2025 (14.6% worldwide)', ['ec-stats-2025'], 'official', { for: { residenceIn: ['NG'] } }),
  fact('sn-refusals', 'note', 'High refusal rate', 'About 51.9% of applications in Senegal were refused in 2025 (14.6% worldwide)', ['ec-stats-2025'], 'official', { for: { residenceIn: ['SN'] } }),
  fact('id-cascade', 'note', 'Visa cascade', 'Since July 2025 residents of Indonesia can get a 5-year multiple-entry visa after one visa used lawfully in the previous 3 years', ['eeas-indonesia'], 'official', { for: { in: ['ID'] } }),
  fact('ir-embassies', 'note', 'Reduced embassy services', 'Some European embassies in Tehran have reduced or moved visa services in 2026; check the embassy site before booking', ['it-iran-2026'], 'official', { for: { residenceIn: ['IR'] } }),
  fact('ru-single', 'note', 'Single-entry visas', 'Since November 2025 Russian citizens are generally issued single-entry visas only, with a few exceptions', ['ec-russia'], 'official', { for: { in: ['RU'] } }),
  fact('tr-cascade', 'note', 'Visa cascade', 'Since July 2025 residents of Türkiye can move up from 1-year to 3- and 5-year multiple-entry visas after good travel history', ['ec-turkiye'], 'official', { for: { in: ['TR'] } }),
  fact('biometric', 'note', 'Biometric passport', 'Visa-free travel requires a biometric passport', ['reg-visa-list-annex'], 'official', { for: { in: ['AL', 'BA', 'GE', 'MD', 'ME', 'MK', 'RS', 'UA'] } }),
  fact('ua-kyiv', 'note', 'Limited services in Kyiv', 'Several embassies in Kyiv offer limited visa services (the German visa section is not open to the public)', ['de-kyiv'], 'official', { for: { residenceIn: ['UA'] } }),
];

function guideFor(cc: Iso2): Guide {
  const name = NAME[cc];
  return {
    destination: cc, route: 'short_stay', level: 'full', lastChecked: '2026-10-06',
    title: `${name}: Schengen short stay (up to 90 days)`,
    summary: `Up to 90 days in any 180-day period across the Schengen area. Visa-required nationals apply to the consulate of ${name} when it is the main destination; visa-exempt nationals travel on their passport and are registered in the Entry/Exit System (EES) at the border.`,
    permit: 'Uniform Schengen visa (type C), or visa-free entry',
    links: [
      { label: 'European Commission: applying for a Schengen visa', url: 'https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en' },
      { label: 'Entry/Exit System (EES)', url: 'https://travel-europe.europa.eu/en/ees' },
    ],
    rules: [
      step('main-destination', `Apply to the ${name} consulate only if ${name} is the main destination`, ['eu-apply-schengen', 'reg-visa-code'], 'official', {
        for: VISA, due: 45, detail: 'The country where most days are spent; if equal, the country of first entry.',
      }),
      step('book', 'Book the appointment (6 months to 15 days before travel)', ['eu-apply-schengen'], 'official', { for: VISA, due: 45, detail: 'Many consulates use an external visa centre.' }),
      step('appointment', 'Attend the appointment: fingerprints and fee', ['eu-fee-2024', 'de-ffo-visa'], 'official', {
        for: VISA, due: 21, detail: '€90 (children 6–12: €45). Pupils and students travelling for study or training are exempt from the fee.',
      }),
      step('decision', 'Wait for the decision (standard 15 calendar days)', ['reg-visa-code'], 'official', { for: VISA, detail: 'Can be extended in individual cases.' }),
      step('passport-check', 'Check the passport: issued within 10 years, valid 3 months after departure', ['youreurope-docs'], 'official', { for: FREE, due: 30 }),
      step('count-days', 'Count the days: 90 in any 180 across all Schengen states; no work', ['reg-visa-list', 'youreurope-docs'], 'official', { for: FREE }),
      step('ees', 'Registration in the Entry/Exit System at the first border crossing', ['ees-full', 'ees-faq'], 'official', { detail: 'Fingerprints and a face photo; passport stamping has ended.' }),
      doc('form', 'Schengen visa application form, signed', ['eu-apply-schengen', 'reg-visa-code'], 'official', { for: VISA, due: 21 }),
      doc('passport', 'Passport issued within 10 years, valid 3+ months after departure, 2 blank pages', ['reg-visa-code', 'youreurope-docs'], 'official', { for: VISA, due: 21 }),
      doc('photo', 'Passport photo', ['eu-apply-schengen'], 'official', { for: VISA, due: 21 }),
      doc('insurance', 'Travel medical insurance of at least €30,000', ['reg-visa-code'], 'official', { for: VISA, due: 21, detail: 'Emergency care, hospitalisation and repatriation, valid in the whole Schengen area.' }),
      doc('ticket', 'Return or onward ticket reservation', ['eu-apply-schengen'], 'official', { due: 21 }),
      doc('accommodation', 'Proof of accommodation', ['eu-apply-schengen', 'youreurope-docs'], 'official', { due: 21 }),
      doc('means', 'Proof of means: bank statements, payslips or sponsor letter', ['reg-visa-code', 'youreurope-docs'], 'official', { due: 21 }),
      doc('purpose', 'Proof of purpose: invitation, course enrolment or employer letter', ['eu-apply-schengen'], 'official', { for: VISA, due: 21 }),
      doc('passport-free', 'Passport issued within 10 years, valid 3+ months after departure', ['youreurope-docs'], 'official', { for: FREE }),
    ],
    facts: [
      fact('fee', 'fee', 'Schengen visa fee', '€90 (children 6–12: €45; students travelling for study exempt)', ['eu-fee-2024'], 'official', { eur: 90, for: VISA }),
      fact('duration', 'duration', 'Maximum stay', '90 days in any 180-day period, Schengen-wide', ['reg-visa-list', 'youreurope-docs'], 'official'),
      fact('processing', 'processing', 'Decision time', '15 calendar days as standard; apply between 6 months and 15 days before travel', ['reg-visa-code', 'eu-apply-schengen'], 'official', { for: VISA }),
      fact('etias', 'note', 'ETIAS', 'Not in operation yet (€20 once it starts); the EU will announce the start date several months ahead. Ignore sites that charge for it today.', ['etias-home', 'etias-fee', 'no-politi-etias'], 'official', { for: FREE }),
      ...NATIONALITY_NOTES,
    ],
  };
}

export const SCHENGEN_SHORT_STAY: Guide[] = SCHENGEN.map(guideFor);
