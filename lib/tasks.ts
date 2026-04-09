import { Project, TeamMemberId } from './types';

export interface TaskItem {
  key: string;           // unique per-project: `${projectId}:${taskKey}`
  taskKey: string;       // the raw task key (used in taskStatuses)
  projectId: string;
  projectName: string;
  label: string;
  sub?: string;
  assignee?: TeamMemberId;
  dueDate?: string;      // YYYY-MM-DD
  doneAt?: string;
  isManual: boolean;
  checkable: boolean;
}

// ─── Auto-task generation (mirrors getSmartPlan but adds assignees + stage tasks) ─────

export function generateAutoTasks(project: Project): TaskItem[] {
  const doc = (id: string) => project.dokumentai?.find(d => d.id === id);
  const ts = project.taskStatuses ?? {};
  const completed = project.completedStages ?? [];
  const active = project.activeStages ?? ['SR'];

  const d00 = doc('doc-00');
  const d02 = doc('doc-02');
  const d03 = doc('doc-03');
  const d04 = doc('doc-04');
  const d05 = doc('doc-05');
  const d06 = doc('doc-06');
  const d07 = doc('doc-07');

  const has02 = d02?.received ?? false;
  const has03 = d03?.received ?? false;
  const has04 = d04?.received ?? false;

  const tasks: Omit<TaskItem, 'key' | 'projectId' | 'projectName'>[] = [];

  // ── Document chain tasks ──────────────────────────────────────────────────

  // 1. Get core docs 02+03
  if (!has02 || !has03) {
    const missing = [!has02 && '02 nuosavybė', !has03 && '03 sklypo ribų planas']
      .filter(Boolean).join(', ');
    tasks.push({
      taskKey: 'get-02-03', label: 'Gauti pagrindinius dokumentus', sub: missing,
      assignee: 'NR', checkable: false, dueDate: ts['get-02-03']?.dueDate, doneAt: ts['get-02-03']?.doneAt,
      isManual: false,
    });
  }

  // 2. Prepare authorization 00 (needs 02+03)
  if (!d00?.received && !ts['order-00']?.doneAt) {
    tasks.push({
      taskKey: 'order-00', label: 'Parengti įgaliojimą (00)',
      sub: has02 && has03 ? '02 ir 03 gauta ✓' : 'laukia 02 ir 03',
      assignee: 'NR', checkable: has02 && has03,
      dueDate: ts['order-00']?.dueDate, doneAt: ts['order-00']?.doneAt, isManual: false,
    });
  }

  // 3. Parallel document tasks
  if (!d07?.received && !ts['order-07']?.doneAt) {
    tasks.push({
      taskKey: 'order-07', label: 'Toponuotrauka (07)',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-07']?.dueDate, doneAt: ts['order-07']?.doneAt, isManual: false,
    });
  }
  if (!has04 && !ts['order-04']?.doneAt) {
    tasks.push({
      taskKey: 'order-04', label: 'Teritorijų planavimo ištrauka (04)',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-04']?.dueDate, doneAt: ts['order-04']?.doneAt, isManual: false,
    });
  }
  if (d06) {
    const dates = d06.connectionDates ?? {};
    const missingConn = [
      !dates.vanduo && 'vanduo/nuotekos', !dates.lietus && 'lietus',
      !dates.kelias && 'kelias', !dates.elektra && 'elektra',
      !dates.rysiai && 'ryšiai', !dates.dujos && 'dujos',
    ].filter(Boolean) as string[];
    if (missingConn.length > 0 && !ts['order-06']?.doneAt) {
      tasks.push({
        taskKey: 'order-06', label: 'Prisijungimo sąlygos (06)', sub: missingConn.join(', '),
        assignee: 'NR', checkable: true,
        dueDate: ts['order-06']?.dueDate, doneAt: ts['order-06']?.doneAt, isManual: false,
      });
    }
  }
  if (!d05?.received && !ts['order-05']?.doneAt) {
    tasks.push({
      taskKey: 'order-05', label: 'SR pažyma (05)',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-05']?.dueDate, doneAt: ts['order-05']?.doneAt, isManual: false,
    });
  }

  // ── Stage-transition tasks ────────────────────────────────────────────────

  // When docs 01-04 received + SR active → can start PP
  if (has02 && has03 && has04 && active.includes('SR') && !ts['start-pp']?.doneAt) {
    tasks.push({
      taskKey: 'start-pp', label: 'Pradėti PP brėžinius',
      assignee: 'KV', checkable: true,
      dueDate: ts['start-pp']?.dueDate, doneAt: ts['start-pp']?.doneAt, isManual: false,
    });
  }

  // When docs ready + SR active → order SR+PS+territory docs
  if (has02 && has03 && active.includes('SR') && !ts['order-sr-docs']?.doneAt) {
    tasks.push({
      taskKey: 'order-sr-docs', label: 'Užsakyti SR+PS+teritorijų planavimo dok.',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-sr-docs']?.dueDate, doneAt: ts['order-sr-docs']?.doneAt, isManual: false,
    });
  }

  // PP completed → start SP+SA
  if (completed.includes('PP') && !ts['start-sp-sa']?.doneAt) {
    tasks.push({
      taskKey: 'start-sp-sa', label: 'Pradėti SP+SA brėžinius',
      assignee: 'LL', checkable: true,
      dueDate: ts['start-sp-sa']?.dueDate, doneAt: ts['start-sp-sa']?.doneAt, isManual: false,
    });
  }

  // PP completed → start SLD coordination
  if (completed.includes('PP') && !ts['start-sld']?.doneAt) {
    tasks.push({
      taskKey: 'start-sld', label: 'Pradėti SLD derinimą',
      assignee: 'NR', checkable: true,
      dueDate: ts['start-sld']?.dueDate, doneAt: ts['start-sld']?.doneAt, isManual: false,
    });
  }

  // SLD completed → start TDP
  if (completed.includes('SLD') && project.selectedParts.TDP && !ts['start-tdp']?.doneAt) {
    tasks.push({
      taskKey: 'start-tdp', label: 'Pradėti TDP',
      assignee: 'LL', checkable: true,
      dueDate: ts['start-tdp']?.dueDate, doneAt: ts['start-tdp']?.doneAt, isManual: false,
    });
  }

  // Unanswered motyvuoti atsakymai
  const unanswered = (project.motyvuotiAtsakymai ?? []).filter(m => !m.atsakyta);
  if (unanswered.length > 0 && !ts['answer-motyvuoti']?.doneAt) {
    tasks.push({
      taskKey: 'answer-motyvuoti',
      label: `Atsakyti savivaldybei (${unanswered.length} neatsakyta)`,
      assignee: 'NR', checkable: true,
      dueDate: ts['answer-motyvuoti']?.dueDate, doneAt: ts['answer-motyvuoti']?.doneAt, isManual: false,
    });
  }

  // Filter out done tasks, then attach project info
  return tasks
    .filter(t => !t.doneAt)
    .map(t => ({
      ...t,
      key: `${project.id}:${t.taskKey}`,
      projectId: project.id,
      projectName: project.name,
    }));
}

// ─── Manual tasks ─────────────────────────────────────────────────────────────

export function getManualTaskItems(project: Project): TaskItem[] {
  const ts = project.taskStatuses ?? {};
  return (project.manualTasks ?? [])
    .filter(t => !ts[t.id]?.doneAt)
    .map(t => ({
      key: `${project.id}:${t.id}`,
      taskKey: t.id,
      projectId: project.id,
      projectName: project.name,
      label: t.label,
      assignee: t.assignee,
      dueDate: ts[t.id]?.dueDate ?? t.dueDate,
      doneAt: ts[t.id]?.doneAt,
      isManual: true,
      checkable: true,
    }));
}

// ─── Aggregate all tasks across all projects ──────────────────────────────────

export function getAllTasks(projects: Project[]): TaskItem[] {
  const result: TaskItem[] = [];
  for (const p of projects) {
    if (p.archived) continue;
    result.push(...generateAutoTasks(p));
    result.push(...getManualTaskItems(p));
  }
  return result;
}

// ─── Group by urgency ─────────────────────────────────────────────────────────

export type TaskGroups = {
  overdue: TaskItem[];
  today: TaskItem[];
  thisWeek: TaskItem[];
  later: TaskItem[];
};

export function groupByUrgency(tasks: TaskItem[]): TaskGroups {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = now.toISOString().slice(0, 10);

  // End of this week (Sunday)
  const weekEnd = new Date(now);
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  weekEnd.setDate(now.getDate() + daysToSunday);
  weekEnd.setHours(23, 59, 59, 999);

  const overdue: TaskItem[] = [];
  const today: TaskItem[] = [];
  const thisWeek: TaskItem[] = [];
  const later: TaskItem[] = [];

  for (const t of tasks) {
    if (!t.dueDate) {
      later.push(t);
      continue;
    }
    if (t.dueDate < todayStr) { overdue.push(t); continue; }
    if (t.dueDate === todayStr) { today.push(t); continue; }
    const d = new Date(t.dueDate);
    if (d <= weekEnd) { thisWeek.push(t); continue; }
    later.push(t);
  }

  return { overdue, today, thisWeek, later };
}
