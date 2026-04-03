'use client';

import { useState, useEffect, useCallback } from 'react';
import { Project, StageId, SelectedParts, MotyvuotasAtsakymas } from './types';
import { createDefaultProject, calcTargetDate, DEFAULT_DOKUMENTAI, DEFAULT_STAGE_ASSIGNEES } from './defaultData';

const STORAGE_KEY = 'openclaw_projects';

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const projects: Project[] = JSON.parse(raw);
    // Migrate: ensure IP field exists in selectedParts
    const migrated = projects.map(p => {
      // Add any new default documents not yet in project
      const existingIds = new Set(p.dokumentai.map(d => d.id));
      const newDocs = DEFAULT_DOKUMENTAI
        .filter(d => !existingIds.has(d.id))
        .map(d => ({ ...d, received: false, notes: '' }));
      return {
        ...p,
        clientEmail: p.clientEmail ?? '',
        activeStages: p.activeStages ?? [(p as any).currentStage ?? 'SR'],
        motyvuotiAtsakymai: p.motyvuotiAtsakymai ?? [],
        dokumentai: [...p.dokumentai.filter(d => d.id !== 'doc-17'), ...newDocs],
        selectedParts: { IP: false, PAKARTOTINIS: false, EKSPERTIZE: p.selectedParts?.TDP ?? false, ...p.selectedParts },
        partStatuses: p.partStatuses ?? {},
        completedStages: p.completedStages ?? [],
        stageAssignees: p.stageAssignees ?? { ...DEFAULT_STAGE_ASSIGNEES },
      };
    });
    // Persist migration immediately
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProjects(loadProjects());
    setLoaded(true);
  }, []);

  const addProject = useCallback((data: {
    name: string;
    address: string;
    client: string;
    clientEmail: string;
    startDate: string;
    selectedParts: SelectedParts;
  }): Project => {
    const now = new Date().toISOString();
    const targetConstructionDate = calcTargetDate(data.startDate, data.selectedParts);
    const project: Project = {
      id: crypto.randomUUID(),
      ...data,
      targetConstructionDate,
      ...createDefaultProject(),
      selectedParts: data.selectedParts,
      createdAt: now,
      updatedAt: now,
    };
    setProjects(prev => {
      const updated = [...prev, project];
      saveProjects(updated);
      return updated;
    });
    return project;
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Project>) => {
    setProjects(prev => {
      const updated = prev.map(p =>
        p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p
      );
      saveProjects(updated);
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveProjects(updated);
      return updated;
    });
  }, []);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          ppByla: p.ppByla.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      saveProjects(updated);
      return updated;
    });
  }, []);

  const toggleDocument = useCallback((projectId: string, docId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, received: !doc.received } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      saveProjects(updated);
      return updated;
    });
  }, []);

  const updateDocumentNotes = useCallback((projectId: string, docId: string, notes: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, notes } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      saveProjects(updated);
      return updated;
    });
  }, []);

  const toggleStage = useCallback((projectId: string, stage: StageId) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const current = p.activeStages ?? ['SR'];
        const completed = p.completedStages ?? [];
        if (current.includes(stage)) {
          // Removing from active — mark as completed
          const next = current.filter(s => s !== stage);
          return {
            ...p,
            activeStages: next,
            completedStages: next.length > 0 ? [...new Set([...completed, stage])] : [],
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Re-activating — remove from completed
          return {
            ...p,
            activeStages: [...current, stage],
            completedStages: completed.filter(s => s !== stage),
            updatedAt: new Date().toISOString(),
          };
        }
      });
      saveProjects(updated);
      return updated;
    });
  }, []);

  const updateStageStatus = useCallback((
    projectId: string,
    stageId: StageId,
    status: Partial<import('./types').StageStatus>
  ) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          stageStatuses: {
            ...p.stageStatuses,
            [stageId]: { ...p.stageStatuses[stageId], ...status },
          },
          updatedAt: new Date().toISOString(),
        };
      });
      saveProjects(updated);
      return updated;
    });
  }, []);

  const updateMotyvuotiAtsakymai = useCallback((projectId: string, items: MotyvuotasAtsakymas[]) => {
    setProjects(prev => {
      const updated = prev.map(p =>
        p.id === projectId ? { ...p, motyvuotiAtsakymai: items, updatedAt: new Date().toISOString() } : p
      );
      saveProjects(updated);
      return updated;
    });
  }, []);

  return {
    projects,
    loaded,
    addProject,
    updateProject,
    deleteProject,
    toggleChecklistItem,
    toggleDocument,
    updateDocumentNotes,
    toggleStage,
    updateStageStatus,
    updateMotyvuotiAtsakymai,
  };
}
