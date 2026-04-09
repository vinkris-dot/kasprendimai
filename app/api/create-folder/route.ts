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

const FOLDERS = [
  'DOKUMENTAI/01_PROJEKTAVIMO_UZDUOTIS',
  'DOKUMENTAI/02_SKLYPAS_IR_TEISE',
  'DOKUMENTAI/03_TERITORIJU_PLANAVIMAS',
  'DOKUMENTAI/04_PRADINIAI_DUOMENYS',
  'DOKUMENTAI/05_PRISIJUNGIMO_SALYGOS_IR_SR',
  'DOKUMENTAI/99_ARCHYVAS',
];
const PP_FOLDERS = [
  '01_PP/01_PP_BYLA/01_DOKUMENTAI',
  '01_PP/01_PP_BYLA/02_AISKINAMIEJI_RASTAI',
  '01_PP/01_PP_BYLA/03_PDF',
  '01_PP/02_DARBINIAI_BREZINIAI',
  '01_PP/03_VIZUALIZACIJOS',
  '01_PP/04_DERINIMAI_IR_PASTABOS',
  '01_PP/99_ARCHYVAS',
];
const SLD_FOLDERS = [
  '02_SLD/01_PATEIKIMAS',
  '02_SLD/02_ADOC_PP',
  '02_SLD/03_PASTABOS_IR_ATSAKYMAI',
  '02_SLD/04_ISDUOTAS_SLD',
  '02_SLD/99_ARCHYVAS',
];
const TDP_FOLDERS = [
  '03_TDP/01_TDP_BYLA',
  '03_TDP/02_BREZINIAI_IR_MODELIAI',
  '03_TDP/03_SKAICIAVIMAI',
  '03_TDP/04_DERINIMAI',
  '03_TDP/05_STATYBOS_PRADZIA',
  '03_TDP/99_ARCHYVAS',
];

export async function POST(req: NextRequest) {
  try {
    const { projectName, parts } = await req.json();
    if (!projectName) return NextResponse.json({ error: 'Trūksta projectName' }, { status: 400 });

    const basePath = getBasePath();
    const safeName = projectName.replace(/[/\\:*?"<>|]/g, '_');
    const projectPath = path.join(basePath, safeName);

    const allFolders = [
      ...FOLDERS,
      ...(parts?.PP ? PP_FOLDERS : []),
      ...(parts?.SLD ? SLD_FOLDERS : []),
      ...(parts?.TDP ? TDP_FOLDERS : []),
    ];

    for (const folder of allFolders) {
      fs.mkdirSync(path.join(projectPath, folder), { recursive: true });
    }

    return NextResponse.json({ success: true, path: projectPath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
