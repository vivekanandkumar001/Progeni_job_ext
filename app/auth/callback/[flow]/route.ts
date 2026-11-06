import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const flow = request.nextUrl.pathname.split('/').pop();
  if (flow !== 'signup' && flow !== 'recovery' && flow !== 'login') {
    return new NextResponse('Not found', { status: 404 });
  }

  const code = request.nextUrl.searchParams.get('code');
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const typeParam = request.nextUrl.searchParams.get('type');
  const type = (typeParam || (flow === 'recovery' ? 'recovery' : 'signup')) as EmailOtpType;

  if (!code && !token_hash) {
    return NextResponse.redirect(new URL('/login?error=callback', request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login?error=configuration', request.url));
  }

  const destination = flow === 'recovery' ? '/reset-password?mode=update' : '/dashboard';
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  let authError: unknown = null;
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    authError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  }

  if (authError) {
    const signInUrl = new URL('/login', request.url);
    signInUrl.searchParams.set('error', 'callback');
    const redirect = NextResponse.redirect(signInUrl);
    redirect.headers.set('Cache-Control', 'private, no-store, max-age=0');
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
