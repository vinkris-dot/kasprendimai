import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const pExecFile = promisify(execFile);

// Aplankai kuriami pagal MB „KA sprendimai" standartą (žr. _STANDARTAI/INSTRUKCIJA.md):
// kopijuojama Tuscia_struktura, ištrinamos nereikalingų dalių direktorijos, įrašomas
// 00_projekto_duomenys.json ir paleidžiamas _STANDARTAI/04_Helpers/uzpildyti.js,
// kuris užpildo šablonus į <projektas>/_PARUOSTA_PERZIURAI/.

const CONFIG_PATH = path.join(os.homedir(), '.openclaw-config.json');
function getBasePath(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')).basePath;
  } catch {}
  return path.join(os.homedir(), 'Documents', 'KA_projektai');
}

const LT_MAP: Record<string, string> = {
  ą: 'a', č: 'c', ę: 'e', ė: 'e', į: 'i', š: 's', ų: 'u', ū: 'u', ž: 'z',
  Ą: 'A', Č: 'C', Ę: 'E', Ė: 'E', Į: 'I', Š: 'S', Ų: 'U', Ū: 'U', Ž: 'Z',
};
const beLietuvisku = (s: string) => s.replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, c => LT_MAP[c] ?? c);
const saugusVardas = (s: string) => beLietuvisku(s).replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

// Programos dalys → dalies aplanko prefiksas „02 - Projektas ir projekto dalys" viduje.
// 01 (PPP) ir 02 (PP) paliekami visada.
const PART_PREFIX: Record<string, string> = {
  BD: '03_', SP: '04_', SA: '05_', SK: '06_', LVN: '08_',
};
// Papildomų (custom) dalių pavadinimo atpažinimas → aplanko prefiksas
const CUSTOM_RULES: [RegExp, string][] = [
  [/technolog/, '07_'],
  [/svok|sildym|vedinim|kondicionav/, '09_'],
  [/silpn|rysi/, '11_'],
  [/gaisr.*signal/, '12_'],
  [/gaisr/, '13_'],
  [/elektr/, '10_'],
  [/organizav/, '14_'],
  [/kain/, '15_'],
];

function parseAdresas(address: string) {
  const dalys = address.split(',').map(d => d.trim()).filter(Boolean);
  const gatve = dalys[0] ?? '';
  const miestas = dalys.length > 1 ? dalys[dalys.length - 1] : '';
  const savDalis = dalys.find(d => /sav\.?$/i.test(d)) ?? miestas;
  return { gatve, miestas, sav: savDalis, vietove: dalys.slice(1).join(', ') };
}

export async function POST(req: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'Aplankas kuriamas tik kompiuteryje (lokaliai paleistoje programoje).' },
      { status: 501 },
    );
  }

  try {
    const body = await req.json();
    const address: string = body.address || body.projectName;
    if (!address) return NextResponse.json({ error: 'Trūksta adreso' }, { status: 400 });
    const parts: Record<string, boolean> = body.parts ?? {};
    const customParts: string[] = Array.isArray(body.customParts) ? body.customParts : [];

    const basePath = getBasePath();
    const folderName = saugusVardas(address);
    const projectPath = path.join(basePath, folderName);
    const standartai = path.join(basePath, '_STANDARTAI');
    const tuscia = path.join(standartai, '02_Sablonai', 'Tuscia_struktura', 'Adresas g. 0, Miestas');

    const jauBuvo = fs.existsSync(projectPath);
    if (!jauBuvo) {
      if (fs.existsSync(tuscia)) {
        fs.cpSync(tuscia, projectPath, {
          recursive: true,
          filter: src => !path.basename(src).startsWith('.DS_Store'),
        });
        // Nereikalingų dalių aplankai TRINAMI kuriant projektą (INSTRUKCIJA §3).
        // Trinama tik ką tik nukopijuota tuščia struktūra — esamų projektų neliečiam.
        const daliuDir = path.join(projectPath, '02 - Projektas ir projekto dalys');
        const laikomiPrefiksai = new Set(['01_', '02_']);
        for (const [pid, pref] of Object.entries(PART_PREFIX)) if (parts[pid]) laikomiPrefiksai.add(pref);
        for (const c of customParts) {
          const n = beLietuvisku(c).toLowerCase();
          for (const [re, pref] of CUSTOM_RULES) if (re.test(n)) { laikomiPrefiksai.add(pref); break; }
        }
        if (fs.existsSync(daliuDir)) {
          for (const d of fs.readdirSync(daliuDir, { withFileTypes: true })) {
            if (!d.isDirectory()) continue;
            const pref = d.name.slice(0, 3);
            if (!laikomiPrefiksai.has(pref)) fs.rmSync(path.join(daliuDir, d.name), { recursive: true });
          }
        }
      } else {
        // Atsarginis kelias, jei standartų aplanko nėra
        fs.mkdirSync(path.join(projectPath, '01 - Dokumentai'), { recursive: true });
        fs.mkdirSync(path.join(projectPath, '02 - Projektas ir projekto dalys'), { recursive: true });
      }
    }

    // 00_projekto_duomenys.json — šablonų pildymo šaltinis (nauji laukai iš formos).
    // Jei failas jau yra (galėjo būti pildytas ranka) — NEPERRAŠOMAS.
    const duomFile = path.join(projectPath, '00_projekto_duomenys.json');
    if (!fs.existsSync(duomFile)) {
      const { gatve, miestas, sav, vietove } = parseAdresas(address);
      const today = new Date().toISOString().slice(0, 10);
      const pu = body.pu ?? {};
      const duomenys: Record<string, string | null> = {
        _paaiskinimas: 'Sukurta iš KA sprendimai programos. null = nežinoma (šablonuose liks geltona PILDYTI). Papildyk ir paleisk: node _STANDARTAI/04_Helpers/uzpildyti.js "' + folderName + '"',
        PV: 'K. Vinčegova',
        PV_KVAL: 'A1822',
        STATYTOJAS: body.client || null,
        ADRESAS: address,
        GATVE: gatve || null,
        MIESTAS: miestas || null,
        VIETA: miestas || null,
        VIETOVE: vietove || null,
        SAV: sav || null,
        SAVIVALDYBE: sav || null,
        DATA: today,
        METAI: String(new Date().getFullYear()),
        PROJ_NR: body.projectNumber || null,
        SUTARTIES_NR: body.projectNumber || null,
        OBJEKTAS: pu.objektas || null,
        STATINYS: pu.objektas ? `${pu.objektas}, ${address}` : null,
        SKLYPO_PLOTAS: pu.sklypoPlotai || null,
        BENDR_PLOTAS: pu.bendrasPlotai || null,
        SKLYPO_UNIK_NR: null,
        // Įgaliojimo laukai — įgaliotinis pagal nutylėjimą M. Česnulis (direktorius)
        IGALIOTINIS: 'Mindaugą Česnulį',
        IGALIOTINIO_GIM: '1980-06-22',
        STATYTOJO_KODAS: null,
        STATYTOJO_ATSTOVAS: null,
        STATYTOJO_ATSTOVO_VARDAS: null,
        STATYTOJO_PAREIGOS: null,
        STATYTOJO_ADRESAS: null,
      };
      fs.writeFileSync(duomFile, JSON.stringify(duomenys, null, 2), 'utf-8');
    }

    // Šablonų užpildymas per uzpildyti.js (rašo į _PARUOSTA_PERZIURAI, projekto failų neliečia)
    let uzpildyta = 0;
    let uzpildymoKlaida: string | null = null;
    const helpersDir = path.join(standartai, '04_Helpers');
    if (fs.existsSync(path.join(helpersDir, 'uzpildyti.js'))) {
      try {
        const { stdout } = await pExecFile('node', ['uzpildyti.js', folderName], { cwd: helpersDir, timeout: 60_000 });
        uzpildyta = (stdout.match(/✓/g) ?? []).length;
      } catch (e: any) {
        uzpildymoKlaida = e.message?.slice(0, 300) ?? 'uzpildyti.js klaida';
      }
    }

    return NextResponse.json({
      success: true,
      path: projectPath,
      jauBuvo,
      uzpildyta,
      uzpildymoKlaida,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
