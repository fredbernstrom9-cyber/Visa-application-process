import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ActivityView } from '@/components/work/activity-view';

export const metadata: Metadata = { title: 'Live activity' };

export default function ActivityPage() {
  return <Suspense><ActivityView /></Suspense>;
}
