'use client';

import { Project, StageId, StageStatus } from '@/lib/types';
import { getStageToggleGuard } from '@/lib/inputs';
import { STAGES } from '@/lib/defaultData';
import { todayLT } from '@/lib/dates';

/**
 * toggleStage su patvirtinimu: rizikingi perjungimai (užbaigimas be sąlygų,
 * fakto pabaigos valymas, užrakinto etapo aktyvavimas su „ankstesnių"
 * kaskada) klausia prieš darant; švarūs perjungimai lieka vieno paspaudimo.
 * Užbaigiant be fakto pradžios — pasiūloma ją įrašyti.
 */
export function guardedToggleStage(
  project: Project,
  stageId: StageId,
  actions: {
    toggleStage: (projectId: string, stageId: StageId) => void;
    updateProject: (projectId: string, changes: Partial<Project>) => void;
  },
) {
  const guard = getStageToggleGuard(project, stageId);
  const name = STAGES.find(s => s.id === stageId)?.shortName ?? stageId;

  const warnings = [...guard.warnings];
  if (guard.implicitDone.length) {
    const names = guard.implicitDone
      .map(s => STAGES.find(x => x.id === s)?.shortName ?? s)
      .join(', ');
    warnings.push(`Ankstesni etapai (${names}) bus rodomi kaip baigti be fakto datų.`);
  }

  const needsConfirm = guard.action === 'reactivate' || warnings.length > 0;
  if (needsConfirm) {
    const header =
      guard.action === 'complete' ? `Užbaigti etapą „${name}" šiandien?`
      : guard.action === 'reactivate' ? `Grąžinti etapą „${name}" į aktyvius?`
      : `Pradėti etapą „${name}"?`;
    const body = warnings.map(w => `• ${w}`).join('\n');
    if (!window.confirm(body ? `${header}\n\n${body}` : header)) return;
  }

  if (guard.action === 'complete' && guard.missingStart) {
    const answer = window.prompt(
      `Etapo „${name}" fakto pradžia nesuvesta.\nĮrašyk pradžios datą (pvz., ${todayLT()}) arba palik tuščią:`,
      todayLT(),
    );
    if (answer === null) return; // Atšaukta — neužbaigiam
    const v = answer.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const status = project.stageStatuses?.[stageId] ?? ({} as StageStatus);
      actions.updateProject(project.id, {
        stageStatuses: { ...project.stageStatuses, [stageId]: { ...status, startDate: v } },
      });
    }
  }

  actions.toggleStage(project.id, stageId);
}
