import { SelectedParts, CustomPart, StageId, StageStatus, PartId } from './types';

/**
 * GRAFIKO VARIKLIS — vienintelė vieta, kur gyvena etapų trukmės ir eiliškumas.
 *
 * Anksčiau ta pati „vaikščiojimo per etapus" logika buvo nukopijuota trijose
 * funkcijose (calcTargetDate / calcStageDates / calcEffectiveStageDates) ir
 * kiekvienas naujas etapas reikalavo keisti visas — taip atsirado DP klaidos.
 * Dabar visos trys yra ploni apvalkalai virš vieno walkSchedule().
 *
 * PASTABA dėl laiko juostos: datos skaičiuojamos lokaliu laiku, todėl
 * rezultatai priklauso nuo TZ (testai leidžiami su TZ=Europe/Vilnius).
 */

// SR etapas visada įtraukiamas, nepriklausomai nuo pasirinkimų
const SR_DAYS = 35; // 5 sav.
const EKSPERTIZE_DAYS = 28;

/** Kurie etapai galimi prie duotų pasirinkimų (naudojama ir migracijai useProjects). */
export function validStageIds(sp: SelectedParts): StageId[] {
  const ids: StageId[] = ['SR'];
  if (sp.DP) ids.push('DP');
  if (sp.PP) ids.push('PP');
  if (sp.VIESIMAS) ids.push('PP_VIESIMAS');
  if (sp.IP) ids.push('IP');
  if (sp.SLD) ids.push('SLD');
  if (sp.PAKARTOTINIS) ids.push('PAKARTOTINIS');
  if (sp.TDP) ids.push('TDP');
  if (sp.EKSPERTIZE) ids.push('EKSPERTIZE');
  return ids;
}

/**
 * Lygiagrečių papildomų dalių prefiksas TDP bloke: kiek dienų praeina iki
 * SP ir SA pabaigos (po jų prasideda lygiagrečios papildomos dalys).
 */
export function tdpSpSaPrefixDays(parts: SelectedParts): number {
  if (!parts.TDP) return 0;
  // Subdalys rodomos nuo TDP bloko pradžios (BD → SP → SA). Lygiagreti dalis
  // prasideda baigus SA — t.y. po BD+SP+SA trukmės (be atskiros TDP bazės).
  let prefix = 0;
  if (parts.BD) prefix += 7;
  if (parts.SP) prefix += 7;
  if (parts.SA) prefix += 14;
  return prefix;
}

/** LST 1516 TDP dalys, vykstančios lygiagrečiai TDP bloke (po BD+SP+SA): trukmės dienomis. */
export const PARALLEL_TDP_PARTS: Partial<Record<PartId, number>> = {
  T: 28, VN: 28, SVOK: 28, E: 28, ER: 14, GSS: 14, GS: 14, SO: 7, KS: 7,
};

/** TDP bloko trukmė įskaitant lygiagrečias papildomas ir LST dalis (po SP/SA). */
export function tdpBlockDays(parts: SelectedParts, customParts: CustomPart[] = []): number {
  let tdpDays = rawTdpDays(parts);
  const parallelDur = [
    ...customParts.filter(c => c.parallel && c.weeks > 0).map(c => c.weeks * 7),
    ...Object.entries(PARALLEL_TDP_PARTS).filter(([id]) => parts[id as PartId]).map(([, d]) => d as number),
  ];
  if (parallelDur.length) {
    const prefix = tdpSpSaPrefixDays(parts);
    tdpDays = Math.max(tdpDays, prefix + Math.max(...parallelDur));
  }
  return tdpDays;
}

/** TDP lango trukmė be papildomų dalių (rodoma TDP etapo kortelėje). */
function rawTdpDays(parts: SelectedParts): number {
  if (!parts.TDP) return 0;
  let days = 14; // bazė
  if (parts.BD) days += 7;
  if (parts.SP) days += 7;
  if (parts.SA) days += 14;
  if (parts.SK) days += 42; // 6 sav.
  if (parts.LVN) days += 28; // 4 sav.
  return days;
}

type Win = { startDate: string; endDate: string; isShifted?: boolean };
type StageWins = Partial<Record<StageId, Win>>;

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Vienas ėjimas per grandinę: SR → PP → Viešinimas → IP → (DP lygiagrečiai
 * nuo pradžios) → SLD ∥ TDP → Pakartotinis → Ekspertizė.
 *
 * Be `statuses` — planinės datos. Su `statuses` — efektyvios: faktinė etapo
 * pabaiga tampa kursoriumi sekantiems, o etapai pažymimi isShifted, jei jų
 * pradžia pasislinko nuo plano.
 */
function walkSchedule(
  startDate: string,
  parts: SelectedParts,
  customParts: CustomPart[] = [],
  statuses?: Partial<Record<StageId, StageStatus>>,
): { stages: StageWins; chainEnd: Date } {
  const effEnd = (id: StageId, plannedEnd: Date): Date => {
    const actual = statuses?.[id]?.endDate;
    return actual ? new Date(actual) : plannedEnd;
  };
  // Faktinė pradžia peranchoruoja etapo langą (o per kursorių — ir visus tolesnius)
  const effStart = (id: StageId, plannedStart: Date): Date => {
    const actual = statuses?.[id]?.startDate;
    return actual ? new Date(actual) : plannedStart;
  };
  // isShifted lyginamas su planiniu ėjimu (tik efektyviame režime)
  const planned = statuses ? walkSchedule(startDate, parts, customParts).stages : null;
  const shifted = (id: StageId, start: Date) =>
    planned ? { isShifted: planned[id] ? fmt(start) !== planned[id]!.startDate : false } : {};

  const stages: StageWins = {};
  let cursor = new Date(startDate);

  // DP — lygiagrečiai su SR+PP, nuo projekto pradžios
  if (parts.DP) {
    const dpStart = effStart('DP', new Date(startDate));
    const dpEnd = effEnd('DP', addDays(dpStart, parts.DP_days || 84));
    stages['DP'] = { startDate: fmt(dpStart), endDate: fmt(dpEnd) };
  }

  // SR (visada)
  {
    const start = effStart('SR', cursor);
    const end = effEnd('SR', addDays(start, SR_DAYS));
    stages['SR'] = { startDate: fmt(start), endDate: fmt(end) };
    cursor = end;
  }

  // Nuoseklus PP blokas
  const seq: Array<[boolean, StageId, number]> = [
    [parts.PP, 'PP', 56],
    [parts.VIESIMAS, 'PP_VIESIMAS', 35],
    [parts.IP, 'IP', 28],
  ];
  for (const [on, id, days] of seq) {
    if (!on) continue;
    const start = effStart(id, cursor);
    const end = effEnd(id, addDays(start, days));
    stages[id] = { startDate: fmt(start), endDate: fmt(end), ...shifted(id, start) };
    cursor = end;
  }

  // DP gali pastumti SLD/TDP pradžią, jei tęsiasi ilgiau nei SR+PP blokas
  // (nebent DP jau faktiškai baigtas)
  if (parts.DP && !statuses?.['DP']?.endDate) {
    const dpEnd = addDays(effStart('DP', new Date(startDate)), parts.DP_days || 84);
    if (dpEnd > cursor) cursor = dpEnd;
  }

  // SLD ir TDP lygiagrečiai
  const parallelStart = new Date(cursor);
  const sldDays = parts.SLD ? 42 : 0;
  const tdpDays = rawTdpDays(parts);
  const sldStart = effStart('SLD', parallelStart);
  const tdpStart = effStart('TDP', parallelStart);
  let sldEnd = parallelStart;
  let tdpEnd = parallelStart;
  if (parts.SLD) {
    sldEnd = effEnd('SLD', addDays(sldStart, sldDays));
    stages['SLD'] = { startDate: fmt(sldStart), endDate: fmt(sldEnd), ...shifted('SLD', sldStart) };
  }
  if (parts.TDP) {
    tdpEnd = effEnd('TDP', addDays(tdpStart, tdpDays));
    stages['TDP'] = { startDate: fmt(tdpStart), endDate: fmt(tdpEnd), ...shifted('TDP', tdpStart) };
  }
  cursor = sldEnd > tdpEnd ? sldEnd : tdpEnd;

  // Lygiagrečios papildomos dalys gali pratęsti bloką (jei TDP dar nebaigtas faktiškai)
  if (!statuses?.['TDP']?.endDate) {
    const blockPlannedEnd = new Date(Math.max(
      addDays(sldStart, sldDays).getTime(),
      addDays(tdpStart, tdpBlockDays(parts, customParts)).getTime(),
    ));
    if (blockPlannedEnd > cursor) cursor = blockPlannedEnd;
  }

  // Pakartotinis derinimas
  if (parts.PAKARTOTINIS) {
    const start = effStart('PAKARTOTINIS', cursor);
    const end = effEnd('PAKARTOTINIS', addDays(start, 28));
    stages['PAKARTOTINIS'] = { startDate: fmt(start), endDate: fmt(end), ...shifted('PAKARTOTINIS', start) };
    cursor = end;
  }

  // Ekspertizė (pabaiga visada planinė — faktas nekeičia lango)
  if (parts.EKSPERTIZE) {
    const start = effStart('EKSPERTIZE', cursor);
    stages['EKSPERTIZE'] = { startDate: fmt(start), endDate: fmt(addDays(start, EKSPERTIZE_DAYS)), ...shifted('EKSPERTIZE', start) };
    cursor = addDays(start, EKSPERTIZE_DAYS);
  }

  return { stages, chainEnd: cursor };
}

/** Planuojama statybos pradžia: grandinės pabaiga + KITA + nuoseklios papildomos dalys. */
export function calcTargetDate(startDate: string, parts: SelectedParts, customParts: CustomPart[] = []): string {
  if (!startDate) return '';
  let end = walkSchedule(startDate, parts, customParts).chainEnd;
  if (parts.KITA) end = addDays(end, parts.KITA_days || 14);
  for (const c of customParts) {
    if (!c.parallel && c.weeks > 0) end = addDays(end, c.weeks * 7);
  }
  return fmt(end);
}

/** Kaip calcTargetDate, bet grandinė perskaičiuojama nuo faktinių etapų datų. */
export function calcEffectiveTargetDate(
  startDate: string,
  parts: SelectedParts,
  stageStatuses: Partial<Record<StageId, StageStatus>>,
  customParts: CustomPart[] = [],
): string {
  if (!startDate) return '';
  let end = walkSchedule(startDate, parts, customParts, stageStatuses).chainEnd;
  if (parts.KITA) end = addDays(end, parts.KITA_days || 14);
  for (const c of customParts) {
    if (!c.parallel && c.weeks > 0) end = addDays(end, c.weeks * 7);
  }
  return fmt(end);
}

/** Planuojamos kiekvieno etapo datos. */
export function calcStageDates(
  startDate: string,
  parts: SelectedParts,
  customParts: CustomPart[] = [],
): StageWins {
  if (!startDate) return {};
  return walkSchedule(startDate, parts, customParts).stages;
}

/** Kaip calcStageDates, bet įskaito faktines etapų pabaigas. */
export function calcEffectiveStageDates(
  startDate: string,
  parts: SelectedParts,
  stageStatuses: Partial<Record<StageId, StageStatus>>,
  customParts: CustomPart[] = [],
): StageWins {
  if (!startDate) return {};
  return walkSchedule(startDate, parts, customParts, stageStatuses).stages;
}

/**
 * Papildomų (rankiniu būdu pridėtų) dalių planuojamos datos.
 * Lygiagrečios — TDP bloke, prasideda po SP/SA. Nuoseklios — sukrautos viena
 * po kitos prie standartinės grandinės pabaigos.
 */
export function calcCustomPartDates(
  startDate: string,
  parts: SelectedParts,
  customParts: CustomPart[] = [],
): Record<string, { startDate: string; endDate: string }> {
  if (!startDate || !customParts.length) return {};

  const stageDates = calcStageDates(startDate, parts, customParts);
  const result: Record<string, { startDate: string; endDate: string }> = {};

  // Standartinės grandinės pabaiga (vėliausia etapo pabaiga)
  let chainEnd = new Date(startDate);
  for (const v of Object.values(stageDates)) {
    if (!v) continue;
    const e = new Date(v.endDate);
    if (e > chainEnd) chainEnd = e;
  }

  // Lygiagrečios dalys: po SP/SA TDP bloke (arba nuo lygiagretaus bloko pradžios, jei nėra TDP)
  const tdp = stageDates['TDP'] ?? stageDates['SLD'];
  const parallelStartBase = tdp
    ? addDays(new Date(tdp.startDate), parts.TDP ? tdpSpSaPrefixDays(parts) : 0)
    : chainEnd;

  // Nuoseklios dalys: krauname prie grandinės pabaigos
  let seqCursor = new Date(chainEnd);

  for (const c of customParts) {
    const days = (c.weeks || 0) * 7;
    if (c.parallel) {
      result[c.id] = { startDate: fmt(parallelStartBase), endDate: fmt(addDays(parallelStartBase, days)) };
    } else {
      result[c.id] = { startDate: fmt(seqCursor), endDate: fmt(addDays(seqCursor, days)) };
      seqCursor = addDays(seqCursor, days);
    }
  }

  return result;
}
