import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function hmacSign(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyToken(token: string, password: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [ts, sig] = parts;
  if (!ts || !sig) return false;

  const age = Math.floor(Date.now() / 1000) - parseInt(ts, 10);
  if (isNaN(age) || age > 60 * 60 * 24 * 30) return false;

  const expected = await hmacSign(password, ts);
  return sig === expected;
}

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/api/auth'
  ) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  const authCookie = request.cookies.get('dashboard_auth');

  if (password && authCookie && (await verifyToken(authCookie.value, password))) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
