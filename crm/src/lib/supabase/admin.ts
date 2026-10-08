import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

/**
 * Service-role client. BYPASSES RLS -- use only in server code that has already
 * authorised the caller (portal token, Stripe webhook, cron, GDPR erasure).
 */
export function createSupabaseAdmin() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
