const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'gh_src',
  'lever-source',
  'lever-origin',
  'source',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_eid',
  'sessionId',
  'session',
  'trk',
  'trackingId',
]);

/**
 * Normalizes an application or job URL to its canonical form:
 * - Strips marketing & attribution tracking query parameters
 * - Strips URL fragments (#)
 * - Normalizes scheme and host to lowercase
 * - Removes redundant trailing slashes
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);

    // Filter out tracking parameters
    const cleanedParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!TRACKING_PARAMS.has(key.toLowerCase()) && !key.toLowerCase().startsWith('utm_')) {
        cleanedParams.append(key, value);
      }
    }

    parsed.search = cleanedParams.toString() ? `?${cleanedParams.toString()}` : '';
    parsed.hash = '';

    // Remove trailing slash from pathname if length > 1
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    // If not a valid standard URL, return sanitized string without tracking tokens
    return trimmed.split('?')[0].replace(/\/+$/, '');
  }
}

