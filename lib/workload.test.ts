import { describe, it, expect } from 'vitest';
import { getTeamWorkload, loadLevel, WEEKLY_CAPACITY } from './workload';
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

describe('valandinė apkrova', () => {
  it('SR etapas NR: 10 val. / 5 sav. = 2 val./sav.', () => {
    const p = makeProject();
    markAllReceived(p);
    const w = getTeamWorkload([p]);
    expect(w.NR.workableHours).toBeCloseTo(2, 1);
  });
  it('PP etapas: KV 72 val./8 sav. = 9, NR 7/8', () => {
    const p = makeProject({ activeStages: ['PP'] as StageId[] });
    markAllReceived(p);
    const w = getTeamWorkload([p]);
    expect(w.KV.workableHours).toBeCloseTo(9, 1);
    expect(w.NR.workableHours).toBeCloseTo(7 / 8, 1);
  });
  it('užblokuoto etapo valandos eina į blockedHours', () => {
    const p = makeProject(); // SR be dokumentų → blocked
    const w = getTeamWorkload([p]);
    expect(w.NR.workableHours).toBe(0);
    expect(w.NR.blockedHours).toBeCloseTo(2, 1);
  });
  it('TDP: pasirinktų dalių suma paskleista per bloką (SP+SA: 67 val. / 5 sav.)', () => {
    const p = makeProject({
      activeStages: ['TDP'] as StageId[],
      selectedParts: { ...DEFAULT_PARTS, SP: true, SA: true },
      stageAssignees: { TDP: ['LL'] as TeamMemberId[] },
    });
    markAllReceived(p);
    p.completedStages = ['SLD'] as StageId[];
    const w = getTeamWorkload([p]);
    // TDP blokas: 14 bazė + 7 SP + 14 SA = 35 d. = 5 sav.; (19+48)/5 = 13.4
    expect(w.LL.workableHours).toBeCloseTo(13.4, 1);
  });
});

describe('loadLevel', () => {
  it('pagal panaudojimą: <80% ok, 80–100% high, >100% over', () => {
    expect(loadLevel(10, 35)).toBe('ok');
    expect(loadLevel(28, 35)).toBe('high');
    expect(loadLevel(36, 35)).toBe('over');
    expect(loadLevel(5, 0)).toBe('ok'); // EXT be pajėgumo
  });
  it('pajėgumai pagal Kristinos įvestį', () => {
    expect(WEEKLY_CAPACITY.NR).toBe(35);
    expect(WEEKLY_CAPACITY.KV).toBe(20);
    expect(WEEKLY_CAPACITY.LL).toBe(35);
  });
});
