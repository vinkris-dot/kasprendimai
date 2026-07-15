import { describe, it, expect } from 'vitest';
import { getResultInputs, getInputStatus, getResultReadiness, getProjectResultIds, getUnlockPriorities, DEFAULT_RESULT_INPUTS } from './inputs';
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
  it('rodo pasirinktas dalis, slepia baigtas', () => {
    const p = makeProject();
    expect(getProjectResultIds(p)).toEqual(['SR', 'PP', 'SLD', 'TDP', 'SP', 'SA', 'EKSPERTIZE']);
    p.completedStages = ['PP'];
    expect(getProjectResultIds(p)).not.toContain('PP');
  });
});

describe('getUnlockPriorities', () => {
  it('PP baigimas atrakina daugiausiai (SLD, SP, SA)', () => {
    const p = makeProject();
    markReceived(p, 'doc-00', 'doc-01', 'doc-02', 'doc-03', 'doc-04', 'doc-05', 'doc-06', 'doc-07');
    const top = getUnlockPriorities(p)[0];
    expect(top.input.partId).toBe('PP');
    expect(top.unlocks).toEqual(expect.arrayContaining(['SLD', 'SP', 'SA']));
  });
  it('vienodi dokumentų įėjimai sujungiami', () => {
    const p = makeProject();
    const topo = getUnlockPriorities(p).find(u => u.input.docId === 'doc-07');
    expect(topo?.unlocks).toEqual(expect.arrayContaining(['PP', 'SP']));
  });
});
