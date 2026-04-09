import { NextRequest, NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, UnderlineType,
} from 'docx';

interface PUData {
  // Project info
  projectName: string;
  address: string;
  client: string;
  clientEmail: string;
  startDate: string;
  // PU fields
  objektas: string;
  statybosRusis: string;
  bendrasPlotai: string;
  sklypoPlotai: string;
  zemesPaskirtis: string;
  telefonas: string;
  // Parts
  hasPP: boolean;
  hasSLD: boolean;
  hasTDP: boolean;
  hasBD: boolean;
  hasLVN: boolean;
  // Priorities
  prioritetai: Record<string, number>;
  // Functional
  virtuveTipas: string;
  bendrosErdvesDydis: string;
  bendrosErdvesDydisKita: string;
  lubosAukstis: string;
  lubosAukstisKitas: string;
  sandeliukasPrieVirtuve: boolean;
  vaikusKambariuSk: number;
  darbKambarys: string;
  drabuzine: string;
  tevisSmaz: string;
  bendrasVonios: string;
  papildomasWC: boolean;
  techPatalpa: boolean;
  skalbykla: string;
  garazasAutoSk: number;
  garazasSprendimas: string;
  kitosPatalpos: string;
  // Architectural
  pastatoCharakteris: string;
  pastatoCharakterisKita: string;
  stogasTipas: string;
  fasadai: string[];
  fasadaiKita: string;
}

const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDER_THIN = { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' };

function ch(checked: boolean) {
  return checked ? '☑' : '☐';
}

function cell(text: string, opts: { bold?: boolean; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; shade?: boolean } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { fill: 'F0F0F0' } : undefined,
    borders: { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN },
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold ?? false, size: 20 })],
    })],
  });
}

function labelCell(text: string) {
  return cell(text, { bold: true, shade: true, width: 40 });
}

function valueCell(text: string) {
  return cell(text, { width: 60 });
}

function row2(label: string, value: string) {
  return new TableRow({ children: [labelCell(label), valueCell(value)] });
}

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function subheading(text: string) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: '555555' })],
  });
}

function twoColTable(rows: TableRow[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function priorityLabel(val: number) {
  return val > 0 ? String(val) : '—';
}

function virtuveTipasLabel(v: string) {
  return v === 'atvira' ? 'Atvira' : v === 'pusiau_atvira' ? 'Pusiau atvira' : v === 'uzdara' ? 'Uždara' : '—';
}
function erdvesLabel(v: string, kita: string) {
  if (v === 'vidutine') return '~45–50 m²';
  if (v === 'erdvi') return '~50–60 m²';
  if (v === 'labai_erdvi') return '60 m²+';
  if (v === 'kita') return kita || 'Kita';
  return '—';
}
function lubosLabel(v: string, kitas: string) {
  if (v === 'standartinis') return '~2,80–3,00 m';
  if (v === 'padidintas') return '~3,20–3,40 m';
  if (v === 'dvieju_aukstu') return 'Dviejų aukštų';
  if (v === 'kitas') return kitas || 'Kitas';
  return '—';
}
function darbLabel(v: string) {
  if (v === 'reikalingas') return 'Reikalingas';
  if (v === 'universali') return 'Universali patalpa';
  if (v === 'nereikalingas') return 'Nereikalingas';
  return '—';
}
function drabuzineLabel(v: string) {
  if (v === 'atskira') return 'Atskira';
  if (v === 'miegamojo') return 'Miegamojo patalpoje';
  if (v === 'nenumatoma') return 'Nenumatoma';
  return '—';
}
function smazLabel(v: string) {
  if (v === 'su_dusu') return 'Su dušu';
  if (v === 'su_vonia') return 'Su vonia';
  if (v === 'ne') return 'Ne';
  return '—';
}
function voniaLabel(v: string) {
  if (v === 'su_vonia') return 'Su vonia';
  if (v === 'su_dusu') return 'Su dušu';
  return '—';
}
function skalbyklaLabel(v: string) {
  if (v === 'atskira') return 'Atskira patalpa';
  if (v === 'technine') return 'Techninėje patalpoje';
  return '—';
}
function garazasLabel(v: string) {
  if (v === 'integruotas') return 'Integruotas';
  if (v === 'atskiras') return 'Atskiras';
  if (v === 'stogine') return 'Stoginė';
  if (v === 'projektuojant') return 'Sprendžiama projektavimo metu';
  return '—';
}
function charakterisLabel(v: string, kita: string) {
  if (v === 'siuolaikinis') return 'Šiuolaikinis';
  if (v === 'tradicinis') return 'Tradicinis';
  if (v === 'kita') return kita || 'Kita';
  return '—';
}
function stogasLabel(v: string) {
  if (v === 'slaitinis') return 'Šlaitinis';
  if (v === 'plokscias') return 'Plokščias';
  if (v === 'kombinuotas') return 'Kombinuotas';
  return '—';
}
function fasadaiLabel(arr: string[], kita: string) {
  const map: Record<string, string> = { tinkas: 'Tinkas', medis: 'Medis / lentelės', klinkeris: 'Klinkeris', kita: kita || 'Kita' };
  return arr.map(f => map[f] ?? f).join(', ') || '—';
}

function underlinePara(label: string) {
  return new Paragraph({
    spacing: { before: 120 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: '________________________________', underline: { type: UnderlineType.SINGLE }, size: 20 }),
    ],
  });
}

export async function POST(req: NextRequest) {
  const d: PUData = await req.json();
  const today = new Date().toISOString().slice(0, 10);

  const doc = new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'KA SPRENDIMAI', bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: 'PROJEKTAVIMO UŽDUOTIS', bold: true, size: 32 })],
        }),

        // Section 1: Project identification
        heading('1. Projekto identifikacija'),
        twoColTable([
          row2('Projekto pavadinimas', d.projectName || '—'),
          row2('Adresas', d.address || '—'),
          row2('Užsakovas', d.client || '—'),
          row2('El. paštas', d.clientEmail || '—'),
          row2('Datos', d.startDate || '—'),
        ]),

        // Section 2: Projektavimo duomenys
        heading('2. Projektavimo duomenys'),
        twoColTable([
          row2('Projektavimo objektas', d.objektas || '—'),
          row2('Statybos rūšis', d.statybosRusis || '—'),
          row2('Bendras plotas, m²', d.bendrasPlotai || '—'),
          row2('Sklypo plotas, m²', d.sklypoPlotai || '—'),
          row2('Žemės sklypo paskirtis', d.zemesPaskirtis || '—'),
          row2('Telefono Nr.', d.telefonas || '—'),
        ]),

        // Section 3: Projekto sudėtis
        heading('3. Projekto sudėtis'),
        twoColTable([
          row2(`${ch(d.hasPP)} Projektiniai pasiūlymai (PP)`, ''),
          row2(`${ch(d.hasSLD)} Statybos leidimo dokumentai (SLD)`, ''),
          row2(`${ch(d.hasTDP)} Techninis darbo projektas (TDP)`, ''),
          row2(`${ch(d.hasBD)} Bendrosios dalys (BD)`, ''),
          row2(`${ch(d.hasLVN)} Leidimų valdymo numeris (LVN)`, ''),
        ]),

        // Section 4: Prioritetai
        heading('4. Prioritetai (1 – svarbiausias, 5 – mažiausiai svarbus)'),
        twoColTable([
          row2('Funkcionalumas', priorityLabel(d.prioritetai?.funkcionalumas)),
          row2('Architektūrinė išraiška', priorityLabel(d.prioritetai?.archIsraiška)),
          row2('Statybos kaina', priorityLabel(d.prioritetai?.statybosKaina)),
          row2('Energinis efektyvumas', priorityLabel(d.prioritetai?.energinis)),
          row2('Statybos paprastumas', priorityLabel(d.prioritetai?.paprastumas)),
        ]),

        // Section 5: Funkcinė struktūra
        heading('5. Funkcinė struktūra'),

        subheading('Bendra erdvė'),
        twoColTable([
          row2('Virtuvės tipas', virtuveTipasLabel(d.virtuveTipas)),
          row2('Bendros erdvės dydis', erdvesLabel(d.bendrosErdvesDydis, d.bendrosErdvesDydisKita)),
          row2('Lubų aukštis', lubosLabel(d.lubosAukstis, d.lubosAukstisKitas)),
          row2('Sandėliukas prie virtuvės', ch(d.sandeliukasPrieVirtuve)),
        ]),

        subheading('Gyvenamosios patalpos'),
        twoColTable([
          row2('Vaikų kambarių skaičius', d.vaikusKambariuSk > 0 ? String(d.vaikusKambariuSk) : '—'),
          row2('Darbo kambarys', darbLabel(d.darbKambarys)),
          row2('Drabužinė', drabuzineLabel(d.drabuzine)),
          row2('Atskiras tėvų sanitarinis mazgas', smazLabel(d.tevisSmaz)),
        ]),

        subheading('Sanitarinės ir pagalbinės patalpos'),
        twoColTable([
          row2('Bendras vonios kambarys', voniaLabel(d.bendrasVonios)),
          row2('Papildomas WC', ch(d.papildomasWC)),
          row2('Techninė patalpa / sandėliukas', ch(d.techPatalpa)),
          row2('Skalbykla', skalbyklaLabel(d.skalbykla)),
          row2('Automobilių garažo skaičius', d.garazasAutoSk > 0 ? String(d.garazasAutoSk) : '—'),
          row2('Garažo sprendimas', garazasLabel(d.garazasSprendimas)),
          row2('Kitos patalpos', d.kitosPatalpos || '—'),
        ]),

        // Section 6: Architektūriniai pasirinkimai
        heading('6. Architektūriniai pasirinkimai'),
        twoColTable([
          row2('Pastato charakteris', charakterisLabel(d.pastatoCharakteris, d.pastatoCharakterisKita)),
          row2('Stogo tipas', stogasLabel(d.stogasTipas)),
          row2('Fasadų apdaila', fasadaiLabel(d.fasadai ?? [], d.fasadaiKita)),
        ]),

        // Signature section
        heading('Parašai'),
        new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: `Data: ${today}`, size: 20 })] }),
        underlinePara('Užsakovas'),
        underlinePara('Architektas'),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = (d.projectName || 'projektas')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-zA-Z0-9 ]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);
  const filename = `PU_${safeName}_${today}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
