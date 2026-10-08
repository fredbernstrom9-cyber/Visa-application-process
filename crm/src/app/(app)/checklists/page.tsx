import type { Metadata } from 'next';
import { TemplatesView } from '@/components/checklists/templates-view';

export const metadata: Metadata = { title: 'Checklists' };

export default function ChecklistsPage() {
  return <TemplatesView />;
}
