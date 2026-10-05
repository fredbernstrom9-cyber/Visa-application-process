import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ImportWizard } from '@/components/applicants/import-wizard';
import { ImportGate } from '@/components/applicants/import-gate';
import { PageHeader } from '@/components/app/page-header';

export const metadata: Metadata = { title: 'Import applicants' };

export default function ImportPage() {
  return (
    <>
      <Link href="/applicants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Applicants</Link>
      <PageHeader title="Import applicants" description="Bring in a spreadsheet: we match your columns, validate every row and show a preview before anything is saved." />
      <ImportGate><ImportWizard /></ImportGate>
    </>
  );
}
