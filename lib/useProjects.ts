'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, StageId, SelectedParts, MotyvuotasAtsakymas, ProjektavimoUzduotis } from './types';
import { createDefaultProject, calcTargetDate, DEFAULT_DOKUMENTAI, DEFAULT_PP_BYLA, DEFAULT_STAGE_ASSIGNEES } from './defaultData';
import { supabase } from './supabase';

const STORAGE_KEY = 'openclaw_projects';

async function upsertToSupabase(project: Project) {
  await supabase.from('projects').upsert({ id: project.id, data: project, updated_at: new Date().toISOString() });
}

async function deleteFromSupabase(id: string) {
  await supabase.from('projects').delete().eq('id', id);
}

async function fetchFromSupabase(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('data').order('updated_at', { ascending: true });
  if (error || !data) return [];
  return data.map((row: { data: Project }) => row.data);
}

function migrateProject(p: Project): Project {
  const existingIds = new Set(p.dokumentai.map(d => d.id));
  const newDocs = DEFAULT_DOKUMENTAI
    .filter(d => !existingIds.has(d.id))
    .map(d => ({ ...d, received: false, notes: '' }));
  return {
    ...p,
    clientEmail: p.clientEmail ?? '',
    activeStages: p.activeStages ?? [(p as any).currentStage ?? 'SR'],
    motyvuotiAtsakymai: p.motyvuotiAtsakymai ?? [],
    dokumentai: (() => {
      const merged = [
        ...p.dokumentai.filter(d => d.id !== 'doc-17' && !['doc-06a','doc-06b','doc-06c','doc-06d','doc-06e','doc-06f'].includes(d.id)).map(d => {
          const def = DEFAULT_DOKUMENTAI.find(dd => dd.id === d.id);
          return def?.subfolder && !d.subfolder ? { ...d, subfolder: def.subfolder } : d;
        }),
        ...newDocs,
      ];
      const order = DEFAULT_DOKUMENTAI.map(d => d.id);
      return merged.sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    })(),
    ppByla: (p.ppByla ?? []).map(item => {
      const def = DEFAULT_PP_BYLA.find(pp => pp.id === item.id);
      return def?.subfolder && !item.subfolder ? { ...item, subfolder: def.subfolder } : item;
    }),
    selectedParts: Object.assign(
      { IP: false, PAKARTOTINIS: false, EKSPERTIZE: (p.selectedParts as any)?.TDP ?? false },
      p.selectedParts
    ) as SelectedParts,
    partStatuses: p.partStatuses ?? {},
    completedStages: p.completedStages ?? [],
    stageAssignees: p.stageAssignees ?? { ...DEFAULT_STAGE_ASSIGNEES },
    taskStatuses: p.taskStatuses ?? {},
  };
}

function loadFromLocalStorage(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const projects: Project[] = JSON.parse(raw);
    return projects.map(migrateProject);
  } catch {
    return [];
  }
}

function saveToLocalStorage(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // 1. Load localStorage immediately for fast first render
    const local = loadFromLocalStorage();
    if (local.length > 0) {
      setProjects(local);
    }

    // 2. Fetch from Supabase and merge (Supabase is source of truth)
    fetchFromSupabase().then(remote => {
      if (remote.length > 0) {
        // Migrate remote projects and use them as source of truth
        const migrated = remote.map(migrateProject);
        setProjects(migrated);
        saveToLocalStorage(migrated);
      } else if (local.length > 0) {
        // No remote data yet — push local data to Supabase (first-time migration)
        local.forEach(p => upsertToSupabase(p));
      }
      setLoaded(true);
    }).catch(() => {
      // Supabase unavailable — fall back to localStorage
      setLoaded(true);
    });

    // 3. Subscribe to realtime changes
    const channel = supabase
      .channel('projects-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id as string;
          setProjects(prev => {
            const updated = prev.filter(p => p.id !== deletedId);
            saveToLocalStorage(updated);
            return updated;
          });
        } else {
          const incoming = (payload.new as { data: Project }).data;
          if (!incoming) return;
          const migrated = migrateProject(incoming);
          setProjects(prev => {
            const exists = prev.find(p => p.id === migrated.id);
            let updated: Project[];
            if (exists) {
              // Only update if remote is newer
              if (migrated.updatedAt > exists.updatedAt) {
                updated = prev.map(p => p.id === migrated.id ? migrated : p);
              } else {
                return prev;
              }
            } else {
              updated = [...prev, migrated];
            }
            saveToLocalStorage(updated);
            return updated;
          });
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const saveProjects = useCallback((projects: Project[]) => {
    saveToLocalStorage(projects);
    // Fire-and-forget upsert to Supabase
    projects.forEach(p => upsertToSupabase(p).catch(() => {}));
  }, []);

  const addProject = useCallback((data: {
    name: string;
    address: string;
    client: string;
    clientEmail: string;
    startDate: string;
    selectedParts: SelectedParts;
    pu?: ProjektavimoUzduotis;
    projectNumber?: string;
  }): Project => {
    const now = new Date().toISOString();
    const targetConstructionDate = calcTargetDate(data.startDate, data.selectedParts);
    const project: Project = {
      id: crypto.randomUUID(),
      ...data,
      targetConstructionDate,
      ...createDefaultProject(),
      selectedParts: data.selectedParts,
      completedStages: [],
      taskStatuses: {},
      manualTasks: [],
      createdAt: now,
      updatedAt: now,
    };
    setProjects(prev => {
      const updated = [...prev, project];
      saveToLocalStorage(updated);
      upsertToSupabase(project).catch(() => {});
      return updated;
    });
    return project;
  }, []);

  const updateProject = useCallback((id: string, changes: Partial<Project>) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== id) return p;
        const updatedProject = { ...p, ...changes, updatedAt: new Date().toISOString() };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToLocalStorage(updated);
      deleteFromSupabase(id).catch(() => {});
      return updated;
    });
  }, []);

  const copyProject = useCallback((source: Project): Project => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const targetConstructionDate = calcTargetDate(today, source.selectedParts);
    const { ppByla, dokumentai } = createDefaultProject();
    const copy: Project = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (kopija)`,
      startDate: today,
      targetConstructionDate,
      ppByla,
      dokumentai,
      stageStatuses: {},
      partStatuses: {},
      taskStatuses: {},
      manualTasks: [],
      motyvuotiAtsakymai: [],
      activeStages: ['SR'],
      completedStages: [],
      notes: source.notes,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    setProjects(prev => {
      const updated = [...prev, copy];
      saveToLocalStorage(updated);
      upsertToSupabase(copy).catch(() => {});
      return updated;
    });
    return copy;
  }, []);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          ppByla: p.ppByla.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const toggleDocument = useCallback((projectId: string, docId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, received: !doc.received } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const updateDocumentNotes = useCallback((projectId: string, docId: string, notes: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, notes } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const updateConnectionDate = useCallback((projectId: string, docId: string, key: string, date: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, connectionDates: { ...(doc.connectionDates ?? {}), [key]: date } } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const toggleStage = useCallback((projectId: string, stage: StageId) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const current = p.activeStages ?? ['SR'];
        const completed = p.completedStages ?? [];
        const today = new Date().toISOString().slice(0, 10);
        const stageStatuses = p.stageStatuses ?? {};
        let updatedProject: Project;
        if (current.includes(stage)) {
          // Removing from active → mark completed + set endDate if not set
          const next = current.filter(s => s !== stage);
          updatedProject = {
            ...p,
            activeStages: next,
            completedStages: next.length > 0 ? [...new Set([...completed, stage])] : [],
            stageStatuses: {
              ...stageStatuses,
              [stage]: { ...(stageStatuses[stage] ?? {}), endDate: stageStatuses[stage]?.endDate || today },
            },
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Adding back to active → clear endDate
          updatedProject = {
            ...p,
            activeStages: [...current, stage],
            completedStages: completed.filter(s => s !== stage),
            stageStatuses: {
              ...stageStatuses,
              [stage]: { ...(stageStatuses[stage] ?? {}), endDate: '' },
            },
            updatedAt: new Date().toISOString(),
          };
        }
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
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
        const updatedProject = {
          ...p,
          stageStatuses: {
            ...p.stageStatuses,
            [stageId]: { ...p.stageStatuses[stageId], ...status },
          },
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const updateMotyvuotiAtsakymai = useCallback((projectId: string, items: MotyvuotasAtsakymas[]) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = { ...p, motyvuotiAtsakymai: items, updatedAt: new Date().toISOString() };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const addDocumentFile = useCallback((projectId: string, docId: string, file: import('./types').UploadedFile) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, files: [...(doc.files ?? []), file] } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const addChecklistFile = useCallback((projectId: string, itemId: string, file: import('./types').UploadedFile) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          ppByla: p.ppByla.map(item =>
            item.id === itemId ? { ...item, files: [...(item.files ?? []), file] } : item
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const removeDocumentFile = useCallback((projectId: string, docId: string, filePath: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          dokumentai: p.dokumentai.map(doc =>
            doc.id === docId ? { ...doc, files: (doc.files ?? []).filter(f => f.path !== filePath) } : doc
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  const removeChecklistFile = useCallback((projectId: string, itemId: string, filePath: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;
        const updatedProject = {
          ...p,
          ppByla: p.ppByla.map(item =>
            item.id === itemId ? { ...item, files: (item.files ?? []).filter(f => f.path !== filePath) } : item
          ),
          updatedAt: new Date().toISOString(),
        };
        upsertToSupabase(updatedProject).catch(() => {});
        return updatedProject;
      });
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  return {
    projects,
    loaded,
    addProject,
    updateProject,
    deleteProject,
    copyProject,
    toggleChecklistItem,
    toggleDocument,
    updateDocumentNotes,
    toggleStage,
    updateStageStatus,
    updateMotyvuotiAtsakymai,
    updateConnectionDate,
    addDocumentFile,
    addChecklistFile,
    removeDocumentFile,
    removeChecklistFile,
  };
}
