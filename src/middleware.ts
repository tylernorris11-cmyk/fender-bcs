import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * A fresh nonce per request lets script-src stay strict ('self' plus only
 * scripts carrying this exact nonce) while still allowing the inline
 * <script> tags Next.js itself injects for streaming RSC payloads and
 * hydration — those get auto-nonced by Next once it sees the nonce in this
 * header, no per-component wiring needed since the app has no inline
 * <script> tags of its own (confirmed: no <script>, no dangerouslySetInnerHTML).
 * 'strict-dynamic' lets scripts Next.js's own nonced scripts load in turn
 * (its code-split chunks) run without each needing their own nonce.
 *
 * style-src keeps 'unsafe-inline': a handful of components set inline
 * style={{...}} (e.g. a user's colour tag), and nonce-ing style tags too
 * would need the same plumbing for comparatively little benefit — inline
 * *styles* aren't a script-execution risk the way inline *scripts* are.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  // Dev-mode's webpack HMR evals its own source maps — harmless locally,
  // but never shipped: this only relaxes script-src outside production.
  const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
