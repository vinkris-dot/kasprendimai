import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_PATH = path.join(os.homedir(), '.openclaw-config.json');
function getBasePath(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).basePath;
  } catch {}
  return path.join(os.homedir(), 'Documents', 'KA_projektai');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string;
    const subfolder = formData.get('subfolder') as string;

    if (!file || !projectName) return NextResponse.json({ error: 'Trūksta parametrų' }, { status: 400 });

    const basePath = getBasePath();
    const safeName = projectName.replace(/[/\\:*?"<>|]/g, '_');
    const targetDir = path.join(basePath, safeName, subfolder ?? 'DOKUMENTAI');
    fs.mkdirSync(targetDir, { recursive: true });

    const desiredName = formData.get('filename') as string | null;
    const ext = path.extname(file.name);
    const baseNameNoExt = (desiredName
      ? desiredName.replace(/[/\\:*?"<>|]/g, '_')
      : path.basename(file.name, ext).replace(/[/\\:*?"<>|]/g, '_'));

    // If file exists, append _2, _3, etc.
    let finalName = baseNameNoExt + ext;
    let counter = 2;
    while (fs.existsSync(path.join(targetDir, finalName))) {
      finalName = `${baseNameNoExt}_${counter}${ext}`;
      counter++;
    }
    const filePath = path.join(targetDir, finalName);
    fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ success: true, path: filePath, name: finalName });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
