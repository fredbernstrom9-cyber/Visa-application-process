'use client';

import { UpgradeCard } from '@/components/app/upgrade';
import type { CaseRow } from '@/lib/types';

// Replaced with the full implementation in the applicant-portal step.
export function CasePortal({ canPortal }: { caseRow: CaseRow; canPortal: boolean }) {
  if (!canPortal) return <UpgradeCard feature="portal" />;
  return null;
}
