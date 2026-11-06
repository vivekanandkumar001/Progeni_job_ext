import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const hasSupabaseConfiguration = Boolean(supabaseUrl && supabaseAnonKey);
const publicPaths = new Set(['/privacy', '/login', '/signup', '/reset-password', '/auth/callback', '/unauthorized', '/session-expired']);

function isPublicPath(pathname: string): boolean {
  return [...publicPaths].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function copyCookies(source: NextResponse, destination: NextResponse): void {
  for (const cookie of source.cookies.getAll()) {
    destination.cookies.set(cookie);
  }
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(header);
    if (value) destination.headers.set(header, value);
  }
  destination.headers.set('Cache-Control', 'private, no-store, max-age=0');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === '/health' ||
    pathname === '/api/v1' ||
    pathname.startsWith('/api/v1/')
  ) {
    return NextResponse.next();
  }
  if (isPublicPath(pathname)) return NextResponse.next();

  const isLocalDevelopment =
    process.env.NODE_ENV === 'development' && !supabaseUrl && !supabaseAnonKey;
  if (isLocalDevelopment) return NextResponse.next();

  if (!hasSupabaseConfiguration) {
    const signInUrl = new URL('/login', request.url);
    signInUrl.searchParams.set('error', 'configuration');
    const response = NextResponse.redirect(signInUrl);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  if (user) return response;

  const signInUrl = new URL('/login', request.url);
  signInUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  if (error) signInUrl.searchParams.set('error', 'verification');
  const redirect = NextResponse.redirect(signInUrl);
  copyCookies(response, redirect);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
