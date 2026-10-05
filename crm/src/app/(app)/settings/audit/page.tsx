import type { Metadata } from 'next';
import { AuditLog } from '@/components/settings/audit-log';

export const metadata: Metadata = { title: 'Audit Log' };

export default function Page() {
  return <AuditLog />;
}
