import { Project, ResultInput, InputStatus, StageId } from './types';
import { validStageIds } from './schedule';

// ─────────────────────────────────────────────────────────────────────────────
// Įėjimų planavimas: „ko man reikia, kad galėčiau padaryti X"
// Kiekvienas rezultatas (PP, SLD, SP...) turi įėjimų sąrašą. Įėjimo būsena
// išvedama gyvai: iš dokumentų (docId), iš kito rezultato užbaigimo (partId)
// arba laikoma rankinė (skambučiai, info iš užsakovo).
// ─────────────────────────────────────────────────────────────────────────────

// Šablonai pagal rezultato id. Susietų įėjimų (docId/partId) būsena visada
// gyva; rankiniai įėjimai įsirašo į project.inputs pirmo pakeitimo metu.
export const DEFAULT_RESULT_INPUTS: Record<string, ResultInput[]> = {
  // SR ir PP startui oficialių dokumentų nereikia — Kristina pirminę analizę ir
  // koncepciją daro iš viešų šaltinių (Regia, planuojustatau.lt). Dokumentai
  // pažymėti soft: reikalingi tik užbaigimui, starto neblokuoja (2026-07-15).
  SR: [
    { id: 'in-sr-02', label: 'Nuosavybės dokumentas (02)', kind: 'dokumentas', docId: 'doc-02', soft: true },
    { id: 'in-sr-03', label: 'Sklypo ribų planas (03)', kind: 'dokumentas', docId: 'doc-03', soft: true },
    { id: 'in-sr-04', label: 'Teritorijų planavimo ištrauka (04)', kind: 'dokumentas', docId: 'doc-04', soft: true },
    { id: 'in-sr-07', label: 'Toponuotrauka (07)', kind: 'brezinys', docId: 'doc-07', soft: true },
  ],
  PP: [
    { id: 'in-pp-01', label: 'Projektavimo užduotis (01)', kind: 'info', docId: 'doc-01', soft: true },
    { id: 'in-pp-02', label: 'Nuosavybės dokumentas (02)', kind: 'dokumentas', docId: 'doc-02', soft: true },
    { id: 'in-pp-03', label: 'Sklypo ribų planas (03)', kind: 'dokumentas', docId: 'doc-03', soft: true },
    { id: 'in-pp-04', label: 'Teritorijų planavimo ištrauka (04)', kind: 'dokumentas', docId: 'doc-04', soft: true },
    { id: 'in-pp-07', label: 'Toponuotrauka (07)', kind: 'brezinys', docId: 'doc-07', soft: true },
  ],
  VIESIMAS: [
    { id: 'in-vies-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
  ],
  IP: [
    { id: 'in-ip-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
  ],
  SLD: [
    { id: 'in-sld-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
    { id: 'in-sld-00', label: 'Įgaliojimas (00)', kind: 'dokumentas', docId: 'doc-00' },
    { id: 'in-sld-05', label: 'Specialieji reikalavimai (05)', kind: 'dokumentas', docId: 'doc-05' },
    { id: 'in-sld-06', label: 'Prisijungimo sąlygos (06)', kind: 'dokumentas', docId: 'doc-06' },
  ],
  // TDP dalių seka: BD → SP → SA → SK → LVN (trukmės žr. schedule.ts)
  BD: [
    { id: 'in-bd-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
  ],
  SP: [
    { id: 'in-sp-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
    { id: 'in-sp-07', label: 'Toponuotrauka (07)', kind: 'brezinys', docId: 'doc-07' },
  ],
  SA: [
    { id: 'in-sa-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
  ],
  SK: [
    { id: 'in-sk-06', label: 'Prisijungimo sąlygos (06)', kind: 'dokumentas', docId: 'doc-06' },
    { id: 'in-sk-sa', label: 'Architektūrinė dalis (SA) baigta', kind: 'brezinys', partId: 'SA' },
  ],
  LVN: [
    { id: 'in-lvn-sp', label: 'Sklypo planas (SP) baigtas', kind: 'brezinys', partId: 'SP' },
  ],
  // TDP eina LYGIAGREČIAI su SLD derinimu (startas — po PP), todėl SLD
  // starto neblokuoja — jis reikalingas tik užbaigimui/statybai (soft).
  TDP: [
    { id: 'in-tdp-pp', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' },
    { id: 'in-tdp-sld', label: 'SLD gautas', kind: 'dokumentas', partId: 'SLD', soft: true },
  ],
  // Ekspertizė — po TDP; SLD paprastai jau gautas (ypatingam statiniui SLD BE
  // ekspertizės, ji atliekama PO SLD) — žymima soft, kad matytųsi būsenoje.
  EKSPERTIZE: [
    { id: 'in-eksp-tdp', label: 'TDP baigtas', kind: 'brezinys', partId: 'TDP' },
    { id: 'in-eksp-sld', label: 'SLD gautas', kind: 'dokumentas', partId: 'SLD', soft: true },
  ],
};

export const INPUT_KIND_META: Record<ResultInput['kind'], { icon: string; label: string }> = {
  dokumentas: { icon: '📄', label: 'dokumentas' },
  skambutis: { icon: '📞', label: 'skambutis' },
  brezinys: { icon: '📐', label: 'brėžinys' },
  info: { icon: '💬', label: 'info iš užsakovo' },
  kita: { icon: '📌', label: 'kita' },
};

/** Įėjimų sąrašas rezultatui: išsaugotas projekte arba šablonas. */
export function getResultInputs(project: Project, resultId: string): ResultInput[] {
  return project.inputs?.[resultId] ?? DEFAULT_RESULT_INPUTS[resultId] ?? [];
}

const STAGE_ORDER: StageId[] = ['DP', 'SR', 'PP', 'PP_VIESIMAS', 'IP', 'SLD', 'PAKARTOTINIS', 'TDP', 'EKSPERTIZE'];

/** Grafiko konvencija: etapai prieš anksčiausią aktyvų laikomi praėjusiais. */
function stageIsPast(project: Project, stageId: StageId): boolean {
  const indices = (project.activeStages ?? [])
    .map(s => STAGE_ORDER.indexOf(s))
    .filter(i => i >= 0);
  if (indices.length === 0) return false;
  const idx = STAGE_ORDER.indexOf(stageId);
  return idx >= 0 && idx < Math.min(...indices);
}

/** Ar rezultatas (etapas / TDP dalis) baigtas. */
export function partCompleted(project: Project, partId: string): boolean {
  const stageId = (partId === 'VIESIMAS' ? 'PP_VIESIMAS' : partId) as StageId;
  if ((project.completedStages ?? []).includes(stageId)) return true;
  // Faktinė pabaiga = baigta, net kai completedStages išvalytas (baigto
  // projekto konvencija useProjects.toggleStage baigiant paskutinį etapą)
  if (project.stageStatuses?.[stageId]?.endDate) return true;
  if (stageIsPast(project, stageId)) return true;
  if (project.partStatuses?.[partId]?.completed) return true;
  return false;
}

/** Ar rezultatas šiuo metu vyksta. */
function partActive(project: Project, partId: string): boolean {
  const stageId = partId === 'VIESIMAS' ? 'PP_VIESIMAS' : partId;
  if ((project.activeStages ?? []).includes(stageId as StageId)) return true;
  const ps = project.partStatuses?.[partId];
  return !!ps?.startDate && !ps?.completed;
}

/** Gyva įėjimo būsena. */
export function getInputStatus(project: Project, input: ResultInput): InputStatus {
  if (input.docId) {
    const doc = [...(project.dokumentai ?? []), ...(project.kitiDokumentai ?? [])]
      .find(d => d.id === input.docId);
    if (doc?.received) return 'yra';
    if (doc?.orderedDate) return 'uzsakyta';
    return 'nera';
  }
  if (input.partId) {
    if (partCompleted(project, input.partId)) return 'yra';
    if (partActive(project, input.partId)) return 'uzsakyta';
    return 'nera';
  }
  return input.status ?? 'nera';
}

export interface ResultReadiness {
  resultId: string;
  ready: boolean;      // startui netrūksta nė vieno kieto (ne soft) įėjimo
  missing: number;     // kiek įėjimų dar nėra iš viso (įsk. soft ir užsakytus)
  hardMissing: number; // kiek trūksta startą blokuojančių įėjimų
  waiting: number;     // kiek iš trūkstamų jau užsakyta/vyksta
  total: number;
  inputs: { input: ResultInput; status: InputStatus }[];
}

export function getResultReadiness(project: Project, resultId: string): ResultReadiness {
  const inputs = getResultInputs(project, resultId).map(input => ({
    input,
    status: getInputStatus(project, input),
  }));
  const missing = inputs.filter(i => i.status !== 'yra').length;
  const hardMissing = inputs.filter(i => i.status !== 'yra' && !i.input.soft).length;
  const waiting = inputs.filter(i => i.status === 'uzsakyta').length;
  return { resultId, ready: hardMissing === 0, missing, hardMissing, waiting, total: inputs.length, inputs };
}

/** Kurie rezultatai rodomi projekte (pasirinktos dalys, turinčios šablonų ar įrašų). */
export function getProjectResultIds(project: Project): string[] {
  const sp = project.selectedParts;
  const ids: string[] = ['SR'];
  if (sp.PP) ids.push('PP');
  if (sp.VIESIMAS) ids.push('VIESIMAS');
  if (sp.IP) ids.push('IP');
  if (sp.SLD) ids.push('SLD');
  if (sp.TDP) ids.push('TDP');
  if (sp.BD) ids.push('BD');
  if (sp.SP) ids.push('SP');
  if (sp.SA) ids.push('SA');
  if (sp.SK) ids.push('SK');
  if (sp.LVN) ids.push('LVN');
  if (sp.EKSPERTIZE) ids.push('EKSPERTIZE');
  // Rankiniai sąrašai rezultatams, kurių nėra tarp pasirinktų dalių
  for (const key of Object.keys(project.inputs ?? {})) {
    if (!ids.includes(key)) ids.push(key);
  }
  // Jau baigti rezultatai kortelių nerodo
  return ids.filter(id => !partCompleted(project, id));
}

export interface UnlockPriority {
  input: ResultInput;
  status: InputStatus;
  unlocks: string[]; // rezultatų id, kuriuos šis įėjimas (kartu su kitais) atrakina
}

/**
 * Dienos prioritetas: trūkstami įėjimai, surikiuoti pagal tai, kiek dar
 * nepradėtų rezultatų jų laukia. Vienodi įėjimai (tas pats docId/partId)
 * sujungiami per visus rezultatus.
 */
export function getUnlockPriorities(project: Project): UnlockPriority[] {
  const byKey = new Map<string, UnlockPriority>();
  for (const resultId of getProjectResultIds(project)) {
    const readiness = getResultReadiness(project, resultId);
    // Soft įėjimai starto neblokuoja, bet gauti dokumentai vis tiek atrakina
    // rezultato užbaigimą — todėl „ready" rezultatų trūkumai irgi skaičiuojami.
    for (const { input, status } of readiness.inputs) {
      if (status === 'yra') continue;
      const key = input.docId ? `doc:${input.docId}`
        : input.partId ? `part:${input.partId}`
        : `${resultId}:${input.id}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.unlocks.push(resultId);
      } else {
        byKey.set(key, { input, status, unlocks: [resultId] });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.unlocks.length - a.unlocks.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapo proceso būsena — viena vieta grafiko kortelei ir proceso sekos juostai
// ─────────────────────────────────────────────────────────────────────────────

export type StageProcess = 'baigta' | 'priduota' | 'dirbama' | 'galima' | 'laukiama';

/** Pridavimo etapai: faktinė pradžia reiškia „priduota, laukiama atsakymo", ne „dirbama". */
export const SUBMITTAL_STAGES: StageId[] = ['PP_VIESIMAS', 'IP', 'SLD', 'PAKARTOTINIS', 'EKSPERTIZE'];

/** Etapo id → rezultato id įėjimų šablonuose (Viešinimo etapas ↔ VIESIMAS rezultatas). */
export function stageResultId(stageId: StageId): string {
  return stageId === 'PP_VIESIMAS' ? 'VIESIMAS' : stageId;
}

export interface StageProcessInfo {
  state: StageProcess;
  readiness: ResultReadiness;
}

/** Proceso būsena iš duomenų (ne užduočių): baigta / priduota / dirbama / galima / laukiama. */
export function getStageProcessInfo(project: Project, stageId: StageId): StageProcessInfo {
  const resultId = stageResultId(stageId);
  const readiness = getResultReadiness(project, resultId);
  const status = project.stageStatuses?.[stageId];
  if (status?.endDate || partCompleted(project, resultId)) return { state: 'baigta', readiness };
  if (status?.startDate) {
    return { state: SUBMITTAL_STAGES.includes(stageId) ? 'priduota' : 'dirbama', readiness };
  }
  return { state: readiness.ready ? 'galima' : 'laukiama', readiness };
}

/**
 * Projektas baigtas tik kai VISI pasirinkti etapai faktiškai baigti.
 * Tuščias activeStages vidury proceso (pvz., ką tik baigus PP, dar
 * nepradėjus SLD/TDP) užbaigimo NEreiškia.
 */
export function isProjectFinished(project: Project): boolean {
  return validStageIds(project.selectedParts)
    .every(sid => getStageProcessInfo(project, sid).state === 'baigta');
}
