import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Plan & billing' };

export default function Page() {
  return <p className="text-sm text-muted-foreground">Billing is configured in the final step.</p>;
}
