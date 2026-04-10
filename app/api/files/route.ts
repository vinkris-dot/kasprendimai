import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path');
  if (!filePath) return NextResponse.json({ error: 'Nėra kelio' }, { status: 400 });

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Failas nerastas' }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.dwg': 'application/acad',
  };
  const contentType = contentTypes[ext] ?? 'application/octet-stream';

  try {
    const buffer = fs.readFileSync(filePath);
    // Convert Node Buffer → Uint8Array for NextResponse compatibility
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return new NextResponse(uint8, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Nepavyko perskaityti failo' }, { status: 500 });
  }
}
