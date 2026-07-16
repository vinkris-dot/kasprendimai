import { StageInfo, ChecklistItem, DocumentItem, PartConfig, SelectedParts, TeamMember } from './types';

// Grafiko skaičiavimai gyvena lib/schedule.ts — čia re-eksportuojama suderinamumui.
export { calcTargetDate, calcStageDates, calcEffectiveStageDates, calcEffectiveTargetDate, calcCustomPartDates, validStageIds } from './schedule';

// ---------------------------------------------------------------------------
// PROJECT PARTS – selectable, durations in calendar days
// ---------------------------------------------------------------------------

export const PROJECT_PARTS: PartConfig[] = [
  {
    id: 'DP',
    label: 'DP',
    description: 'Detalusis planas (lygiagrečiai su SR+PP)',
    durationDays: 84, // 12 sav. numatyta; keičiama per DP_days
    group: 'pp',
  },
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
    description: 'Konstrukcijų dalis',
    durationDays: 42, // 6 sav.
    group: 'tdp',
  },
  {
    id: 'LVN',
    label: 'LVN',
    description: 'Lietaus vandens nuvedimas',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  // ── TDP dalys pagal LST 1516 (lygiagrečios TDP bloke, prasideda po BD+SP+SA) ──
  {
    id: 'T',
    label: 'T',
    description: 'Technologinė dalis',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  {
    id: 'VN',
    label: 'VN',
    description: 'Vandentiekio ir nuotekų dalis',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  {
    id: 'SVOK',
    label: 'ŠVOK',
    description: 'Šildymo, vėdinimo ir oro kondicionavimo dalis',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  {
    id: 'E',
    label: 'E',
    description: 'Elektrotechnikos dalis',
    durationDays: 28, // 4 sav.
    group: 'tdp',
  },
  {
    id: 'ER',
    label: 'ER',
    description: 'Elektroninių ryšių (silpnų srovių) dalis',
    durationDays: 14, // 2 sav.
    group: 'tdp',
  },
  {
    id: 'GSS',
    label: 'GSS',
    description: 'Gaisrinės signalizacijos dalis',
    durationDays: 14, // 2 sav.
    group: 'tdp',
  },
  {
    id: 'GS',
    label: 'GS',
    description: 'Gaisrinės saugos dalis',
    durationDays: 14, // 2 sav.
    group: 'tdp',
  },
  {
    id: 'SO',
    label: 'SO',
    description: 'Statybos organizavimo dalis',
    durationDays: 7, // 1 sav.
    group: 'tdp',
  },
  {
    id: 'KS',
    label: 'KS',
    description: 'Skaičiuojamosios kainos dalis',
    durationDays: 7, // 1 sav.
    group: 'tdp',
  },
  {
    id: 'PAKARTOTINIS',
    label: 'Pakartotinis derinimas',
    description: 'Papildomas SLD derinimo ratas',
    durationDays: 28, // 1 sav. pataisymai + 3 sav. derinimas
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
  DP: false,
  DP_days: 84,
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
  T: false,
  VN: false,
  SVOK: false,
  E: false,
  ER: false,
  GSS: false,
  GS: false,
  SO: false,
  KS: false,
};


/** Projektai identifikuojami pagal ADRESĄ — sąrašuose jis rodomas pirmu planu. */
export function projectLabel(p: { name: string; address?: string }): string {
  return p.address?.trim() || p.name;
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
    id: 'DP',
    name: 'Detalusis planas',
    shortName: 'DP',
    durationLabel: '~2–3 mėn.',
    colorClass: 'border-rose-500',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-700',
    tasks: [
      { label: 'Rengiamas lygiagrečiai su SR ir PP', duration: '~2–3 mėn.' },
    ],
  },
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
    durationLabel: '~4 sav.',
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
  SR: ['NR', 'KV'], // KV — pirminė analizė SR etape
  PP: ['KV', 'LL', 'NR'], // užbaigimas: LL — brėžiniai, NR — AR ir kiti dokumentai
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
