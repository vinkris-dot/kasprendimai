import { NextRequest } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/localCors';
import fs from 'fs';
import path from 'path';
import { getBasePath, saugusVardas } from '@/lib/serverPaths';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';


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

// Produkcija didelius failus (>4,5 MB — Vercel riba) kelia per ŠĮ lokalų serverį
export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string;
    const address = formData.get('address') as string | null;
    const subfolder = formData.get('subfolder') as string;

    if (!file || !projectName) return corsJson({ error: 'Trūksta parametrų' }, 400);
    // Aplankas — pagal ADRESĄ ta pačia taisykle kaip „Sukurti aplanką" (saugusVardas),
    // kad failai kristų į standartinį projekto aplanką, o ne į dublikatą kitu vardu
    const folderName = saugusVardas(address || projectName);
    if (!folderName || folderName.includes('..')) return corsJson({ error: 'Netinkamas projekto aplanko vardas' }, 400);

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
      const targetDir = path.join(basePath, folderName, subfolder ?? '01 - Dokumentai');
      if (!path.resolve(targetDir).startsWith(path.resolve(basePath) + path.sep)) {
        throw new Error('Kelias už projektų aplanko ribų');
      }
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

    // Upload to R2 — tas pats aplanko vardas kaip diske
    const r2Key = `${folderName}/${subfolder ?? '01 - Dokumentai'}/${finalName}`;
    const r2Url = await uploadToR2(fileBuffer, r2Key, contentType);

    return corsJson({
      success: true,
      path: localPath || r2Key,
      name: finalName,
      url: r2Url ?? undefined,
    });
  } catch (err: any) {
    return corsJson({ error: err.message }, 500);
  }
}
