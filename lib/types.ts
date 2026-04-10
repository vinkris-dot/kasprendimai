export type StageId = 'SR' | 'PP' | 'PP_VIESIMAS' | 'IP' | 'SLD' | 'PAKARTOTINIS' | 'TDP' | 'EKSPERTIZE';

export type PartId = 'PP' | 'VIESIMAS' | 'IP' | 'SLD' | 'TDP' | 'BD' | 'SP' | 'SA' | 'SK' | 'LVN' | 'PAKARTOTINIS' | 'EKSPERTIZE' | 'KITA';

export type TeamMemberId = 'NR' | 'KV' | 'LL' | 'EXT';

export interface TeamMember {
  id: TeamMemberId;
  name: string;
  initials: string;
  color: string; // tailwind bg class
  textColor: string; // tailwind text class
}

export interface PartConfig {
  id: PartId;
  label: string;
  description: string;
  durationDays: number; // calendar days
  group: 'pp' | 'sld' | 'tdp' | 'other';
}

export interface SelectedParts {
  PP: boolean;
  VIESIMAS: boolean;
  IP: boolean;
  SLD: boolean;
  TDP: boolean;
  BD: boolean;
  SP: boolean;
  SA: boolean;
  SK: boolean;
  LVN: boolean;
  PAKARTOTINIS: boolean;
  EKSPERTIZE: boolean;
  KITA: boolean;
  KITA_days: number; // custom duration for KITA
}

export interface UploadedFile {
  name: string;
  path: string;
  uploadedAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  subfolder?: string;
  done: boolean;
  files?: UploadedFile[];
}

export interface DocumentItem {
  id: string;
  number: string;
  name: string;
  description: string;
  subfolder?: string;
  received: boolean;
  notes: string;
  orderedDate?: string;
  connectionDates?: Record<string, string>;
  files?: UploadedFile[];
}

export interface MotyvuotasAtsakymas {
  id: string;
  date: string;
  pastaba: string;           // savivaldybės pastaba
  atsakyta: boolean;
  atsakymas: string;         // mūsų atsakymas / veiksmai
  terminasAtsakymui?: string;   // terminas atsakymui (pvz. +1 sav.)
  terminasPataisymui?: string;  // terminas pataisymui (pvz. +2 sav.)
}

export interface StageInfo {
  id: StageId;
  name: string;
  shortName: string;
  durationLabel: string;
  colorClass: string;
  bgClass: string;
  textClass: string;
  tasks: { label: string; duration: string }[];
}

export interface StageStatus {
  startDate: string;
  endDate: string;
  completed: boolean;
  notes: string;
}

export interface ProjektavimoUzduotis {
  // Section 2 extras (address/client/email/name come from Project)
  objektas: string;        // pvz. "Gyvenamasis namas"
  statybosRusis: string;   // pvz. "Nauja statyba"
  bendrasPlotai: string;   // numatomas bendrasis pastato plotas
  sklypoPlotai: string;    // sklypo plotas, m²
  zemesPaskirtis: string;  // žemės sklypo paskirtis
  telefonas: string;       // telefono nr.

  // Section 4: Prioritetai (ranking 1–5, 0 = unset)
  prioritetai: {
    funkcionalumas: number;
    archIsraiška: number;
    statybosKaina: number;
    energinis: number;
    paprastumas: number;
  };

  // Section 5a: Bendra erdvė
  virtuveTipas: 'atvira' | 'pusiau_atvira' | 'uzdara' | '';
  bendrosErdvesDydis: 'vidutine' | 'erdvi' | 'labai_erdvi' | 'kita' | '';
  bendrosErdvesDydisKita: string;
  lubosAukstis: 'standartinis' | 'padidintas' | 'dvieju_aukstu' | 'kitas' | '';
  lubosAukstisKitas: string;
  sandeliukasPrieVirtuve: boolean;

  // Section 5b: Gyvenamosios patalpos
  vaikusKambariuSk: number;
  darbKambarys: 'reikalingas' | 'nereikalingas' | 'universali' | '';
  drabuzine: 'atskira' | 'miegamojo' | 'nenumatoma' | '';
  tevisSmaz: 'su_dusu' | 'su_vonia' | 'ne' | '';

  // Section 5c: Sanitarinės ir pagalbinės
  bendrasVonios: 'su_vonia' | 'su_dusu' | '';
  papildomasWC: boolean;
  techPatalpa: boolean;
  skalbykla: 'atskira' | 'technine' | '';
  garazasAutoSk: number;
  garazasSprendimas: 'integruotas' | 'atskiras' | 'stogine' | 'projektuojant' | '';
  kitosPatalpos: string;

  // Section 6: Architektūriniai pasirinkimai
  pastatoCharakteris: 'siuolaikinis' | 'tradicinis' | 'kita' | '';
  pastatoCharakterisKita: string;
  stogasTipas: 'slaitinis' | 'plokscias' | 'kombinuotas' | '';
  fasadai: string[]; // 'tinkas' | 'medis' | 'klinkeris' | 'kita'
  fasadaiKita: string;
}

export const DEFAULT_PU: ProjektavimoUzduotis = {
  objektas: '', statybosRusis: '', bendrasPlotai: '', sklypoPlotai: '',
  zemesPaskirtis: '', telefonas: '',
  prioritetai: { funkcionalumas: 0, archIsraiška: 0, statybosKaina: 0, energinis: 0, paprastumas: 0 },
  virtuveTipas: '', bendrosErdvesDydis: '', bendrosErdvesDydisKita: '',
  lubosAukstis: '', lubosAukstisKitas: '', sandeliukasPrieVirtuve: false,
  vaikusKambariuSk: 0, darbKambarys: '', drabuzine: '', tevisSmaz: '',
  bendrasVonios: '', papildomasWC: false, techPatalpa: false,
  skalbykla: '', garazasAutoSk: 0, garazasSprendimas: '', kitosPatalpos: '',
  pastatoCharakteris: '', pastatoCharakterisKita: '',
  stogasTipas: '', fasadai: [], fasadaiKita: '',
};

export interface ManualTask {
  id: string;
  label: string;
  assignee?: TeamMemberId;
  dueDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Project {
  id: string;
  projectNumber?: string;
  name: string;
  address: string;
  client: string;
  clientEmail: string;
  activeStages: StageId[];
  completedStages: StageId[];
  startDate: string;
  targetConstructionDate: string; // auto-calculated
  selectedParts: SelectedParts;
  ppByla: ChecklistItem[];
  dokumentai: DocumentItem[];
  motyvuotiAtsakymai: MotyvuotasAtsakymas[];
  stageStatuses: Partial<Record<StageId, StageStatus>>;
  partStatuses: Partial<Record<string, StageStatus>>; // TDP sub-part tracking
  stageAssignees: Partial<Record<StageId, TeamMemberId[]>>;
  notes: string;
  taskStatuses?: Record<string, { dueDate?: string; doneAt?: string }>;
  manualTasks?: ManualTask[];
  pu?: ProjektavimoUzduotis;
  archived?: boolean;
  paused?: boolean;
  pauseReason?: string;
  pauseUntil?: string; // YYYY-MM-DD control date
  createdAt: string;
  updatedAt: string;
}
