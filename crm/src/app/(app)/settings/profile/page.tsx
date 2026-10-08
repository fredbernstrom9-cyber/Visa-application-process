import type { Metadata } from 'next';
import { ProfileSettings } from '@/components/settings/profile-settings';

export const metadata: Metadata = { title: 'Profile Settings' };

export default function Page() {
  return <ProfileSettings />;
}
