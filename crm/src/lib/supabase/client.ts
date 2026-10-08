'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Browser client (anon key + the signed-in user's JWT). All access is governed by RLS. */
export function getSupabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}
