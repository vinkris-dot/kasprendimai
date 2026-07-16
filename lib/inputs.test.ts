import { describe, it, expect } from 'vitest';
import { getResultInputs, getInputStatus, getResultReadiness, getProjectResultIds, getUnlockPriorities, getStageProcessInfo, isProjectFinished, DEFAULT_RESULT_INPUTS } from './inputs';
import { createDefaultProject, DEFAULT_PARTS } from './defaultData';
import { Project, ResultInput } from './types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Testas',
    address: '',
    client: '',
    clientEmail: '',
    completedStages: [],
    startDate: '2026-01-01',
    targetConstructionDate: '2026-06-01',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...createDefaultProject(),
    selectedParts: { ...DEFAULT_PARTS, SP: true, SA: true },
    ...overrides,
  } as Project;
}

function markReceived(project: Project, ...docIds: string[]) {
  project.dokumentai = project.dokumentai.map(d =>
    docIds.includes(d.id) ? { ...d, received: true } : d,
  );
}

describe('getResultInputs', () => {
  it('be įrašų grąžina šabloną', () => {
    const p = makeProject();
    expect(getResultInputs(p, 'PP')).toEqual(DEFAULT_RESULT_INPUTS.PP);
  });
  it('išsaugotas sąrašas nustelbia šabloną', () => {
    const custom: ResultInput[] = [{ id: 'x', label: 'Skambutis geodezininkui', kind: 'skambutis', status: 'yra' }];
    const p = makeProject({ inputs: { PP: custom } });
    expect(getResultInputs(p, 'PP')).toEqual(custom);
  });
});

describe('getInputStatus', () => {
  it('dokumentas: nera → uzsakyta → yra', () => {
    const p = makeProject();
    const input: ResultInput = { id: 'i', label: 'Topo', kind: 'dokumentas', docId: 'doc-07' };
    expect(getInputStatus(p, input)).toBe('nera');
    p.dokumentai = p.dokumentai.map(d => d.id === 'doc-07' ? { ...d, orderedDate: '2026-01-05' } : d);
    expect(getInputStatus(p, input)).toBe('uzsakyta');
    markReceived(p, 'doc-07');
    expect(getInputStatus(p, input)).toBe('yra');
  });
  it('rezultatas: nepradėtas → vyksta → baigtas', () => {
    const p = makeProject();
    const input: ResultInput = { id: 'i', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' };
    p.activeStages = ['SR'];
    expect(getInputStatus(p, input)).toBe('nera');
    p.activeStages = ['PP'];
    expect(getInputStatus(p, input)).toBe('uzsakyta');
    p.completedStages = ['PP'];
    p.activeStages = ['SLD'];
    expect(getInputStatus(p, input)).toBe('yra');
  });
  it('grafiko konvencija: etapas prieš anksčiausią aktyvų laikomas baigtu', () => {
    const p = makeProject();
    const input: ResultInput = { id: 'i', label: 'PP baigtas', kind: 'brezinys', partId: 'PP' };
    p.activeStages = ['SLD', 'TDP']; // completedStages tuščias, bet PP jau praeitas
    p.completedStages = [];
    expect(getInputStatus(p, input)).toBe('yra');
  });
  it('TDP dalis per partStatuses', () => {
    const p = makeProject();
    const input: ResultInput = { id: 'i', label: 'SP baigtas', kind: 'brezinys', partId: 'SP' };
    expect(getInputStatus(p, input)).toBe('nera');
    p.partStatuses = { SP: { startDate: '2026-03-01', endDate: '', completed: false, notes: '' } };
    expect(getInputStatus(p, input)).toBe('uzsakyta');
    p.partStatuses = { SP: { startDate: '2026-03-01', endDate: '2026-03-08', completed: true, notes: '' } };
    expect(getInputStatus(p, input)).toBe('yra');
  });
  it('rankinė būsena nesusietam įėjimui', () => {
    const p = makeProject();
    expect(getInputStatus(p, { id: 'i', label: 'Skambutis', kind: 'skambutis' })).toBe('nera');
    expect(getInputStatus(p, { id: 'i', label: 'Skambutis', kind: 'skambutis', status: 'uzsakyta' })).toBe('uzsakyta');
  });
});

describe('getResultReadiness', () => {
  it('SR: startuoja iš karto — 02/03/04/07 soft, tik užbaigimui', () => {
    const p = makeProject();
    expect(getResultReadiness(p, 'SR')).toMatchObject({ ready: true, missing: 4, hardMissing: 0, total: 4 });
    markReceived(p, 'doc-02', 'doc-03', 'doc-04', 'doc-07');
    expect(getResultReadiness(p, 'SR')).toMatchObject({ ready: true, missing: 0 });
  });
  it('PP: soft įėjimai starto neblokuoja — galima pradėti, bet trūksta užbaigimui', () => {
    const p = makeProject();
    expect(getResultReadiness(p, 'PP')).toMatchObject({ ready: true, missing: 5, hardMissing: 0, total: 5 });
    markReceived(p, 'doc-01', 'doc-02', 'doc-03', 'doc-04', 'doc-07');
    expect(getResultReadiness(p, 'PP')).toMatchObject({ ready: true, missing: 0 });
  });
  it('SLD: kieti įėjimai blokuoja startą', () => {
    const p = makeProject(); // PP nebaigtas, 00/05/06 negauti
    expect(getResultReadiness(p, 'SLD')).toMatchObject({ ready: false, hardMissing: 4 });
  });
  it('waiting skaičiuoja užsakytus', () => {
    const p = makeProject();
    p.dokumentai = p.dokumentai.map(d => d.id === 'doc-02' ? { ...d, orderedDate: '2026-01-05' } : d);
    const r = getResultReadiness(p, 'PP');
    expect(r.waiting).toBe(1);
    expect(r.missing).toBe(5);
  });
});

describe('getProjectResultIds', () => {
  it('rodo pasirinktas dalis fazių tvarka, slepia baigtas', () => {
    const p = makeProject();
    expect(getProjectResultIds(p)).toEqual(['SR', 'PP', 'SLD', 'TDP', 'SA', 'SP', 'EKSPERTIZE']);
    p.completedStages = ['PP'];
    expect(getProjectResultIds(p)).not.toContain('PP');
  });
});

describe('getUnlockPriorities', () => {
  it('PP baigimas atrakina daugiausiai (SLD, TDP, SA)', () => {
    const p = makeProject();
    markReceived(p, 'doc-00', 'doc-01', 'doc-02', 'doc-03', 'doc-04', 'doc-05', 'doc-06', 'doc-07');
    const top = getUnlockPriorities(p)[0];
    expect(top.input.partId).toBe('PP');
    expect(top.unlocks).toEqual(expect.arrayContaining(['SLD', 'TDP', 'SA']));
  });
  it('vienodi dokumentų įėjimai sujungiami', () => {
    const p = makeProject();
    const topo = getUnlockPriorities(p).find(u => u.input.docId === 'doc-07');
    expect(topo?.unlocks).toEqual(expect.arrayContaining(['PP', 'SP']));
  });
});

describe('proceso logika: TDP lygiagrečiai su SLD', () => {
  it('TDP startas atrakintas kai PP baigtas, nors SLD dar derinamas', () => {
    const p = makeProject();
    p.completedStages = ['PP'];
    p.activeStages = ['SLD', 'TDP'];
    const r = getResultReadiness(p, 'TDP');
    expect(r.ready).toBe(true); // SLD gautas — soft, starto neblokuoja
    const sld = r.inputs.find(i => i.input.id === 'in-tdp-sld');
    expect(sld?.status).toBe('uzsakyta'); // SLD vyksta — rodoma „laukiama"
  });
  it('TDP užblokuotas kol PP nebaigtas', () => {
    const p = makeProject();
    p.activeStages = ['PP'];
    const r = getResultReadiness(p, 'TDP');
    expect(r.ready).toBe(false);
    expect(r.hardMissing).toBe(1);
  });
  it('Ekspertizė laukia TDP (hard), SLD — soft', () => {
    const p = makeProject();
    p.completedStages = ['PP', 'SLD'];
    p.activeStages = ['TDP'];
    const r = getResultReadiness(p, 'EKSPERTIZE');
    expect(r.ready).toBe(false); // TDP dar vyksta
    p.completedStages = ['PP', 'SLD', 'TDP'];
    p.activeStages = ['EKSPERTIZE'];
    expect(getResultReadiness(p, 'EKSPERTIZE').ready).toBe(true);
  });
});

describe('TDP dalių fazės: SA → SP → ∥(SK,LVN,E) → ŠVOK → ∥(kitos) → BD', () => {
  const done = { startDate: '2026-03-01', endDate: '2026-03-15', completed: true, notes: '' };
  it('SA po PP; SP laukia SA; SK laukia SP ir 06', () => {
    const p = makeProject({ selectedParts: { ...DEFAULT_PARTS, SP: true, SA: true, SK: true } });
    p.completedStages = ['PP'];
    p.activeStages = ['SLD', 'TDP'];
    markReceived(p, 'doc-07');
    expect(getResultReadiness(p, 'SA').ready).toBe(true);   // po PP — pirmoji
    expect(getResultReadiness(p, 'SP').ready).toBe(false);  // laukia SA
    p.partStatuses = { SA: done };
    expect(getResultReadiness(p, 'SP').ready).toBe(true);
    expect(getResultReadiness(p, 'SK').ready).toBe(false);  // laukia SP ir 06
    markReceived(p, 'doc-06');
    p.partStatuses = { SA: done, SP: done };
    expect(getResultReadiness(p, 'SK').ready).toBe(true);
  });
  it('ŠVOK laukia pasirinktų SK/LVN/E; kitos dalys — ŠVOK; BD — visų', () => {
    const p = makeProject({
      selectedParts: { ...DEFAULT_PARTS, SA: true, SP: true, SK: true, E: true, SVOK: true, VN: true, BD: true },
    });
    p.completedStages = ['PP'];
    p.activeStages = ['TDP'];
    expect(getResultReadiness(p, 'SVOK').ready).toBe(false); // laukia SK ir E
    p.partStatuses = { SA: done, SP: done, SK: done, E: done };
    expect(getResultReadiness(p, 'SVOK').ready).toBe(true);
    expect(getResultReadiness(p, 'VN').ready).toBe(false);   // laukia ŠVOK
    expect(getResultReadiness(p, 'BD').ready).toBe(false);   // laukia ŠVOK ir VN
    p.partStatuses = { SA: done, SP: done, SK: done, E: done, SVOK: done, VN: done };
    expect(getResultReadiness(p, 'VN').ready).toBe(true);
    expect(getResultReadiness(p, 'BD').ready).toBe(true);    // komplektavimas galimas
  });
  it('dalies endDate (be completed) užskaito ją kaip baigtą — grafiko ✓ rašo endDate', () => {
    const p = makeProject({ selectedParts: { ...DEFAULT_PARTS, SP: true, SA: true } });
    p.completedStages = ['PP'];
    p.activeStages = ['TDP'];
    markReceived(p, 'doc-07');
    expect(getResultReadiness(p, 'SP').ready).toBe(false);
    p.partStatuses = { SA: { startDate: '', endDate: '2026-03-15', completed: false, notes: '' } };
    expect(getResultReadiness(p, 'SP').ready).toBe(true);
  });
  it('BD be kitų TDP dalių atsirakina po PP (fallback)', () => {
    const p = makeProject({ selectedParts: { ...DEFAULT_PARTS, BD: true } });
    expect(getResultReadiness(p, 'BD').ready).toBe(false);
    expect(getProjectResultIds(p)).toContain('BD');
    p.completedStages = ['PP'];
    p.activeStages = ['SLD', 'TDP'];
    expect(getResultReadiness(p, 'BD').ready).toBe(true);
  });
});

describe('getStageProcessInfo', () => {
  const status = (startDate = '', endDate = '') => ({ startDate, endDate, completed: false, notes: '' });
  it('PP: galima → dirbama → baigta', () => {
    const p = makeProject();
    expect(getStageProcessInfo(p, 'PP').state).toBe('galima'); // soft starto neblokuoja
    p.stageStatuses = { PP: status('2026-02-01') };
    expect(getStageProcessInfo(p, 'PP').state).toBe('dirbama');
    p.stageStatuses = { PP: status('2026-02-01', '2026-03-01') };
    expect(getStageProcessInfo(p, 'PP').state).toBe('baigta');
  });
  it('SLD: laukiama be PP+00+05+06; pridavus — priduota (ne dirbama)', () => {
    const p = makeProject();
    expect(getStageProcessInfo(p, 'SLD').state).toBe('laukiama');
    p.completedStages = ['PP'];
    markReceived(p, 'doc-00', 'doc-05', 'doc-06');
    expect(getStageProcessInfo(p, 'SLD').state).toBe('galima');
    p.stageStatuses = { SLD: status('2026-03-01') };
    expect(getStageProcessInfo(p, 'SLD').state).toBe('priduota');
  });
  it('PP faktinė pabaiga atrakina SLD net kai completedStages išvalytas', () => {
    const p = makeProject();
    markReceived(p, 'doc-00', 'doc-05', 'doc-06');
    p.stageStatuses = { PP: status('2026-02-01', '2026-03-01') };
    p.activeStages = [];
    p.completedStages = [];
    expect(getStageProcessInfo(p, 'SLD').state).toBe('galima');
  });
});

describe('isProjectFinished', () => {
  const status = (startDate = '', endDate = '') => ({ startDate, endDate, completed: false, notes: '' });
  it('tuščias activeStages vidury proceso ≠ baigtas projektas', () => {
    const p = makeProject(); // SR, PP, SLD, TDP, SP, SA, EKSPERTIZE
    p.stageStatuses = { SR: status('2026-01-01', '2026-02-01'), PP: status('2026-02-01', '2026-03-01') };
    p.activeStages = [];
    p.completedStages = []; // toggleStage konvencija baigus paskutinį aktyvų
    expect(isProjectFinished(p)).toBe(false); // SLD/TDP/Ekspertizė nė nepradėti
  });
  it('baigtas, kai visi pasirinkti etapai turi faktinę pabaigą', () => {
    const p = makeProject();
    p.activeStages = [];
    p.completedStages = [];
    p.stageStatuses = {
      SR: status('2026-01-01', '2026-02-01'),
      PP: status('2026-02-01', '2026-03-01'),
      SLD: status('2026-03-01', '2026-04-15'),
      TDP: status('2026-03-01', '2026-05-01'),
      EKSPERTIZE: status('2026-05-01', '2026-06-01'),
    };
    expect(isProjectFinished(p)).toBe(true);
  });
});
