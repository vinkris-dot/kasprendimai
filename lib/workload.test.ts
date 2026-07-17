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
    // Numatyta: SR→NR+KV (KV — pirminė analizė). Du projektai su aktyviu SR.
    const w = getTeamWorkload([makeProject(), makeProject()]);
    expect(w.NR.total).toBe(2);
    expect(w.KV.total).toBe(2);
    expect(w.LL.total).toBe(0);
  });

  it('neaktyvūs etapai, pristabdyti ir archyvuoti projektai neskaičiuojami', () => {
    const paused = makeProject({ paused: true });
    const archived = makeProject({ archived: true });
    const inactive = makeProject({ activeStages: [] as StageId[] });
    const w = getTeamWorkload([paused, archived, inactive]);
    expect(w.NR.total).toBe(0);
  });

  it('SR be fakto pradžios — nepradėtas (vaiduoklis), su pradžia — dirbamas', () => {
    const ghost = makeProject(); // aktyvus SR, bet fakto pradžios nėra
    const working = makeProject({ stageStatuses: { SR: { startDate: '2026-01-05', endDate: '', completed: false, notes: '' } } });
    const w = getTeamWorkload([ghost, working]);
    expect(w.NR.blocked).toBe(0);
    expect(w.NR.startable).toBe(1);
    expect(w.NR.worked).toBe(1);
    const g = w.NR.assignments.find(a => a.projectId === ghost.id);
    expect(g).toMatchObject({ state: 'nepradeta' });
  });
  it('SLD užblokuotas kietais įėjimais; gavus viską be pradžios — nepradėtas', () => {
    const blocked = makeProject({ activeStages: ['SLD'] as StageId[] });
    const ready = makeProject({ activeStages: ['SLD'] as StageId[], completedStages: ['PP'] as StageId[] });
    markAllReceived(ready);
    const w = getTeamWorkload([blocked, ready]);
    expect(w.NR.blocked).toBe(1);
    expect(w.NR.startable).toBe(1);
    const b = w.NR.assignments.find(a => a.projectId === blocked.id);
    expect(b).toMatchObject({ blocked: true, state: 'laukia' });
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
    // PP praeitas pagal grafiko konvenciją → atrakinta; be fakto pradžios — nepradėtas
    const w = getTeamWorkload([p]);
    expect(w.NR.total).toBe(1);
    expect(w.NR.startable).toBe(1);
  });
});

describe('valandinė apkrova', () => {
  const started = (sid: string, date = '2026-01-05') => ({ [sid]: { startDate: date, endDate: '', completed: false, notes: '' } });

  it('SR etapas NR: 10 val. / 5 sav. = 2 val./sav. (su fakto pradžia)', () => {
    const p = makeProject({ stageStatuses: started('SR') });
    markAllReceived(p);
    const w = getTeamWorkload([p]);
    expect(w.NR.workedHours).toBeCloseTo(2, 1);
  });
  it('PP etapas: KV 72 val./8 sav. = 9, NR 7/8', () => {
    const p = makeProject({ activeStages: ['PP'] as StageId[], stageStatuses: started('PP') });
    markAllReceived(p);
    const w = getTeamWorkload([p]);
    expect(w.KV.workedHours).toBeCloseTo(9, 1);
    expect(w.NR.workedHours).toBeCloseTo(7 / 8, 1);
  });
  it('užblokuoto etapo valandos eina į blockedHours (SLD be įėjimų: 12 val./6 sav.)', () => {
    const p = makeProject({ activeStages: ['SLD'] as StageId[] });
    const w = getTeamWorkload([p]);
    expect(w.NR.workedHours).toBe(0);
    expect(w.NR.blockedHours).toBeCloseTo(2, 1);
  });
  it('nepradėto (be fakto pradžios) etapo valandos eina į startableHours', () => {
    const p = makeProject(); // SR aktyvus, atrakintas, be pradžios
    const w = getTeamWorkload([p]);
    expect(w.NR.workedHours).toBe(0);
    expect(w.NR.startableHours).toBeCloseTo(2, 1);
  });
  it('KV pirminė analizė SR etape: 3 val. / 5 sav. = 0.6 val./sav.', () => {
    const p = makeProject({ stageStatuses: started('SR') });
    const w = getTeamWorkload([p]);
    expect(w.KV.workedHours).toBeCloseTo(0.6, 1);
  });
  it('TDP: pasirinktų dalių suma paskleista per bloką (SP+SA: 43 val. / 3 sav.)', () => {
    const p = makeProject({
      activeStages: ['TDP'] as StageId[],
      selectedParts: { ...DEFAULT_PARTS, SP: true, SA: true },
      stageAssignees: { TDP: ['LL'] as TeamMemberId[] },
      stageStatuses: started('TDP'),
    });
    markAllReceived(p);
    p.completedStages = ['SLD'] as StageId[];
    const w = getTeamWorkload([p]);
    // TDP blokas pagal fazes: SA 14 + SP 7 = 21 d. = 3 sav.; (12+31)/3 ≈ 14.3
    // (2026-07-16: LL PP 24 val., SA 48→31, SP 19→12)
    expect(w.LL.workedHours).toBeCloseTo(14.3, 1);
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
