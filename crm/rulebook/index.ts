// The assembled ClearEntry rulebook.
import { COUNTRY_CODES, countryName } from '../src/lib/countries';
import { CHANGES } from './changes';
import { compileRulebook, type CompiledRulebook } from './compile';
import { DE } from './guides/de';
import { ES } from './guides/es';
import { EU_ROUTES } from './guides/eu-routes';
import { EU_STUDY } from './guides/eu-study';
import { FR } from './guides/fr';
import { IE } from './guides/ie';
import { IT } from './guides/it';
import { MISSION_SOURCES, withMissions } from './guides/missions';
import { NL } from './guides/nl';
import { PL } from './guides/pl';
import { SCHENGEN_SHORT_STAY } from './guides/schengen-short-stay';
import { SE } from './guides/se';
import { buildNationalities } from './nationalities';
import { SOURCES } from './sources';
import type { Guide } from './types';

/** Date the rulebook as a whole was last checked against its sources. */
export const VERIFIED_ON = '2026-10-06';

export const GUIDES: Guide[] = withMissions([
  ...FR, ...DE, ...NL, ...ES, ...IT, ...IE, ...PL, ...SE,
  ...EU_STUDY,
  ...SCHENGEN_SHORT_STAY,
  ...EU_ROUTES,
]);

export const ALL_SOURCES = { ...SOURCES, ...MISSION_SOURCES };

export function buildRulebook(today = new Date().toISOString().slice(0, 10)): CompiledRulebook {
  return compileRulebook({
    verifiedOn: VERIFIED_ON,
    sources: ALL_SOURCES,
    nationalities: buildNationalities(COUNTRY_CODES, countryName),
    guides: GUIDES,
    changes: CHANGES,
    validCodes: COUNTRY_CODES,
    today,
  });
}
