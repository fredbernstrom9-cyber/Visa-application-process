'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { signOutAction } from '@/lib/actions/auth';

export function SignOutButton({ variant = 'outline', size, children }: { variant?: ButtonProps['variant']; size?: ButtonProps['size']; children?: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <Button variant={variant} size={size} loading={pending} onClick={() => start(async () => { await signOutAction(); })}>
      <LogOut /> {children ?? 'Sign out'}
    </Button>
  );
}
