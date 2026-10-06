// Visa status and rule flags for every nationality the CRM accepts (ISO 3166-1 alpha-2 + XK).
//
// Sources (checked 6 October 2026):
//  - Schengen: Regulation (EU) 2018/1806, Annex II (visa-exempt), consolidated text of 30 December 2025
//    [reg-visa-list]. Every state not in Annex II (and not EU/EEA/Swiss) needs a Schengen visa.
//    Georgia remains visa-exempt for ordinary passports; only diplomatic and service passports were
//    suspended in 2026 [ge-suspension-2026].
//  - Ireland: Immigration Service Delivery list of non-visa-required nationalities (May 2025)
//    [ie-visa-list-2025], minus Nicaragua, Saint Kitts and Nevis and Saint Lucia from 15 June 2026
//    (S.I. No. 242/2026) [ie-si-2026-242].
//  - Germany §41 AufenthV [de-aufenthv-41]; Netherlands MVV exemptions [nl-ind-mvv];
//    APS countries [de-aps-uniassist].
import type { Flag, Iso2, Nationality } from './types';

/** EU member states, the EEA (IS, LI, NO) and Switzerland: free movement. */
export const EEA: readonly Iso2[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH',
];

/** Regulation 2018/1806 Annex II, Part 1 (states), Part 2 (HK, MO SARs) and Part 4 (Taiwan, Kosovo). */
export const SCHENGEN_VISA_EXEMPT: readonly Iso2[] = [
  'AD', 'AE', 'AG', 'AL', 'AR', 'AU', 'BA', 'BB', 'BN', 'BR', 'BS', 'CA', 'CL', 'CO', 'CR', 'DM', 'FM', 'GB',
  'GD', 'GE', 'GT', 'HN', 'IL', 'JP', 'KI', 'KN', 'KR', 'LC', 'MC', 'MD', 'ME', 'MH', 'MK', 'MU', 'MX', 'MY',
  'NI', 'NR', 'NZ', 'PA', 'PE', 'PW', 'PY', 'RS', 'SB', 'SC', 'SG', 'SM', 'SV', 'TL', 'TO', 'TT', 'TV', 'UA',
  'US', 'UY', 'VA', 'VC', 'VE', 'WS',
  'HK', 'MO', 'TW', 'XK',
];

/** Biometric-passport-only exemptions (Annex II footnotes 6, 8, 9, 10, 12, 13). */
export const SCHENGEN_BIOMETRIC_ONLY: readonly Iso2[] = ['AL', 'BA', 'GE', 'MD', 'ME', 'MK', 'RS', 'UA'];

/** Ireland: non-visa-required nationalities (excluding EEA, listed above). */
export const IRELAND_VISA_EXEMPT: readonly Iso2[] = [
  'AD', 'AG', 'AR', 'AU', 'BB', 'BN', 'BR', 'BS', 'BZ', 'CA', 'CL', 'CR', 'FJ', 'GB', 'GD', 'GT', 'GY', 'HK',
  'IL', 'JP', 'KI', 'KR', 'MC', 'MO', 'MV', 'MX', 'MY', 'NZ', 'PA', 'PY', 'SB', 'SC', 'SG', 'SM', 'SV', 'TO',
  'TV', 'TW', 'UA', 'AE', 'US', 'UY', 'VA', 'VC', 'WS',
  // British overseas territories citizens (listed as "Great Britain (UK) – Dependent citizen") and St Helena
  'AI', 'BM', 'IO', 'VG', 'KY', 'FK', 'GI', 'MS', 'PN', 'SH', 'TC',
];

/**
 * Codes whose residents hold another country's nationality. They follow that country's rules.
 * (French, Dutch, Danish, Finnish and Norwegian territories are EU/EEA; US, Australian and
 * New Zealand territories hold those passports; British overseas territories citizens are
 * Schengen visa-exempt under Annex II Part 3.)
 */
const TERRITORY_OF: Record<Iso2, Iso2 | 'BOT'> = {
  AX: 'FI', BL: 'FR', BQ: 'NL', AW: 'NL', CW: 'NL', SX: 'NL', FO: 'DK', GL: 'DK', GF: 'FR', GP: 'FR', MF: 'FR',
  MQ: 'FR', NC: 'FR', PF: 'FR', PM: 'FR', RE: 'FR', TF: 'FR', WF: 'FR', YT: 'FR', SJ: 'NO', BV: 'NO',
  AS: 'US', GU: 'US', MP: 'US', PR: 'US', UM: 'US', VI: 'US',
  CC: 'AU', CX: 'AU', HM: 'AU', NF: 'AU',
  CK: 'NZ', NU: 'NZ', TK: 'NZ',
  AI: 'BOT', BM: 'BOT', IO: 'BOT', VG: 'BOT', KY: 'BOT', FK: 'BOT', GI: 'BOT', MS: 'BOT', PN: 'BOT', SH: 'BOT',
  TC: 'BOT', GS: 'BOT',
  // Crown dependencies: British citizens
  GG: 'GB', IM: 'GB', JE: 'GB',
};

/** Codes with no nationals of their own; never offered as a nationality. */
export const NOT_A_NATIONALITY: readonly Iso2[] = ['AQ'];

const DE41: readonly Iso2[] = ['AU', 'IL', 'JP', 'CA', 'KR', 'NZ', 'GB', 'US'];
const DE41_NO_WORK: readonly Iso2[] = ['AD', 'BR', 'SV', 'HN', 'MC', 'SM'];
const MVV_EXEMPT: readonly Iso2[] = ['AU', 'CA', 'JP', 'MC', 'NZ', 'VA', 'GB', 'US', 'KR'];
const APS: readonly Iso2[] = ['CN', 'IN', 'VN'];

/** Nationalities with individually checked notes (the original 43 passports and the 2026 additions). */
export const FULL_COVERAGE: readonly Iso2[] = [
  'IN', 'CN', 'US', 'CA', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'DZ', 'CM', 'EG', 'GH', 'KE', 'MA', 'NG', 'SN',
  'ZA', 'TN', 'BD', 'ID', 'IR', 'JP', 'MY', 'NP', 'PK', 'PH', 'KR', 'LK', 'VN', 'KZ', 'RU', 'TR', 'UA', 'GB',
  'UZ', 'AR', 'AU', 'BR', 'CL', 'CO', 'MX',
];

export function flagsFor(code: Iso2): Flag[] {
  const t = TERRITORY_OF[code];
  if (t && t !== 'BOT') return flagsFor(t);
  if (EEA.includes(code)) return ['eea'];
  const flags: Flag[] = [];
  const schengenExempt = t === 'BOT' || SCHENGEN_VISA_EXEMPT.includes(code);
  if (!schengenExempt) flags.push('schengen_visa');
  if (!IRELAND_VISA_EXEMPT.includes(code)) flags.push('ireland_visa');
  if (code === 'GB') flags.push('cta');
  if (DE41.includes(code)) flags.push('de41');
  if (DE41_NO_WORK.includes(code)) flags.push('de41_no_work');
  if (MVV_EXEMPT.includes(code)) flags.push('mvv_exempt');
  if (APS.includes(code)) flags.push('aps');
  return flags;
}

export function buildNationalities(codes: readonly Iso2[], nameOf: (c: Iso2) => string): Nationality[] {
  return codes
    .filter((c) => !NOT_A_NATIONALITY.includes(c))
    .map((code) => ({
      code,
      name: nameOf(code),
      flags: flagsFor(code),
      coverage: FULL_COVERAGE.includes(code) ? 'full' : 'basic',
    }));
}
