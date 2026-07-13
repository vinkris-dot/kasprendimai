import { NextResponse } from 'next/server';

/**
 * Supabase „pažadinimas": lengva užklausa į duomenų bazę, kad nemokamas
 * planas neužmigdytų projekto po savaitės be aktyvumo.
 * Kviečiamas Vercel cron (žr. vercel.json) kartą per dieną.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'Supabase env nesukonfigūruotas' }, { status: 500 });
  }
  try {
    const res = await fetch(`${url}/rest/v1/projects?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    return NextResponse.json({ ok: res.ok, status: res.status, at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
