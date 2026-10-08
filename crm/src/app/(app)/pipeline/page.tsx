import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PipelineView } from '@/components/pipeline/pipeline-view';

export const metadata: Metadata = { title: 'Pipeline' };

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineView />
    </Suspense>
  );
}
