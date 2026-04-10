import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const correctPin = process.env.APP_PIN;

  if (!correctPin) {
    return NextResponse.json({ error: 'PIN nekonfigūruotas' }, { status: 500 });
  }

  if (pin !== correctPin) {
    return NextResponse.json({ error: 'Neteisingas PIN' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('ka_auth', 'true', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dienų
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('ka_auth');
  return res;
}
