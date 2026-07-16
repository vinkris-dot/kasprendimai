import { Project, TeamMemberId } from './types';
import { projectLabel } from './defaultData';
import { partCompleted } from './inputs';
import { todayLT, addDaysStr } from './dates';

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
  stage?: import('./types').StageId; // kuriam etapui užduotis priklauso (rodoma etapo kortelėje)
}

// ─── Auto-task generation (mirrors getSmartPlan but adds assignees + stage tasks) ─────

export function generateAutoTasks(project: Project): TaskItem[] {
  const doc = (id: string) => project.dokumentai?.find(d => d.id === id);
  const ts = project.taskStatuses ?? {};
  const active = project.activeStages ?? ['SR'];
  // Baigtumas per partCompleted (ne completedStages): faktinė pabaiga užskaitoma
  // ir tada, kai completedStages išvalytas baigus paskutinį aktyvų etapą.
  const ppDone = partCompleted(project, 'PP');

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
      taskKey: 'get-02-03', stage: 'SR', label: 'Gauti pagrindinius dokumentus', sub: missing,
      assignee: 'NR', checkable: false, dueDate: ts['get-02-03']?.dueDate, doneAt: ts['get-02-03']?.doneAt,
      isManual: false,
    });
  }

  // 2. Prepare authorization 00 (needs 02+03)
  if (!d00?.received && !ts['order-00']?.doneAt) {
    tasks.push({
      taskKey: 'order-00', stage: 'SR', label: 'Parengti įgaliojimą (00)',
      sub: has02 && has03 ? '02 ir 03 gauta ✓' : 'laukia 02 ir 03',
      assignee: 'NR', checkable: has02 && has03,
      dueDate: ts['order-00']?.dueDate, doneAt: ts['order-00']?.doneAt, isManual: false,
    });
  }

  // 3. Parallel document tasks
  if (!d07?.received && !ts['order-07']?.doneAt) {
    tasks.push({
      taskKey: 'order-07', stage: 'SR', label: 'Toponuotrauka (07)',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-07']?.dueDate, doneAt: ts['order-07']?.doneAt, isManual: false,
    });
  }
  if (!has04 && !ts['order-04']?.doneAt) {
    tasks.push({
      taskKey: 'order-04', stage: 'SR', label: 'Teritorijų planavimo ištrauka (04)',
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
        taskKey: 'order-06', stage: 'SR', label: 'Prisijungimo sąlygos (06)', sub: missingConn.join(', '),
        assignee: 'NR', checkable: true,
        dueDate: ts['order-06']?.dueDate, doneAt: ts['order-06']?.doneAt, isManual: false,
      });
    }
  }
  if (!d05?.received && !ts['order-05']?.doneAt) {
    tasks.push({
      taskKey: 'order-05', stage: 'SR', label: 'SR pažyma (05)',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-05']?.dueDate, doneAt: ts['order-05']?.doneAt, isManual: false,
    });
  }

  // ── Stage-transition tasks ────────────────────────────────────────────────

  // When docs 01-04 received + SR active → can start PP
  if (has02 && has03 && has04 && active.includes('SR') && !ts['start-pp']?.doneAt) {
    tasks.push({
      taskKey: 'start-pp', stage: 'SR', label: 'Pradėti PP brėžinius',
      assignee: 'KV', checkable: true,
      dueDate: ts['start-pp']?.dueDate, doneAt: ts['start-pp']?.doneAt, isManual: false,
    });
  }

  // When docs ready + SR active → order SR+PS+territory docs
  if (has02 && has03 && active.includes('SR') && !ts['order-sr-docs']?.doneAt) {
    tasks.push({
      taskKey: 'order-sr-docs', stage: 'SR', label: 'Užsakyti SR+PS+teritorijų planavimo dok.',
      assignee: 'NR', checkable: true,
      dueDate: ts['order-sr-docs']?.dueDate, doneAt: ts['order-sr-docs']?.doneAt, isManual: false,
    });
  }

  // PP aktyvus → užbaigimas: LL — brėžiniai, NR — aiškinamasis raštas ir kiti dokumentai
  if (active.includes('PP') && !ts['finish-pp-breziniai']?.doneAt) {
    tasks.push({
      taskKey: 'finish-pp-breziniai', stage: 'PP', label: 'Užbaigti PP brėžinius',
      assignee: 'LL', checkable: true,
      dueDate: ts['finish-pp-breziniai']?.dueDate, doneAt: ts['finish-pp-breziniai']?.doneAt, isManual: false,
    });
  }
  if (active.includes('PP') && !ts['pp-ar-dokumentai']?.doneAt) {
    tasks.push({
      taskKey: 'pp-ar-dokumentai', stage: 'PP', label: 'PP aiškinamasis raštas ir kiti dokumentai',
      assignee: 'NR', checkable: true,
      dueDate: ts['pp-ar-dokumentai']?.dueDate, doneAt: ts['pp-ar-dokumentai']?.doneAt, isManual: false,
    });
  }

  // PP completed → TDP startas nuo SA (architektūra pirma, po jos SP)
  if (ppDone && (project.selectedParts.SP || project.selectedParts.SA) && !ts['start-sp-sa']?.doneAt) {
    tasks.push({
      taskKey: 'start-sp-sa', stage: 'TDP', label: 'Pradėti SA brėžinius (TDP startas)',
      assignee: 'LL', checkable: true,
      dueDate: ts['start-sp-sa']?.dueDate, doneAt: ts['start-sp-sa']?.doneAt, isManual: false,
    });
  }

  // PP completed → priduoti SLD. Pridavimui VISADA privaloma PP + 00 + 05 + 06,
  // todėl žymėti galima tik kai dokumentai yra; iki tol rodoma, ko laukiama.
  if (project.selectedParts.SLD && ppDone
      && !active.includes('SLD') && !partCompleted(project, 'SLD')
      && !ts['start-sld']?.doneAt) {
    const missingSld = [
      !d00?.received && '00 įgaliojimas',
      !d05?.received && '05 SR',
      !d06?.received && '06 prisijungimo sąlygos',
    ].filter(Boolean).join(', ');
    tasks.push({
      taskKey: 'start-sld', stage: 'SLD', label: 'Priduoti SLD (Infostatyba)',
      sub: missingSld ? `laukia: ${missingSld}` : 'PP + 00 + 05 + 06 ✓',
      assignee: 'NR', checkable: !missingSld,
      dueDate: ts['start-sld']?.dueDate, doneAt: ts['start-sld']?.doneAt, isManual: false,
    });
  }

  // PP completed → start TDP (TDP eina lygiagrečiai su SLD derinimu, ne po jo).
  // Kai pasirinkta SP/SA, startą dengia „Pradėti SP+SA brėžinius" — nedubliuojam.
  if (ppDone && project.selectedParts.TDP
      && !(project.selectedParts.SP || project.selectedParts.SA)
      && !active.includes('TDP') && !partCompleted(project, 'TDP')
      && !ts['start-tdp']?.doneAt) {
    tasks.push({
      taskKey: 'start-tdp', stage: 'TDP', label: 'Pradėti TDP',
      assignee: 'LL', checkable: true,
      dueDate: ts['start-tdp']?.dueDate, doneAt: ts['start-tdp']?.doneAt, isManual: false,
    });
  }

  // TDP baigtas → atiduoti ekspertizei (SLD gautas — soft, nestabdo)
  if (project.selectedParts.EKSPERTIZE && partCompleted(project, 'TDP')
      && !active.includes('EKSPERTIZE') && !partCompleted(project, 'EKSPERTIZE')
      && !ts['start-ekspertize']?.doneAt) {
    tasks.push({
      taskKey: 'start-ekspertize', stage: 'EKSPERTIZE', label: 'Atiduoti projektą ekspertizei',
      sub: partCompleted(project, 'SLD') ? 'TDP baigtas ✓, SLD gautas ✓' : 'TDP baigtas ✓ (SLD dar derinamas)',
      assignee: 'NR', checkable: true,
      dueDate: ts['start-ekspertize']?.dueDate, doneAt: ts['start-ekspertize']?.doneAt, isManual: false,
    });
  }

  // Unanswered motyvuoti atsakymai
  const unanswered = (project.motyvuotiAtsakymai ?? []).filter(m => !m.atsakyta);
  if (unanswered.length > 0 && !ts['answer-motyvuoti']?.doneAt) {
    tasks.push({
      taskKey: 'answer-motyvuoti', stage: 'SLD',
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
      projectName: projectLabel(project),
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
      projectName: projectLabel(project),
      label: t.label,
      assignee: t.assignee,
      dueDate: ts[t.id]?.dueDate ?? t.dueDate,
      doneAt: ts[t.id]?.doneAt,
      isManual: true,
      checkable: true,
      stage: t.stage,
    }));
}

// ─── Aggregate all tasks across all projects ──────────────────────────────────

export function getAllTasks(projects: Project[]): TaskItem[] {
  const result: TaskItem[] = [];
  for (const p of projects) {
    if (p.archived || p.paused) continue; // pristabdytas projektas užduočių neturi
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
  // Viskas lyginama YYYY-MM-DD eilutėmis pagal Lietuvos laiką — anksčiau UTC data
  // naktį (00–03 val.) persislinkdavo per dieną, o savaitės riba maišė juostas.
  const todayStr = todayLT();
  const dayOfWeek = new Date(todayStr + 'T00:00:00Z').getUTCDay(); // 0=Sun
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const weekEndStr = addDaysStr(todayStr, daysToSunday);

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
    if (t.dueDate <= weekEndStr) { thisWeek.push(t); continue; }
    later.push(t);
  }

  return { overdue, today, thisWeek, later };
}
