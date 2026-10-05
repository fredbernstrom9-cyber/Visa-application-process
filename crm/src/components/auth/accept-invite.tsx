'use client';

import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { acceptInvitationAction } from '@/lib/actions/org';

export function AcceptInvite({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button
        loading={pending}
        onClick={() => start(async () => {
          const res = await acceptInvitationAction(token);
          if (res && !res.ok) setError(res.error);
        })}
      >
        Accept and join
      </Button>
    </div>
  );
}
