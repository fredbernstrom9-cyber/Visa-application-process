import type { Metadata } from 'next';
import { OrgSettings } from '@/components/settings/org-settings';

export const metadata: Metadata = { title: 'Org Settings' };

export default function Page() {
  return <OrgSettings />;
}
