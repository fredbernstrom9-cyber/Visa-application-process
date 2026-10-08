// ISO 3166-1 alpha-2 codes (+ XK, widely used for Kosovo). Names come from Intl.DisplayNames so
// there is no large static name table to maintain.
const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');

export const COUNTRY_CODES: readonly string[] = CODES;

let displayNames: Intl.DisplayNames | null = null;
const nameCache = new Map<string, string>();

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  const c = code.trim().toUpperCase();
  const hit = nameCache.get(c);
  if (hit) return hit;
  if (c === 'XK') return 'Kosovo';
  try {
    displayNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    const n = displayNames.of(c) ?? c;
    nameCache.set(c, n);
    return n;
  } catch {
    return c;
  }
}

export interface CountryOption { code: string; name: string }

let allOptions: CountryOption[] | null = null;
export function countryOptions(): CountryOption[] {
  allOptions ??= CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
  return allOptions;
}

/** EU member states plus the four non-EU Schengen states. `schengen` marks full Schengen membership. */
export const DESTINATIONS: readonly { code: string; schengen: boolean }[] = [
  ['AT', true], ['BE', true], ['BG', true], ['HR', true], ['CY', false], ['CZ', true], ['DK', true], ['EE', true],
  ['FI', true], ['FR', true], ['DE', true], ['GR', true], ['HU', true], ['IE', false], ['IT', true], ['LV', true],
  ['LT', true], ['LU', true], ['MT', true], ['NL', true], ['PL', true], ['PT', true], ['RO', true], ['SK', true],
  ['SI', true], ['ES', true], ['SE', true], ['IS', true], ['LI', true], ['NO', true], ['CH', true],
].map(([code, schengen]) => ({ code: code as string, schengen: schengen as boolean }));

export const DESTINATION_CODES: readonly string[] = DESTINATIONS.map((d) => d.code);

let destOptions: CountryOption[] | null = null;
export function destinationOptions(): CountryOption[] {
  destOptions ??= DESTINATIONS.map((d) => ({ code: d.code, name: countryName(d.code) })).sort((a, b) => a.name.localeCompare(b.name));
  return destOptions;
}

export function isDestination(code: string | null | undefined): boolean {
  return !!code && DESTINATION_CODES.includes(code.toUpperCase());
}

export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code) || code.toUpperCase() === 'XK') return '';
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
}

// ---------------------------------------------------------------------------
// Free-text matching for imports ("India", "IN", "Indian", "UK", "Türkiye" ...)
// ---------------------------------------------------------------------------
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

const ALIASES: Record<string, string> = {
  usa: 'US', 'u s a': 'US', 'u s': 'US', america: 'US', 'united states of america': 'US',
  uk: 'GB', 'u k': 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  'czech republic': 'CZ', turkey: 'TR', 'russian federation': 'RU', 'south korea': 'KR', 'korea republic of': 'KR',
  'republic of korea': 'KR', korea: 'KR', 'north korea': 'KP', 'ivory coast': 'CI', 'cote d ivoire': 'CI', burma: 'MM',
  uae: 'AE', emirates: 'AE', holland: 'NL', 'the netherlands': 'NL', vietnam: 'VN', 'viet nam': 'VN',
  'iran islamic republic of': 'IR', iran: 'IR', syria: 'SY', palestine: 'PS', macedonia: 'MK', 'north macedonia': 'MK',
  swaziland: 'SZ', eswatini: 'SZ', 'cape verde': 'CV', drc: 'CD', 'dr congo': 'CD', 'democratic republic of the congo': 'CD',
  'congo kinshasa': 'CD', 'republic of the congo': 'CG', 'congo brazzaville': 'CG', taiwan: 'TW', 'hong kong': 'HK',
  laos: 'LA', moldova: 'MD', bolivia: 'BO', venezuela: 'VE', tanzania: 'TZ', brunei: 'BN', 'east timor': 'TL',
  kosovo: 'XK', 'russia': 'RU', 'bosnia': 'BA', 'trinidad': 'TT',
};

const DEMONYMS: Record<string, string> = {
  indian: 'IN', chinese: 'CN', american: 'US', canadian: 'CA', nigerian: 'NG', pakistani: 'PK', bangladeshi: 'BD',
  vietnamese: 'VN', filipino: 'PH', philippine: 'PH', indonesian: 'ID', turkish: 'TR', russian: 'RU', ukrainian: 'UA',
  kazakh: 'KZ', kazakhstani: 'KZ', uzbek: 'UZ', egyptian: 'EG', moroccan: 'MA', algerian: 'DZ', tunisian: 'TN',
  kenyan: 'KE', ghanaian: 'GH', 'south african': 'ZA', brazilian: 'BR', mexican: 'MX', colombian: 'CO',
  argentinian: 'AR', argentine: 'AR', chilean: 'CL', peruvian: 'PE', iranian: 'IR', iraqi: 'IQ', saudi: 'SA',
  emirati: 'AE', qatari: 'QA', kuwaiti: 'KW', omani: 'OM', bahraini: 'BH', jordanian: 'JO', lebanese: 'LB',
  israeli: 'IL', nepali: 'NP', nepalese: 'NP', 'sri lankan': 'LK', malaysian: 'MY', thai: 'TH', japanese: 'JP',
  korean: 'KR', australian: 'AU', 'new zealander': 'NZ', british: 'GB', ethiopian: 'ET', cameroonian: 'CM',
  senegalese: 'SN', tanzanian: 'TZ', ugandan: 'UG', zimbabwean: 'ZW', zambian: 'ZM', serbian: 'RS', albanian: 'AL',
  georgian: 'GE', armenian: 'AM', azerbaijani: 'AZ', belarusian: 'BY', moldovan: 'MD', afghan: 'AF', syrian: 'SY',
  sudanese: 'SD', somali: 'SO', rwandan: 'RW', angolan: 'AO', mozambican: 'MZ', ivorian: 'CI', malian: 'ML',
  singaporean: 'SG', cuban: 'CU', venezuelan: 'VE', ecuadorian: 'EC', bolivian: 'BO', uruguayan: 'UY', paraguayan: 'PY',
};

let nameIndex: Map<string, string> | null = null;
function index() {
  if (nameIndex) return nameIndex;
  const m = new Map<string, string>();
  for (const code of CODES) m.set(norm(countryName(code)), code);
  for (const [k, v] of Object.entries(ALIASES)) m.set(norm(k), v);
  for (const [k, v] of Object.entries(DEMONYMS)) m.set(norm(k), v);
  nameIndex = m;
  return m;
}

/** Returns an ISO alpha-2 code for a free-text country / nationality value, or null. */
export function matchCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw) && CODES.includes(raw.toUpperCase())) return raw.toUpperCase();
  return index().get(norm(raw)) ?? null;
}
