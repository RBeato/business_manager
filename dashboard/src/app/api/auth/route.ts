import { NextResponse } from 'next/server';

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

async function signToken(password: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacSign(password, ts);
  return `${ts}.${sig}`;
}

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: 'DASHBOARD_PASSWORD not configured' },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const token = await signToken(expected);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('dashboard_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}
