import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CaseDetail } from '@/components/cases/case-detail';

export const metadata: Metadata = { title: 'Case' };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <CaseDetail caseId={id} />;
}
