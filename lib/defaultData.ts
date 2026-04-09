import { StageInfo, ChecklistItem, DocumentItem, PartConfig, SelectedParts, TeamMember } from './types';

// ---------------------------------------------------------------------------
// PROJECT PARTS – selectable, durations in calendar days
// ---------------------------------------------------------------------------

export const PROJECT_PARTS: PartConfig[] = [
  {
    id: 'PP',
    label: 'PP',
    description: 'Projektiniai pasiūlymai',
    durationDays: 56, // 8 sav.
    group: 'pp',
  },
  {
    id: 'VIESIMAS',
    label: 'Viešinimas',
    description: 'PP viešinimas + derinimas',
    durationDays: 35, // 5 sav.
    group: 'pp',
  },
  {
    id: 'IP',
    label: 'Išankstiniai pritarimai',
    description: 'Išankstiniai pritarimai PP',
    durationDays: 28, // 4 sav.
    group: 'pp',
  },
  {
    id: 'SLD',
    label: 'SLD',
    description: 'Statybą leidžiantis dokumentas',
    durationDays: 42, // 6 sav. (2 ratai × 3 sav.)
    group: 'sld',
  },
  {
    id: 'TDP',
    label: 'TDP',
    description: 'Techninis darbo projektas (bazė)',
    durationDays: 14, // 2 sav. bazė; papildomos dalys pridedamos atskirai
    group: 'tdp',
  },
  {
    id: 'BD',
    label: 'BD',
    description: 'Bendroji dalis',
    durationDays: 7, // 1 sav.
    group: 'tdp',
  },
  {
    id: 'SP',
    label: 'SP',
    description: 'Sklypo planas',
    durationDays: 7, // 1 sav.
    group: 'tdp',
  },
  {
    id: 'SA',
    label: 'SA',
    description: 'Statybos architektūrinė dalis',
    durationDays: 14, // 2 sav.
    group: 'tdp',
  },
  {
    id: 'SK',
    label: 'SK',
    description: 'Sklypo komunikacijos',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  {
    id: 'LVN',
    label: 'LVN',
    description: 'Lietaus vandens nuvedimas',
    durationDays: 14, // 2 sav.
    group: 'tdp',
  },
  {
    id: 'PAKARTOTINIS',
    label: 'Pakartotinis derinimas',
    description: 'Papildomas SLD derinimo ratas',
    durationDays: 21, // 3 sav.
    group: 'sld',
  },
  {
    id: 'EKSPERTIZE',
    label: 'Ekspertizė',
    description: 'Projekto ekspertizė',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  {
    id: 'KITA',
    label: 'Kita',
    description: 'Papildomos dalys (savaitės)',
    durationDays: 14, // numatyta; keičiama per KITA_days
    group: 'other',
  },
];

export const DEFAULT_PARTS: SelectedParts = {
  PP: true,
  VIESIMAS: false,
  IP: false,
  SLD: true,
  TDP: true,
  BD: false,
  SP: false,
  SA: false,
  SK: false,
  LVN: false,
  PAKARTOTINIS: false,
  EKSPERTIZE: true,
  KITA: false,
  KITA_days: 14,
};

// SR etapas visada įtraukiamas, nepriklausomai nuo pasirinkimų
const SR_DAYS = 35; // 5 sav.
// Ekspertizė įtraukiama automatiškai, jei pasirinktas TDP
const EKSPERTIZE_DAYS = 28;

/**
 * Apskaičiuoja tikslinę statybos pradžios datą.
 * TDP vyksta LYGIAGREČIAI su PP, todėl imamas maksimumas iš PP bloko ir TDP bloko.
 */
export function calcTargetDate(startDate: string, parts: SelectedParts): string {
  if (!startDate) return '';

  const start = new Date(startDate);

  // 1. SR (visada)
  let total = SR_DAYS;

  // 2. PP blokas (nuoseklus): PP + Viešinimas + Išankstiniai pritarimai
  if (parts.PP) total += 56;
  if (parts.VIESIMAS) total += 35;
  if (parts.IP) total += 28;

  // 3. SLD ir TDP vyksta LYGIAGREČIAI — imamas maksimumas
  let sldDays = parts.SLD ? 42 : 0;
  let tdpDays = 0;
  if (parts.TDP) {
    tdpDays += 14;
    if (parts.BD) tdpDays += 7;
    if (parts.SP) tdpDays += 7;
    if (parts.SA) tdpDays += 14;
    if (parts.SK) tdpDays += 28;
    if (parts.LVN) tdpDays += 7;
  }
  total += Math.max(sldDays, tdpDays);

  // 4. Pakartotinis derinimas – po SLD
  if (parts.PAKARTOTINIS) total += 21;

  // 5. Ekspertizė – tik jei pasirinkta
  if (parts.EKSPERTIZE) total += EKSPERTIZE_DAYS;

  // 5. Kita
  if (parts.KITA) total += parts.KITA_days || 14;

  const target = new Date(start);
  target.setDate(target.getDate() + total);
  return target.toISOString().slice(0, 10);
}

/**
 * Apskaičiuoja kiekvieno etapo planuojamas pradžios ir pabaigos datas.
 * TDP vyksta lygiagrečiai su SLD.
 */
export function calcStageDates(startDate: string, parts: SelectedParts): Partial<Record<import('./types').StageId, { startDate: string; endDate: string }>> {
  if (!startDate) return {};

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const result: Partial<Record<import('./types').StageId, { startDate: string; endDate: string }>> = {};
  let cursor = new Date(startDate);

  // SR (visada, 21 d.)
  result['SR'] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, 35)) };
  cursor = addDays(cursor, 35);

  // PP (56 d.)
  if (parts.PP) {
    result['PP'] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, 56)) };
    cursor = addDays(cursor, 56);
  }

  // Viešinimas (35 d.)
  if (parts.VIESIMAS) {
    result['PP_VIESIMAS'] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, 35)) };
    cursor = addDays(cursor, 35);
  }

  // Išankstiniai pritarimai (28 d.)
  if (parts.IP) {
    result['IP'] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, 28)) };
    cursor = addDays(cursor, 28);
  }

  // SLD ir TDP lygiagrečiai
  const parallelStart = new Date(cursor);
  const sldDays = parts.SLD ? 42 : 0;
  let tdpDays = 0;
  if (parts.TDP) {
    tdpDays += 14;
    if (parts.BD) tdpDays += 7;
    if (parts.SP) tdpDays += 7;
    if (parts.SA) tdpDays += 14;
    if (parts.SK) tdpDays += 28;
    if (parts.LVN) tdpDays += 7;
  }

  if (parts.SLD) {
    result['SLD'] = { startDate: fmt(parallelStart), endDate: fmt(addDays(parallelStart, sldDays)) };
  }
  if (parts.TDP) {
    result['TDP'] = { startDate: fmt(parallelStart), endDate: fmt(addDays(parallelStart, tdpDays)) };
  }

  cursor = addDays(cursor, Math.max(sldDays, tdpDays));

  // Pakartotinis derinimas (21 d.)
  if (parts.PAKARTOTINIS) {
    result['PAKARTOTINIS'] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, 21)) };
    cursor = addDays(cursor, 21);
  }

  // Ekspertizė (28 d., tik jei pasirinkta)
  if (parts.EKSPERTIZE) {
    result['EKSPERTIZE'] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, 28)) };
  }

  return result;
}

/**
 * Kaip calcStageDates, bet naudoja faktines pabaigos datas ten kur įvestos.
 * Taip sekantys etapai persiskaičiuoja pagal realų tempą.
 */
export function calcEffectiveStageDates(
  startDate: string,
  parts: SelectedParts,
  stageStatuses: Partial<Record<import('./types').StageId, import('./types').StageStatus>>,
): Partial<Record<import('./types').StageId, { startDate: string; endDate: string; isShifted?: boolean }>> {
  if (!startDate) return {};

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Jei etapas turi faktinę pabaigos datą — naudojam ją kaip kursorių sekančiam
  const effectiveEnd = (stageId: import('./types').StageId, plannedEnd: Date): Date => {
    const actual = stageStatuses[stageId]?.endDate;
    return actual ? new Date(actual) : plannedEnd;
  };

  const result: Partial<Record<import('./types').StageId, { startDate: string; endDate: string; isShifted?: boolean }>> = {};
  const planned = calcStageDates(startDate, parts);

  let cursor = new Date(startDate);

  // SR
  const srPlannedEnd = addDays(cursor, 35);
  const srEffEnd = effectiveEnd('SR', srPlannedEnd);
  result['SR'] = { startDate: fmt(cursor), endDate: fmt(srEffEnd) };
  cursor = srEffEnd;

  // PP
  if (parts.PP) {
    const ppStart = new Date(cursor);
    const ppPlannedEnd = addDays(cursor, 56);
    const ppEffEnd = effectiveEnd('PP', ppPlannedEnd);
    const ppIsShifted = planned['PP'] ? fmt(ppStart) !== planned['PP'].startDate : false;
    result['PP'] = { startDate: fmt(ppStart), endDate: fmt(ppEffEnd), isShifted: ppIsShifted };
    cursor = ppEffEnd;
  }

  // Viešinimas
  if (parts.VIESIMAS) {
    const vStart = new Date(cursor);
    const vPlannedEnd = addDays(cursor, 35);
    const vEffEnd = effectiveEnd('PP_VIESIMAS', vPlannedEnd);
    const vIsShifted = planned['PP_VIESIMAS'] ? fmt(vStart) !== planned['PP_VIESIMAS'].startDate : false;
    result['PP_VIESIMAS'] = { startDate: fmt(vStart), endDate: fmt(vEffEnd), isShifted: vIsShifted };
    cursor = vEffEnd;
  }

  // IP
  if (parts.IP) {
    const ipStart = new Date(cursor);
    const ipPlannedEnd = addDays(cursor, 28);
    const ipEffEnd = effectiveEnd('IP', ipPlannedEnd);
    const ipIsShifted = planned['IP'] ? fmt(ipStart) !== planned['IP'].startDate : false;
    result['IP'] = { startDate: fmt(ipStart), endDate: fmt(ipEffEnd), isShifted: ipIsShifted };
    cursor = ipEffEnd;
  }

  // SLD + TDP lygiagrečiai
  const parallelStart = new Date(cursor);
  const sldDays = parts.SLD ? 42 : 0;
  let tdpDays = 0;
  if (parts.TDP) {
    tdpDays += 14;
    if (parts.BD) tdpDays += 7;
    if (parts.SP) tdpDays += 7;
    if (parts.SA) tdpDays += 14;
    if (parts.SK) tdpDays += 28;
    if (parts.LVN) tdpDays += 7;
  }

  let sldEffEnd = parallelStart;
  let tdpEffEnd = parallelStart;

  if (parts.SLD) {
    sldEffEnd = effectiveEnd('SLD', addDays(parallelStart, sldDays));
    const sldIsShifted = planned['SLD'] ? fmt(parallelStart) !== planned['SLD'].startDate : false;
    result['SLD'] = { startDate: fmt(parallelStart), endDate: fmt(sldEffEnd), isShifted: sldIsShifted };
  }
  if (parts.TDP) {
    tdpEffEnd = effectiveEnd('TDP', addDays(parallelStart, tdpDays));
    const tdpIsShifted = planned['TDP'] ? fmt(parallelStart) !== planned['TDP'].startDate : false;
    result['TDP'] = { startDate: fmt(parallelStart), endDate: fmt(tdpEffEnd), isShifted: tdpIsShifted };
  }

  cursor = sldEffEnd > tdpEffEnd ? sldEffEnd : tdpEffEnd;

  // Pakartotinis
  if (parts.PAKARTOTINIS) {
    const pakStart = new Date(cursor);
    const pakPlannedEnd = addDays(cursor, 21);
    const pakEffEnd = effectiveEnd('PAKARTOTINIS', pakPlannedEnd);
    const pakIsShifted = planned['PAKARTOTINIS'] ? fmt(pakStart) !== planned['PAKARTOTINIS'].startDate : false;
    result['PAKARTOTINIS'] = { startDate: fmt(pakStart), endDate: fmt(pakEffEnd), isShifted: pakIsShifted };
    cursor = pakEffEnd;
  }

  // Ekspertizė
  if (parts.EKSPERTIZE) {
    const ekspStart = new Date(cursor);
    const ekspIsShifted = planned['EKSPERTIZE'] ? fmt(ekspStart) !== planned['EKSPERTIZE'].startDate : false;
    result['EKSPERTIZE'] = { startDate: fmt(ekspStart), endDate: fmt(addDays(ekspStart, 28)), isShifted: ekspIsShifted };
  }

  return result;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// STAGES (grafikas)
// ---------------------------------------------------------------------------

export const STAGES: StageInfo[] = [
  {
    id: 'SR',
    name: 'Paruošiamasis etapas + SR',
    shortName: 'SR',
    durationLabel: '~5 sav.',
    colorClass: 'border-blue-500',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    tasks: [
      { label: 'Analizė, dokumentų užsakymas (NTR, žemės sklypo ribų planas, DP ar ZPP (jeigu yra), toponuotrauka)', duration: '1 d.' },
      { label: 'Dokumentų gavimas', duration: '~2 sav.' },
      { label: 'Sąlygų / SR užsakymas', duration: '1 d.' },
      { label: 'Specialiųjų reikalavimų (SR) gavimas', duration: '~3 sav.' },
    ],
  },
  {
    id: 'PP',
    name: 'PP rengimas ir derinimas su statytoju',
    shortName: 'PP',
    durationLabel: '~8 sav.',
    colorClass: 'border-purple-500',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    tasks: [
      { label: 'PP koncepcija', duration: '4 sav.' },
      { label: 'PP užbaigimas', duration: '2 sav.' },
      { label: 'Vidaus techninė patikra', duration: '1 sav.' },
    ],
  },
  {
    id: 'PP_VIESIMAS',
    name: 'PP viešinimas + derinimas',
    shortName: 'Viešinimas',
    durationLabel: '~5 sav.',
    colorClass: 'border-orange-500',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    tasks: [
      { label: 'Viešinimo paskelbimas', duration: '1 d.' },
      { label: 'Viešinimo laikotarpis', duration: '10 d.d.' },
      { label: 'Pastabų vertinimas', duration: '1 sav.' },
      { label: 'Savivaldybės derinimas', duration: '2 sav.' },
    ],
  },
  {
    id: 'IP',
    name: 'Išankstiniai pritarimai PP',
    shortName: 'IP',
    durationLabel: '~4 sav.',
    colorClass: 'border-yellow-500',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-700',
    tasks: [
      { label: 'Dokumentų pateikimas institucijoms', duration: '1 d.' },
      { label: 'Pritarimų gavimas', duration: '~4 sav.' },
    ],
  },
  {
    id: 'SLD',
    name: 'Statybą leidžiantis dokumentas',
    shortName: 'SLD',
    durationLabel: '~6 sav.',
    colorClass: 'border-teal-500',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
    tasks: [
      { label: 'Dokumentų įkėlimas (Infostatyba)', duration: '1 d.' },
      { label: '1 ratas: tikrinimas', duration: '3 sav.' },
      { label: 'Pastabų taisymas ir pakartotinis teikimas', duration: '—' },
      { label: '2 ratas: tikrinimas', duration: '3 sav.' },
      { label: 'SLD išdavimas', duration: '—' },
    ],
  },
  {
    id: 'PAKARTOTINIS',
    name: 'Pakartotinis derinimas',
    shortName: 'Pakartotinis',
    durationLabel: '~3 sav.',
    colorClass: 'border-teal-400',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    tasks: [
      { label: 'Pataisytų dokumentų teikimas', duration: '1 d.' },
      { label: 'Pakartotinis tikrinimas', duration: '3 sav.' },
      { label: 'SLD išdavimas', duration: '—' },
    ],
  },
  {
    id: 'TDP',
    name: 'Techninis darbo projektas',
    shortName: 'TDP',
    durationLabel: '~3 mėn.',
    colorClass: 'border-indigo-500',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-700',
    tasks: [
      { label: 'TDP startas (paraleliai su PP)', duration: '—' },
      { label: 'SA + SK', duration: '1 mėn.' },
      { label: 'VN + EL + ŠVOK', duration: '5 sav.' },
      { label: 'Gaisrinė + energija', duration: '2 sav.' },
      { label: 'Komplektavimas ekspertizei', duration: '2 sav.' },
    ],
  },
  {
    id: 'EKSPERTIZE',
    name: 'Ekspertizė',
    shortName: 'Ekspertizė',
    durationLabel: '~4 sav.',
    colorClass: 'border-red-500',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    tasks: [
      { label: 'Projekto atidavimas ekspertizei', duration: '—' },
      { label: 'Tikrinimas', duration: '~3 sav.' },
      { label: 'Pastabų uždarymas', duration: '3 d.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// DEFAULT CHECKLISTS
// ---------------------------------------------------------------------------

const PP_TEKST = '01_PP/01_PP_BYLA/01_DOKUMENTAI';
const PP_BREZ = '01_PP/02_DARBINIAI_BREZINIAI';
const PP_VIZ = '01_PP/03_VIZUALIZACIJOS';

export const DEFAULT_PP_BYLA: Omit<ChecklistItem, 'done'>[] = [
  { id: 'pp-01', label: 'Titulinis lapas', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-02', label: 'Projekto dokumentų sudėties žiniaraštis (su lapų Nr.)', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-03', label: 'Bendrieji statinio rodikliai (pagal STR 5 priedą)', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-04', label: 'Aiškinamasis raštas', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-05', label: 'Projektinių pasiūlymų viešinimo informacija (jei taikoma)', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-06', label: 'Pritarimų ir sutikimų sąrašas', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-07', label: 'Prisijungimo sąlygos ir specialieji reikalavimai', category: 'I. Tekstinė ir dokumentų dalis', subfolder: PP_TEKST },
  { id: 'pp-08', label: 'Sklypo situacijos schema', category: 'II. Sklypo plano sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-09', label: 'Sklypo planas (su sprendiniais)', category: 'II. Sklypo plano sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-10', label: 'Sklypo vertikalusis planas', category: 'II. Sklypo plano sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-11', label: 'Gaisrinių automobilių privažiavimo schema', category: 'II. Sklypo plano sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-12', label: 'Lietaus vandens tvarkymo schema', category: 'II. Sklypo plano sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-13', label: 'Planai', category: 'III. Architektūriniai sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-14', label: 'Pjūviai', category: 'III. Architektūriniai sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-15', label: 'Fasadai', category: 'III. Architektūriniai sprendiniai', subfolder: PP_BREZ },
  { id: 'pp-16', label: 'Vizualizacija – vaizdas iš viešosios erdvės', category: 'III. Architektūriniai sprendiniai', subfolder: PP_VIZ },
  { id: 'pp-17', label: 'Vizualizacija – pastato santykis su aplinka', category: 'III. Architektūriniai sprendiniai', subfolder: PP_VIZ },
  { id: 'pp-18', label: 'Vizualizacija – aiškus mastelis (žmonės, kontekstas)', category: 'III. Architektūriniai sprendiniai', subfolder: PP_VIZ },
];

const D1 = 'DOKUMENTAI/01_PROJEKTAVIMO_UZDUOTIS';
const D2 = 'DOKUMENTAI/02_SKLYPAS_IR_TEISE';
const D4 = 'DOKUMENTAI/04_PRADINIAI_DUOMENYS';
const D5 = 'DOKUMENTAI/05_PRISIJUNGIMO_SALYGOS_IR_SR';

export const DEFAULT_DOKUMENTAI: Omit<DocumentItem, 'received' | 'notes'>[] = [
  { id: 'doc-00', number: '00', name: 'Statytojo (užsakovo) įgaliojimas', description: 'Jei PP teikia projektuotojas', subfolder: D4 },
  { id: 'doc-01', number: '01', name: 'Projektavimo užduotis', description: '', subfolder: D1 },
  { id: 'doc-02', number: '02', name: 'Nuosavybės teisę patvirtinantis dokumentas', description: 'NT registro išrašas arba nuomos/panaudos sutartis', subfolder: D2 },
  { id: 'doc-03', number: '03', name: 'Žemės sklypo ribų planas', description: 'Galiojantis, sutampa su NT registro duomenimis', subfolder: D2 },
  { id: 'doc-04', number: '04', name: 'Teritorijų planavimo dokumentų ištraukos', description: 'Detalusis/bendrasis planas, reglamentų santrauka', subfolder: D2 },
  { id: 'doc-05', number: '05', name: 'Specialieji reikalavimai (SR)', description: 'Pateikti jei išduoti, sprendiniai atitinka SAR', subfolder: D5 },
  { id: 'doc-06', number: '06', name: 'Prisijungimo sąlygos', description: 'vanduo/nuotekos, lietus, kelias, elektra, ryšiai, dujos', subfolder: D5 },
  { id: 'doc-07', number: '07', name: 'Topografinė nuotrauka (toponuotrauka)', description: 'Aktualizuota, su galiojančiu derinimu', subfolder: D4 },
  { id: 'doc-08', number: '08', name: 'Projektavimo įmonės registravimo dokumentai', description: 'Juridinio asmens registracijos duomenys', subfolder: D4 },
  { id: 'doc-09', number: '09', name: 'Civilinės atsakomybės draudimas', description: 'Projektavimo veiklos, galiojantis', subfolder: D4 },
  { id: 'doc-10', number: '10', name: 'Naudotos projektavimo programinės įrangos sąrašas', description: 'Visos programos, licencijuota, nurodytas projektas ir adresas', subfolder: D4 },
  { id: 'doc-11', number: '11', name: 'Projekto vadovo paskyrimo dokumentas', description: '', subfolder: D4 },
  { id: 'doc-12', number: '12', name: 'Projekto vadovo kvalifikacijos atestatas', description: 'Galiojantis, sritis atitinka statinį, duomenys sutampa su Infostatyba', subfolder: D4 },
  { id: 'doc-13', number: '13', name: 'Gretimo sklypo sutikimai dėl neišlaikomo norminio atstumo', description: 'Jei statinys neišlaiko norminių atstumų iki kaimyninio sklypo', subfolder: D4 },
  { id: 'doc-14', number: '14', name: 'Apjungimas į bendrą gaisrinį skyrių', description: 'Sutikimas dėl apjungimo su gretimo pastato gaisriniu skyriumi', subfolder: D4 },
  { id: 'doc-15', number: '15', name: 'Bendraturčių sutikimai', description: 'Bendrosios nuosavybės dalyvių raštiški sutikimai', subfolder: D4 },
  { id: 'doc-16', number: '16', name: 'Sutikimai', description: 'Kiti reikalingi sutikimai (nurodyti SR)', subfolder: D4 },
];

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'NR', name: 'Nerijus', initials: 'NR', color: 'bg-blue-100', textColor: 'text-blue-700' },
  { id: 'KV', name: 'Kristina', initials: 'KV', color: 'bg-rose-100', textColor: 'text-rose-700' },
  { id: 'LL', name: 'Lina', initials: 'LL', color: 'bg-violet-100', textColor: 'text-violet-700' },
  { id: 'EXT', name: 'Išorinis', initials: 'EXT', color: 'bg-slate-100', textColor: 'text-slate-500' },
];

export const DEFAULT_STAGE_ASSIGNEES: Partial<Record<import('./types').StageId, import('./types').TeamMemberId[]>> = {
  SR: ['NR'],
  PP: ['KV', 'NR'],
  PP_VIESIMAS: ['NR'],
  IP: ['NR'],
  SLD: ['NR'],
  PAKARTOTINIS: ['NR'],
  TDP: ['LL'],
  EKSPERTIZE: ['NR'],
};

export function createDefaultProject() {
  return {
    activeStages: ['SR'] as import('./types').StageId[],
    ppByla: DEFAULT_PP_BYLA.map(item => ({ ...item, done: false })),
    dokumentai: DEFAULT_DOKUMENTAI.map(item => ({ ...item, received: false, notes: '' })),
    motyvuotiAtsakymai: [] as import('./types').MotyvuotasAtsakymas[],
    stageStatuses: {},
    partStatuses: {},
    stageAssignees: { ...DEFAULT_STAGE_ASSIGNEES },
    notes: '',
    selectedParts: { ...DEFAULT_PARTS },
  };
}
