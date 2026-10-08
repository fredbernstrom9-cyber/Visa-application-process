import type { Metadata } from 'next';
import { MyTasksView } from '@/components/work/my-tasks-view';

export const metadata: Metadata = { title: 'My tasks' };

export default function TasksPage() {
  return <MyTasksView />;
}
