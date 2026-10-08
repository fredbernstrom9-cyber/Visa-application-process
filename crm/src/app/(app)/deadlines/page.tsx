import type { Metadata } from 'next';
import { DeadlinesView } from '@/components/work/deadlines-view';

export const metadata: Metadata = { title: 'Deadlines' };

export default function DeadlinesPage() {
  return <DeadlinesView />;
}
