import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateEditor } from '@/components/checklists/template-editor';

export const metadata: Metadata = { title: 'Checklist template' };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'new' && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <TemplateEditor id={id} />;
}
