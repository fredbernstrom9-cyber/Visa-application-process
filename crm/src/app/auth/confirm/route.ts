import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/actions/auth';
import { requestOrigin } from '@/lib/origin';

// Token-hash flow for e-mail templates that link to {{ .SiteURL }}/auth/confirm?token_hash=...&type=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = await safeNext(searchParams.get('next'));
  if (tokenHash && type) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${type === 'recovery' ? '/reset-password' : next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('That link is invalid or has expired. Please try again.')}`);
}
