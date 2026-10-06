// Dated log of rule changes. Adding an entry and running `npm run rulebook:sync` notifies every
// organisation with open cases it affects (only for changes effective within the last 45 days,
// so importing history does not flood anyone). Never edit the id of a published change.
import type { Change } from './types';
import { SCHENGEN } from './guides/schengen-short-stay';

const ALL_SCHENGEN = [...SCHENGEN];

export const CHANGES: Change[] = [
  // ---- Carried over from the ClearEntry checker (May 2025 – August 2026) --------------------------
  { id: 'es-work-30h-2025', effectiveOn: '2025-05-20', destinations: ['ES'], routes: ['study'], severity: 'info', sources: ['es-sheet4bis'],
    summary: 'Spain: students may work up to 30 hours a week (Royal Decree 1155/2024 in force)' },
  { id: 'etias-fee-20-2025', effectiveOn: '2025-07-17', destinations: ALL_SCHENGEN, routes: ['short_stay'], severity: 'info', sources: ['etias-fee'],
    summary: 'Future ETIAS fee set at €20 (was €7)' },
  { id: 'id-cascade-2025', effectiveOn: '2025-07-23', destinations: ALL_SCHENGEN, routes: ['short_stay'], for: { in: ['ID'] }, severity: 'info', sources: ['eeas-indonesia'],
    summary: 'Indonesia: new Schengen visa cascade, 5-year multiple-entry visas after one visa' },
  { id: 'tr-cascade-2025', effectiveOn: '2025-07-29', destinations: ALL_SCHENGEN, routes: ['short_stay'], for: { in: ['TR'] }, severity: 'info', sources: ['ec-turkiye'],
    summary: 'Türkiye: new Schengen visa cascade' },
  { id: 'pl-b2-2025', effectiveOn: '2025-08-01', destinations: ['PL'], routes: ['study'], severity: 'action', sources: ['pl-b2'], rules: ['PL.study.language'],
    summary: 'Poland: students must prove B2 in the language of instruction' },
  { id: 'ees-rollout-2025', effectiveOn: '2025-10-12', destinations: ALL_SCHENGEN, routes: ['short_stay'], severity: 'info', sources: ['ees-full'],
    summary: 'Entry/Exit System (EES) starts its phased roll-out at Schengen borders' },
  { id: 'ru-single-entry-2025', effectiveOn: '2025-11-01', destinations: ALL_SCHENGEN, routes: ['short_stay'], for: { in: ['RU'] }, severity: 'action', sources: ['ec-russia'],
    summary: 'Russian citizens generally limited to single-entry Schengen visas' },
  { id: 'visa-suspension-2025', effectiveOn: '2025-12-30', destinations: ALL_SCHENGEN, routes: ['short_stay'], severity: 'info', sources: ['reg-2025-2441'],
    summary: 'Revised EU visa suspension mechanism in force (Regulation 2025/2441)' },
  { id: 'pl-visa-fee-2026', effectiveOn: '2026-01-01', destinations: ['PL'], routes: ['study'], severity: 'action', sources: ['pl-visa-fee-2026'],
    summary: 'Poland: national (D) visa fee rises from €135 to €200' },
  { id: 'nl-ind-fee-2026', effectiveOn: '2026-01-01', destinations: ['NL'], routes: ['study'], severity: 'info', sources: ['nl-ind-2026'],
    summary: 'Netherlands: IND study permit fee rises from €243 to €254' },
  { id: 'eu-visa-strategy-2026', effectiveOn: '2026-01-29', destinations: ALL_SCHENGEN, routes: ['short_stay', 'study'], severity: 'info', sources: ['ec-strategy'],
    summary: 'Commission adopts the first EU Visa Strategy, including measures for students' },
  { id: 'ie-trusted-2026', effectiveOn: '2026-02-01', destinations: ['IE'], routes: ['study'], severity: 'action', sources: ['ie-trusted'], rules: ['IE.study.eligible-course'],
    summary: 'Ireland: ILEP closed to new courses; providers need TrustEd Ireland authorisation to recruit non-EEA students' },
  { id: 'ees-full-2026', effectiveOn: '2026-04-10', destinations: ALL_SCHENGEN, routes: ['short_stay'], severity: 'info', sources: ['ees-full'],
    summary: 'EES fully operational at all external Schengen borders' },
  { id: 'fr-validation-fee-2026', effectiveOn: '2026-05-01', destinations: ['FR'], routes: ['study'], severity: 'action', sources: ['fr-sp-a18881'], rules: ['FR.study.validate'],
    summary: 'France: VLS-TS validation for students now €150 (was €75)' },
  { id: 'schengen-stats-2025', effectiveOn: '2026-05-28', destinations: ALL_SCHENGEN, routes: ['short_stay'], severity: 'info', sources: ['ec-stats-2025'],
    summary: '2025 Schengen statistics: over 12 million short-stay applications, 14.6% refused' },
  { id: 'it-funds-2026', effectiveOn: '2026-06-01', destinations: ['IT'], routes: ['study'], severity: 'action', sources: ['it-cons-ba-2026'], rules: ['IT.study.funds'],
    summary: 'Italy: student funds for 2026/27 raised to €10,179.85 a year (from €6,947.33)' },
  { id: 'se-student-rules-2026', effectiveOn: '2026-06-11', destinations: ['SE'], routes: ['study'], severity: 'action', sources: ['se-mv-rules'], rules: ['SE.study.address', 'SE.study.results'],
    summary: 'Sweden: 15-hour weekly work cap in term, minimum study results and address reporting' },
  { id: 'etias-no-date-2026', effectiveOn: '2026-07-01', destinations: ALL_SCHENGEN, routes: ['short_stay'], severity: 'info', sources: ['fragomen-etias'],
    summary: 'ETIAS: late-2026 target removed, no launch date yet' },
  { id: 'fr-funds-2026', effectiveOn: '2026-08-01', destinations: ['FR'], routes: ['study'], severity: 'action', sources: ['fr-decree-2026-526'], rules: ['FR.study.funds'],
    summary: 'France: student funds threshold rises from €615 to €877.50 a month (Decree 2026-526)' },

  // ---- Added October 2026 --------------------------------------------------------------------------
  { id: 'be-funds-2026', effectiveOn: '2026-02-01', destinations: ['BE'], routes: ['study'], severity: 'action', sources: ['be-belga-2026', 'be-checklist-2026'], rules: ['BE.study.funds'],
    summary: 'Belgium: student funds for 2026–27 rise to €1,062 a month (was €835)', detail: 'Announced in February 2026 for applications for the 2026–27 academic year.' },
  { id: 'ie-visa-ni-kn-lc-2026', effectiveOn: '2026-06-15', destinations: ['IE'], for: { in: ['NI', 'KN', 'LC'] }, severity: 'action', sources: ['ie-si-2026-242'],
    summary: 'Ireland: Nicaragua, Saint Kitts and Nevis and Saint Lucia now need a visa (also for transit)' },
  { id: 'nl-hsm-2026-h2', effectiveOn: '2026-07-01', destinations: ['NL'], routes: ['work'], severity: 'action', sources: ['nl-ind-amounts-2026'],
    summary: 'Netherlands: new highly skilled migrant and EU Blue Card salary thresholds (from €5,942 a month)' },
  { id: 'dk-jobseek-2026', effectiveOn: '2026-10-01', destinations: ['DK'], routes: ['study'], severity: 'info', sources: ['b-dnk'],
    summary: 'Denmark: shorter job-seeking permits (6 months or 1 year) for some degrees applied for from 1 October 2026' },
];
