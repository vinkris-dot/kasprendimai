import { Project, StageId, TeamMemberId } from './types';
import { getResultReadiness } from './inputs';
import { projectLabel } from './defaultData';
import { tdpBlockDays } from './schedule';

// ─────────────────────────────────────────────────────────────────────────────
// Komandos apkrova: kiek lygiagrečių aktyvių etapų žmogus tempia.
// Etapas, kuriam trūksta įėjimų (žr. lib/inputs.ts), yra „užblokuotas" —
// jis laukia, o ne dirbamas, todėl į realų krūvį neskaičiuojamas.
// ─────────────────────────────────────────────────────────────────────────────

// ── Darbo sąnaudos (val.) etapui/daliai pagal žmogų — Kristinos įverčiai 2026-07-15 ──
export const STAGE_EFFORT: Partial<Record<string, Partial<Record<TeamMemberId, number>>>> = {
  SR: { NR: 10, KV: 3 }, // KV — pirminė analizė (~2 val. + retkarčiais savivaldybė)
  PP: { KV: 72, NR: 7 },
  PP_VIESIMAS: { NR: 10 },
  IP: { NR: 5 },
  SLD: { NR: 12 },
  PAKARTOTINIS: { NR: 7 },
  BD: { LL: 10 },
  SP: { LL: 19 },
  SA: { LL: 48 },
  SK: { LL: 29 },
  LVN: { LL: 19 },
  EKSPERTIZE: { NR: 7 },
};

/** Kiek valandų per savaitę žmogus realiai turi projektiniam darbui. */
export const WEEKLY_CAPACITY: Record<TeamMemberId, number> = { NR: 35, KV: 20, LL: 35, EXT: 0 };

/** Etapų kalendorinės trukmės dienomis — valandoms paskleisti per savaites. */
const STAGE_DURATION_DAYS: Partial<Record<StageId, number>> = {
  SR: 35, PP: 56, PP_VIESIMAS: 35, IP: 28, SLD: 42, PAKARTOTINIS: 28, EKSPERTIZE: 28,
};

const TDP_SUB_PARTS = ['BD', 'SP', 'SA', 'SK', 'LVN'] as const;

/** Etapo savaitinė apkrova žmogui: darbo valandos / etapo trukmė savaitėmis. */
function stageWeeklyHours(p: Project, stageId: StageId, member: TeamMemberId): number {
  if (stageId === 'TDP') {
    // TDP etapo darbas = pasirinktų dalių suma, paskleista per visą TDP bloką
    const effort = TDP_SUB_PARTS
      .filter(s => p.selectedParts[s])
      .reduce((sum, s) => sum + (STAGE_EFFORT[s]?.[member] ?? 0), 0);
    const weeks = tdpBlockDays(p.selectedParts, p.customParts ?? []) / 7;
    return weeks > 0 ? effort / weeks : 0;
  }
  const effort = STAGE_EFFORT[stageId]?.[member] ?? 0;
  const days = STAGE_DURATION_DAYS[stageId] ?? 28;
  return effort / (days / 7);
}

export interface StageAssignment {
  projectId: string;
  projectName: string;
  stageId: StageId;
  blocked: boolean;  // trūksta įėjimų — dirbti dar negalima
  missing: number;   // kiek įėjimų trūksta
  hoursPerWeek: number;
}

export interface MemberWorkload {
  assignments: StageAssignment[];
  total: number;         // visi aktyvūs priskirti etapai
  workable: number;      // etapai, kuriuos realiai galima dirbti
  blocked: number;       // etapai, laukiantys įėjimų
  workableHours: number; // val./sav. iš dirbamų etapų
  blockedHours: number;  // val./sav., kurios „atsirakins" gavus įėjimus
}

/** Etapo id → rezultato id įėjimų šablonuose. */
const STAGE_TO_RESULT: Partial<Record<StageId, string>> = { PP_VIESIMAS: 'VIESIMAS' };

export function getTeamWorkload(projects: Project[]): Record<TeamMemberId, MemberWorkload> {
  const empty = (): MemberWorkload => ({ assignments: [], total: 0, workable: 0, blocked: 0, workableHours: 0, blockedHours: 0 });
  const result: Record<TeamMemberId, MemberWorkload> = { NR: empty(), KV: empty(), LL: empty(), EXT: empty() };

  for (const p of projects) {
    if (p.archived || p.paused) continue;
    const active = p.activeStages ?? [];
    for (const [sid, assignees] of Object.entries(p.stageAssignees ?? {})) {
      const stageId = sid as StageId;
      if (!active.includes(stageId)) continue;
      const resultId = STAGE_TO_RESULT[stageId] ?? stageId;
      const readiness = getResultReadiness(p, resultId);
      for (const a of assignees ?? []) {
        const mw = result[a];
        if (!mw) continue;
        const assignment: StageAssignment = {
          projectId: p.id,
          projectName: projectLabel(p),
          stageId,
          blocked: !readiness.ready,
          missing: readiness.missing,
          hoursPerWeek: stageWeeklyHours(p, stageId, a),
        };
        mw.assignments.push(assignment);
        mw.total += 1;
        if (assignment.blocked) { mw.blocked += 1; mw.blockedHours += assignment.hoursPerWeek; }
        else { mw.workable += 1; mw.workableHours += assignment.hoursPerWeek; }
      }
    }
  }

  return result;
}

export type LoadLevel = 'ok' | 'high' | 'over';

/** Perkrovos lygis pagal dirbamas valandas vs savaitės pajėgumą. */
export function loadLevel(workableHours: number, capacity: number): LoadLevel {
  if (capacity <= 0) return 'ok';
  const util = workableHours / capacity;
  if (util > 1) return 'over';
  if (util >= 0.8) return 'high';
  return 'ok';
}
