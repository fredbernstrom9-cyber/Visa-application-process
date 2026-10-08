// Small builders that keep the guide files readable.
import type { Confidence, Fact, FactKind, Rule, Target } from '../types';

interface RuleOpts { detail?: string; due?: number; for?: Target; optional?: boolean }

export function doc(key: string, label: string, sources: string[], conf: Confidence, o: RuleOpts = {}): Rule {
  return { key, kind: 'document', label, detail: o.detail, dueDaysBeforeStart: o.due, for: o.for, optional: o.optional, sources, conf };
}

export function step(key: string, label: string, sources: string[], conf: Confidence, o: RuleOpts = {}): Rule {
  return { key, kind: 'step', label, detail: o.detail, dueDaysBeforeStart: o.due, for: o.for, optional: o.optional, sources, conf };
}

export function fact(
  key: string, kind: FactKind, label: string, value: string, sources: string[], conf: Confidence,
  o: { eur?: number; for?: Target } = {},
): Fact {
  return { key, kind, label, value, amountEur: o.eur, for: o.for, sources, conf };
}

/** Approximate rates used only to show non-euro amounts in euros. */
export const FX = { SEK: 11.0, PLN: 4.25, CZK: 25.0, HUF: 395, RON: 5.05, BGN: 1.95583, DKK: 7.46, CHF: 0.94, NOK: 11.7, ISK: 145 };
export const eur = (amount: number, cur: keyof typeof FX) => Math.round((amount / FX[cur]) * 100) / 100;

// Days before the start date, for suggested due dates.
export const MONTHS = (m: number) => Math.round(m * 30);
