import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata = { title: 'Setup required' };

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect('/login');
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <Brand />
      <h1 className="text-2xl font-semibold tracking-tight">Connect your Supabase project</h1>
      <p className="text-muted-foreground">
        The app is running but has no backend yet. Copy <code className="rounded bg-muted px-1">.env.example</code> to{' '}
        <code className="rounded bg-muted px-1">.env.local</code>, fill in the Supabase values, apply the migrations and restart the server.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Create a project at supabase.com and copy its URL, anon key and service-role key.</li>
        <li>Run <code className="rounded bg-muted px-1">supabase link</code> then <code className="rounded bg-muted px-1">supabase db push</code> to apply <code className="rounded bg-muted px-1">supabase/migrations</code>.</li>
        <li>Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code>.</li>
        <li>Restart <code className="rounded bg-muted px-1">npm run dev</code>. The README has the full guide.</li>
      </ol>
    </main>
  );
}
