import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { isAllowedPath } from '@/lib/serverPaths';

// SAUGIKLIS: trinti leidžiama TIK projektų aplankų viduje (žr. lib/serverPaths.ts).
// Anksčiau maršrutas ištrindavo bet kokį kliento atsiųstą kelią.

export async function POST(req: NextRequest) {
  try {
    const { path: filePath } = await req.json();
    if (!filePath) return NextResponse.json({ error: 'Nėra kelio' }, { status: 400 });
    if (!isAllowedPath(filePath)) {
      return NextResponse.json({ error: 'Kelias už projektų aplanko ribų' }, { status: 403 });
    }
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
