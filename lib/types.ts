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

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  done: boolean;
}

export interface DocumentItem {
  id: string;
  number: string;
  name: string;
  description: string;
  received: boolean;
  notes: string;
}

export interface MotyvuotasAtsakymas {
  id: string;
  date: string;
  pastaba: string;       // savivaldybės pastaba
  atsakyta: boolean;
  atsakymas: string;     // mūsų atsakymas / veiksmai
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

export interface Project {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}
