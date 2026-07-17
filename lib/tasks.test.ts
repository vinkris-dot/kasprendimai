import { describe, it, expect } from 'vitest';
import { getAllTasks } from './tasks';
import { createDefaultProject, DEFAULT_PARTS } from './defaultData';
import { Project } from './types';

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

describe('getAllTasks', () => {
  it('aktyvus projektas turi užduočių (trūksta dokumentų → auto užduotys)', () => {
    expect(getAllTasks([makeProject()]).length).toBeGreaterThan(0);
  });

  it('pristabdytas projektas užduočių neturi — nei auto, nei rankinių', () => {
    const paused = makeProject({
      paused: true,
      manualTasks: [{ id: 'm1', label: 'Rankinė', createdAt: '2026-01-01' }],
    });
    expect(getAllTasks([paused])).toEqual([]);
  });

  it('archyvuotas projektas užduočių neturi', () => {
    expect(getAllTasks([makeProject({ archived: true })])).toEqual([]);
  });
});

describe('sekos užduotys iš duomenų (ne completedStages)', () => {
  it('PP faktinė pabaiga sukuria „Priduoti SLD" ir „Pradėti TDP" net kai completedStages išvalytas', () => {
    const p = makeProject();
    p.activeStages = [];
    p.completedStages = [];
    p.stageStatuses = { PP: { startDate: '2026-02-01', endDate: '2026-03-01', completed: false, notes: '' } };
    const tasks = getAllTasks([p]);
    const sld = tasks.find(t => t.taskKey === 'start-sld');
    expect(sld).toBeDefined();
    expect(sld!.checkable).toBe(false); // pridavimui trūksta 00/05/06
    expect(sld!.sub).toContain('laukia');
    expect(tasks.some(t => t.taskKey === 'start-tdp')).toBe(true);
  });
  it('„Priduoti SLD" žymima tik gavus 00+05+06', () => {
    const p = makeProject();
    p.completedStages = ['PP'];
    p.dokumentai = p.dokumentai.map(d =>
      ['doc-00', 'doc-05', 'doc-06'].includes(d.id) ? { ...d, received: true } : d);
    const sld = getAllTasks([p]).find(t => t.taskKey === 'start-sld');
    expect(sld?.checkable).toBe(true);
    expect(sld?.sub).toContain('✓');
  });
  it('SLD jau priduotas (aktyvus) → užduoties nebėra', () => {
    const p = makeProject();
    p.completedStages = ['PP'];
    p.activeStages = ['SLD'];
    expect(getAllTasks([p]).some(t => t.taskKey === 'start-sld')).toBe(false);
  });
  it('TDP baigtas → „Atiduoti projektą ekspertizei" (SLD soft)', () => {
    const p = makeProject();
    p.completedStages = ['PP', 'TDP'];
    p.activeStages = ['SLD'];
    const t = getAllTasks([p]).find(x => x.taskKey === 'start-ekspertize');
    expect(t).toBeDefined();
    expect(t!.sub).toContain('SLD dar derinamas');
  });
});

describe('05/06 užsakymui būtinas įgaliojimas (00)', () => {
  it('be 00 — order-05 ir order-06 nežymimi, rodo „laukia 00 įgaliojimo"', () => {
    const p = makeProject();
    const tasks = getAllTasks([p]);
    const t05 = tasks.find(t => t.taskKey === 'order-05');
    const t06 = tasks.find(t => t.taskKey === 'order-06');
    expect(t05?.checkable).toBe(false);
    expect(t05?.sub).toContain('laukia 00');
    expect(t06?.checkable).toBe(false);
    expect(t06?.sub).toContain('laukia 00');
  });
  it('gavus 00 — užsakymai atrakinami', () => {
    const p = makeProject();
    p.dokumentai = p.dokumentai.map(d => d.id === 'doc-00' ? { ...d, received: true } : d);
    const tasks = getAllTasks([p]);
    expect(tasks.find(t => t.taskKey === 'order-05')?.checkable).toBe(true);
    expect(tasks.find(t => t.taskKey === 'order-06')?.checkable).toBe(true);
  });
  it('00 netaikomas — užsakymai irgi atrakinami', () => {
    const p = makeProject();
    p.dokumentai = p.dokumentai.map(d => d.id === 'doc-00' ? { ...d, notApplicable: true } : d);
    const tasks = getAllTasks([p]);
    expect(tasks.find(t => t.taskKey === 'order-05')?.checkable).toBe(true);
  });
});
