import { Project, StageId, TeamMemberId } from './types';
import { getResultReadiness } from './inputs';
import { projectLabel } from './defaultData';

// ─────────────────────────────────────────────────────────────────────────────
// Komandos apkrova: kiek lygiagrečių aktyvių etapų žmogus tempia.
// Etapas, kuriam trūksta įėjimų (žr. lib/inputs.ts), yra „užblokuotas" —
// jis laukia, o ne dirbamas, todėl į realų krūvį neskaičiuojamas.
// ─────────────────────────────────────────────────────────────────────────────

export interface StageAssignment {
  projectId: string;
  projectName: string;
  stageId: StageId;
  blocked: boolean;  // trūksta įėjimų — dirbti dar negalima
  missing: number;   // kiek įėjimų trūksta
}

export interface MemberWorkload {
  assignments: StageAssignment[];
  total: number;     // visi aktyvūs priskirti etapai
  workable: number;  // etapai, kuriuos realiai galima dirbti
  blocked: number;   // etapai, laukiantys įėjimų
}

/** Etapo id → rezultato id įėjimų šablonuose. */
const STAGE_TO_RESULT: Partial<Record<StageId, string>> = { PP_VIESIMAS: 'VIESIMAS' };

export function getTeamWorkload(projects: Project[]): Record<TeamMemberId, MemberWorkload> {
  const result: Record<TeamMemberId, MemberWorkload> = {
    NR: { assignments: [], total: 0, workable: 0, blocked: 0 },
    KV: { assignments: [], total: 0, workable: 0, blocked: 0 },
    LL: { assignments: [], total: 0, workable: 0, blocked: 0 },
    EXT: { assignments: [], total: 0, workable: 0, blocked: 0 },
  };

  for (const p of projects) {
    if (p.archived || p.paused) continue;
    const active = p.activeStages ?? [];
    for (const [sid, assignees] of Object.entries(p.stageAssignees ?? {})) {
      const stageId = sid as StageId;
      if (!active.includes(stageId)) continue;
      const resultId = STAGE_TO_RESULT[stageId] ?? stageId;
      const readiness = getResultReadiness(p, resultId);
      const assignment: StageAssignment = {
        projectId: p.id,
        projectName: projectLabel(p),
        stageId,
        blocked: !readiness.ready,
        missing: readiness.missing,
      };
      for (const a of assignees ?? []) {
        const mw = result[a];
        if (!mw) continue;
        mw.assignments.push(assignment);
        mw.total += 1;
        if (assignment.blocked) mw.blocked += 1;
        else mw.workable += 1;
      }
    }
  }

  return result;
}

export type LoadLevel = 'ok' | 'high' | 'over';

/** Perkrovos lygis pagal dirbamų (ne užblokuotų) etapų skaičių. */
export function loadLevel(workable: number): LoadLevel {
  if (workable >= 7) return 'over';
  if (workable >= 4) return 'high';
  return 'ok';
}
