import type { Metadata } from 'next';
import { OwnerAccess } from '@/components/auth/owner-access';

export const metadata: Metadata = { title: 'Owner access', robots: { index: false, follow: false } };

export default function OwnerAccessPage() {
  return <OwnerAccess />;
}
