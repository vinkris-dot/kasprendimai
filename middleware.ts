import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const auth = req.cookies.get('ka_auth')?.value;
  const { pathname } = req.nextUrl;

  // Leisti prisijungimo puslapį ir API auth maršrutą
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Jei nėra sesijos — nukreipti į prisijungimą
  if (auth !== 'true') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
