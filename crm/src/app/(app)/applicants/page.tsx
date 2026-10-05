import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicantsView } from '@/components/applicants/applicants-view';

export const metadata: Metadata = { title: 'Applicants' };

export default function ApplicantsPage() {
  return (
    <Suspense>
      <ApplicantsView />
    </Suspense>
  );
}
