import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const CONFIG_PATH = path.join(os.homedir(), '.openclaw-config.json');
function getBasePath(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).basePath;
  } catch {}
  return path.join(os.homedir(), 'Documents', 'KA_projektai');
}

// R2 S3-compatible client
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

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string | null> {
  try {
    const client = getR2Client();
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    if (!client || !bucket) return null;

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    // Return the R2 public URL via our proxy endpoint
    return `/api/r2?key=${encodeURIComponent(key)}`;
  } catch (err) {
    console.error('R2 upload error:', err);
    return null;
  }
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string;
    const subfolder = formData.get('subfolder') as string;

    if (!file || !projectName) return NextResponse.json({ error: 'Trūksta parametrų' }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const desiredName = formData.get('filename') as string | null;
    const baseNameNoExt = (desiredName
      ? desiredName.replace(/[/\\:*?"<>|]/g, '_')
      : path.basename(file.name, ext).replace(/[/\\:*?"<>|]/g, '_'));

    // Save locally (if running locally with filesystem access)
    let localPath = '';
    let finalName = baseNameNoExt + ext;
    try {
      const basePath = getBasePath();
      const safeName = projectName.replace(/[/\\:*?"<>|]/g, '_');
      const targetDir = path.join(basePath, safeName, subfolder ?? 'DOKUMENTAI');
      fs.mkdirSync(targetDir, { recursive: true });

      let counter = 2;
      while (fs.existsSync(path.join(targetDir, finalName))) {
        finalName = `${baseNameNoExt}_${counter}${ext}`;
        counter++;
      }
      localPath = path.join(targetDir, finalName);
      fs.writeFileSync(localPath, fileBuffer);
    } catch {
      // Running on Vercel / no local filesystem — skip local save
    }

    // Upload to R2
    const safeProjName = projectName.replace(/[/\\:*?"<>|]/g, '_');
    const r2Key = `${safeProjName}/${subfolder ?? 'DOKUMENTAI'}/${finalName}`;
    const r2Url = await uploadToR2(fileBuffer, r2Key, contentType);

    return NextResponse.json({
      success: true,
      path: localPath || r2Key,
      name: finalName,
      url: r2Url ?? undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
