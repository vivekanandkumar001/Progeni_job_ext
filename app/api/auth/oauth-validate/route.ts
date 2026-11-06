import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      return NextResponse.json(
        { ok: false, error: 'A valid HTTPS authorization URL is required.' },
        { status: 400 }
      );
    }

    // Fetch the Supabase authorize URL server-side (no browser CORS restrictions)
    const probe = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Progeni-OAuth-Probe/1.0',
      },
    });

    // Supabase returns 400 validation_failed if the provider is disabled in Supabase dashboard
    if (probe.status === 400) {
      const probeJson = await probe.json().catch(() => null);
      if (
        probeJson?.error_code === 'validation_failed' ||
        probeJson?.msg?.includes('provider is not enabled')
      ) {
        return NextResponse.json({
          ok: false,
          error:
            'Google Sign-in is not enabled in this Supabase project (Authentication → Providers → Google). Please use Email & Password below.',
        });
      }
      return NextResponse.json({
        ok: false,
        error: probeJson?.msg || 'Social authentication is not configured for this provider.',
      });
    }

    // Status 302, 303 (redirect to accounts.google.com) or 200 means provider is active
    return NextResponse.json({ ok: true });
  } catch {
    // If validation probe fails for network reasons, allow fallback to direct URL
    return NextResponse.json({ ok: true });
  }
}

