import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_PATH = path.join(os.homedir(), '.openclaw-config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {}
  return { basePath: path.join(os.homedir(), 'Documents', 'KA_projektai') };
}

function writeConfig(config: object) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function GET() {
  const config = readConfig();
  // Auto-create default folder if it doesn't exist
  if (!fs.existsSync(config.basePath)) {
    fs.mkdirSync(config.basePath, { recursive: true });
  }
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = { ...readConfig(), ...body };
  writeConfig(config);
  if (!fs.existsSync(config.basePath)) {
    fs.mkdirSync(config.basePath, { recursive: true });
  }
  return NextResponse.json(config);
}
