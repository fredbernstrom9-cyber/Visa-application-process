'use client';

import { Alert } from '@/components/ui/misc';
import { PremiumGate } from '@/components/app/upgrade';
import { useOrg } from '@/components/app/org-context';

export function ImportGate({ children }: { children: React.ReactNode }) {
  const { canWrite } = useOrg();
  if (!canWrite) return <Alert tone="warn" title="Read-only access">Viewers cannot import applicants. Ask an owner or admin to change your role.</Alert>;
  return <PremiumGate feature="import">{children}</PremiumGate>;
}
