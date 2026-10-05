'use client';

import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { createOrganizationAction } from '@/lib/actions/org';

export function CreateOrgForm() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createOrganizationAction({ name });
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Organisation name" htmlFor="org" hint="Your university, business school or agency. You can rename it later.">
        <Input id="org" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northbridge Business School" autoFocus />
      </Field>
      <Button type="submit" loading={pending}>Create organisation</Button>
    </form>
  );
}
