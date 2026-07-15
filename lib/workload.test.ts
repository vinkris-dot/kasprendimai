import { describe, it, expect } from 'vitest';
import { getTeamWorkload, loadLevel } from './workload';
import { createDefaultProject, DEFAULT_PARTS } from './defaultData';
import { Project, StageId, TeamMemberId } from './types';

let seq = 0;
function makeProject(overrides: Partial<Project> = {}): Project {
  seq += 1;
  return {
    id: `p${seq}`,
    name: `Projektas ${seq}`,
    address: '',
    client: '',
    clientEmail: '',
    completedStages: [],
    startDate: '2026-01-01',
    targetConstructionDate: '2026-06-01',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...createDefaultProject(),
    selectedParts: { ...DEFAULT_PARTS },
    ...overrides,
  } as Project;
}

function markAllReceived(p: Project) {
  p.dokumentai = p.dokumentai.map(d => ({ ...d, received: true }));
}

describe('getTeamWorkload', () => {
  it('skaičiuoja aktyvius priskirtus etapus žmogui', () => {
    // Numatyta: SR→NR. Du projektai su aktyviu SR → NR total 2.
    const w = getTeamWorkload([makeProject(), makeProject()]);
    expect(w.NR.total).toBe(2);
    expect(w.KV.total).toBe(0);
  });

  it('neaktyvūs etapai, pristabdyti ir archyvuoti projektai neskaičiuojami', () => {
    const paused = makeProject({ paused: true });
    const archived = makeProject({ archived: true });
    const inactive = makeProject({ activeStages: [] as StageId[] });
    const w = getTeamWorkload([paused, archived, inactive]);
    expect(w.NR.total).toBe(0);
  });

  it('etapas be įėjimų — užblokuotas; su įėjimais — dirbamas', () => {
    const blocked = makeProject(); // SR aktyvus, 02/03 negauti → blocked
    const ready = makeProject();
    markAllReceived(ready);
    const w = getTeamWorkload([blocked, ready]);
    expect(w.NR.total).toBe(2);
    expect(w.NR.blocked).toBe(1);
    expect(w.NR.workable).toBe(1);
    const b = w.NR.assignments.find(a => a.projectId === blocked.id);
    expect(b).toMatchObject({ blocked: true, missing: 2 });
  });

  it('vienas etapas keliems žmonėms skaičiuojasi kiekvienam', () => {
    const p = makeProject({ activeStages: ['PP'] as StageId[] }); // PP→KV+NR pagal DEFAULT_STAGE_ASSIGNEES
    const w = getTeamWorkload([p]);
    expect(w.KV.total).toBe(1);
    expect(w.NR.total).toBe(1);
  });

  it('PP_VIESIMAS naudoja VIESIMAS įėjimų šabloną (laukia PP)', () => {
    const p = makeProject({
      activeStages: ['PP_VIESIMAS'] as StageId[],
      stageAssignees: { PP_VIESIMAS: ['NR'] as TeamMemberId[] },
    });
    // PP nebaigtas (nėra completed, o aktyvus tik PP_VIESIMAS → PP praeitas pagal
    // grafiko konvenciją... PP eina PRIEŠ PP_VIESIMAS, tad laikomas baigtu → workable)
    const w = getTeamWorkload([p]);
    expect(w.NR.total).toBe(1);
    expect(w.NR.workable).toBe(1);
  });
});

describe('loadLevel', () => {
  it('ribos: <4 ok, 4–6 high, >=7 over', () => {
    expect(loadLevel(0)).toBe('ok');
    expect(loadLevel(3)).toBe('ok');
    expect(loadLevel(4)).toBe('high');
    expect(loadLevel(6)).toBe('high');
    expect(loadLevel(7)).toBe('over');
  });
});
