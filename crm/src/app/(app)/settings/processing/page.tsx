import type { Metadata } from 'next';
import { ProcessingSettings } from '@/components/settings/processing-settings';

export const metadata: Metadata = { title: 'Processing Settings' };

export default function Page() {
  return <ProcessingSettings />;
}
