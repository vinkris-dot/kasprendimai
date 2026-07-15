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
