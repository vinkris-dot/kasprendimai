import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

function getR2Client(): S3Client | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.dwg': 'application/acad',
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'Nėra rakto' }, { status: 400 });

  const client = getR2Client();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!client || !bucket) return NextResponse.json({ error: 'R2 nekonfigūruotas' }, { status: 500 });

  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bodyArray = await response.Body?.transformToByteArray();
    if (!bodyArray) return NextResponse.json({ error: 'Tuščias failas' }, { status: 404 });
    const body = new Uint8Array(bodyArray.buffer, bodyArray.byteOffset, bodyArray.byteLength);

    const ext = path.extname(key).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    const filename = path.basename(key);

    return new NextResponse(body as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
