import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/actions/auth';
import { requestOrigin } from '@/lib/origin';

// PKCE flow: magic links, sign-up confirmation and password recovery land here with ?code=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
  const code = searchParams.get('code');
  const next = await safeNext(searchParams.get('next'));
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('That link is invalid or has expired. Please try again.')}`);
}
