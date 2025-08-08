import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROOTS = new Set<string>(['/']);
const SESSION_COOKIE = 'accend_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname.startsWith('/assets')) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (pathname === '/login' || pathname === '/signup') {
    if (hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (PUBLIC_ROOTS.has(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}; 