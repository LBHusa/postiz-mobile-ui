import { NextRequest, NextResponse } from 'next/server';

/**
 * Mobile-UA-Detection Middleware
 *
 * Redirected Mobile-User auf /m/kalender wenn sie auf Desktop-Default-Routes landen.
 * - Cookie `mobile_optout=1` deaktiviert die Redirect (User hat explizit "Desktop"
 *   gewaehlt — z.B. via `?desktop=1` Query-Param)
 * - Trigger-Routes: `/` (root), `/launches` (Postiz Desktop-Calendar)
 * - Bei `/m/*`, `/auth/*`, API-Routes, statischen Assets: kein Redirect
 *
 * UA-Detection: einfache Regex auf User-Agent-Header. Reicht fuer iPhone/Android-Standard;
 * Edge-Cases (Tablet) bleiben Desktop. Wer expliziten Switch will, nutzt
 * `?desktop=1` (setzt Cookie) oder `?mobile=1` (entfernt Cookie).
 */

const MOBILE_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;

const MOBILE_REDIRECT_PATHS = new Set<string>([
  '/',
  '/launches',
]);

const MOBILE_TARGET = '/m/kalender';

const COOKIE_OPTOUT = 'mobile_optout';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (searchParams.has('desktop')) {
    const response = NextResponse.next();
    response.cookies.set(COOKIE_OPTOUT, '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }
  if (searchParams.has('mobile')) {
    const response = NextResponse.next();
    response.cookies.delete(COOKIE_OPTOUT);
    return response;
  }

  if (request.cookies.get(COOKIE_OPTOUT)?.value === '1') {
    return NextResponse.next();
  }

  if (!MOBILE_REDIRECT_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get('user-agent') || '';
  if (!MOBILE_REGEX.test(userAgent)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = MOBILE_TARGET;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/',
    '/launches',
  ],
};
