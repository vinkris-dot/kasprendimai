'use client';

import { useState } from 'react';
import { Project, ResultInput, InputStatus, InputKind, DocumentItem } from '@/lib/types';
import { PROJECT_PARTS, STAGES } from '@/lib/defaultData';
import {
  getResultInputs, getInputStatus, getResultReadiness, getProjectResultIds,
  getUnlockPriorities, INPUT_KIND_META, DEFAULT_RESULT_INPUTS,
} from '@/lib/inputs';

const STATUS_META: Record<InputStatus, { icon: string; label: string; chip: string }> = {
  yra: { icon: '✓', label: 'yra', chip: 'bg-green-100 text-green-700 border-green-200' },
  uzsakyta: { icon: '⏳', label: 'užsakyta', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  nera: { icon: '✗', label: 'nėra', chip: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function resultLabel(resultId: string): string {
  const part = PROJECT_PARTS.find(p => p.id === resultId);
  if (part) return `${part.label} — ${part.description}`;
  const stage = STAGES.find(s => s.id === resultId);
  if (stage) return stage.name;
  return resultId;
}

interface Props {
  project: Project;
  updateProject: (id: string, changes: Partial<Project>) => void;
  onOpenTab: (tab: 'grafikas' | 'dokumentai') => void;
}

export default function InputsTab({ project, updateProject, onOpenTab }: Props) {
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newInput, setNewInput] = useState<{ label: string; kind: InputKind }>({ label: '', kind: 'skambutis' });

  const resultIds = getProjectResultIds(project);
  const priorities = getUnlockPriorities(project).filter(p => p.unlocks.length > 1).slice(0, 3);

  /** Įrašo rezultato sąrašą į project.inputs (materializuoja šabloną, jei reikia). */
  const saveInputs = (resultId: string, inputs: ResultInput[]) => {
    updateProject(project.id, { inputs: { ...(project.inputs ?? {}), [resultId]: inputs } });
  };

  const cycleStatus = (resultId: string, input: ResultInput) => {
    const current = getInputStatus(project, input);
    const next: InputStatus = current === 'nera' ? 'uzsakyta' : current === 'uzsakyta' ? 'yra' : 'nera';

    if (input.docId) {
      // Dokumentų būsena gyvena Dokumentai sąraše — keičiam ten (vienas šaltinis)
      const today = new Date().toISOString().slice(0, 10);
      const patch = (d: DocumentItem) => d.id !== input.docId ? d : {
        ...d,
        received: next === 'yra',
        orderedDate: next === 'uzsakyta' ? today : undefined,
      };
      updateProject(project.id, {
        dokumentai: project.dokumentai.map(patch),
        kitiDokumentai: (project.kitiDokumentai ?? []).map(patch),
      });
      return;
    }
    if (input.partId) {
      onOpenTab('grafikas'); // etapo baigtumas žymimas grafike
      return;
    }
    const inputs = getResultInputs(project, resultId).map(i => i.id === input.id ? { ...i, status: next } : i);
    saveInputs(resultId, inputs);
  };

  const addInput = (resultId: string) => {
    const label = newInput.label.trim();
    if (!label) return;
    const inputs = [...getResultInputs(project, resultId), {
      id: `in-${resultId}-${crypto.randomUUID().slice(0, 8)}`, label, kind: newInput.kind, status: 'nera' as InputStatus,
    }];
    saveInputs(resultId, inputs);
    setNewInput({ label: '', kind: 'skambutis' });
    setAddingFor(null);
  };

  const removeInput = (resultId: string, inputId: string) => {
    saveInputs(resultId, getResultInputs(project, resultId).filter(i => i.id !== inputId));
  };

  const resetToTemplate = (resultId: string) => {
    const rest = { ...(project.inputs ?? {}) };
    delete rest[resultId];
    updateProject(project.id, { inputs: rest });
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
        <strong>🔑 Ko man reikia, kad galėčiau padaryti X</strong><br />
        Kiekvienas rezultatas turi įėjimų sąrašą. Spauskite būseną (✗ → ⏳ → ✓); dokumentų būsena
        sinchronizuojasi su Dokumentai kortele, etapų — su grafiku.
      </div>

      {priorities.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Dienos prioritetas — atrakina daugiausiai</h3>
          <div className="space-y-1.5">
            {priorities.map(p => (
              <div key={p.input.id} className="flex items-center gap-2 text-sm text-amber-900">
                <span>{INPUT_KIND_META[p.input.kind].icon}</span>
                <span className="font-medium">{p.input.label}</span>
                <span className="text-xs text-amber-700">
                  atrakina {p.unlocks.length}: {p.unlocks.map(resultLabel).map(l => l.split(' — ')[0]).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultIds.map(resultId => {
        const readiness = getResultReadiness(project, resultId);
        const customized = !!project.inputs?.[resultId];
        const hasTemplate = !!DEFAULT_RESULT_INPUTS[resultId];
        return (
          <div key={resultId} className={`bg-white rounded-xl border p-4 ${readiness.ready ? 'border-green-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex-1">{resultLabel(resultId)}</h3>
              {readiness.ready ? (
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ galima pradėti</span>
              ) : (
                <span className="text-xs font-medium bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">
                  trūksta {readiness.missing}{readiness.waiting > 0 ? ` (${readiness.waiting} užsakyta)` : ''}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {readiness.inputs.map(({ input, status }) => {
                const meta = STATUS_META[status];
                const linked = !!input.docId || !!input.partId;
                return (
                  <div key={input.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => cycleStatus(resultId, input)}
                      title={input.partId ? 'Žymima grafike — atidaryti' : 'Keisti būseną'}
                      className={`text-xs border rounded-full px-2 py-0.5 w-24 text-center transition-colors hover:opacity-80 ${meta.chip}`}
                    >
                      {meta.icon} {meta.label}
                    </button>
                    <span className="text-sm flex-shrink-0" title={INPUT_KIND_META[input.kind].label}>
                      {INPUT_KIND_META[input.kind].icon}
                    </span>
                    <span className={`text-sm flex-1 ${status === 'yra' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {input.label}
                    </span>
                    {input.docId && (
                      <button onClick={() => onOpenTab('dokumentai')} className="text-xs text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100">
                        → dokumentai
                      </button>
                    )}
                    {!linked && (
                      <button
                        onClick={() => removeInput(resultId, input.id)}
                        className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100"
                        title="Pašalinti"
                      >×</button>
                    )}
                  </div>
                );
              })}
              {readiness.total === 0 && (
                <p className="text-xs text-slate-400">Įėjimų nėra — pridėkite, ko reikia šiam rezultatui.</p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              {addingFor === resultId ? (
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <input
                    autoFocus
                    value={newInput.label}
                    onChange={e => setNewInput(v => ({ ...v, label: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addInput(resultId); if (e.key === 'Escape') setAddingFor(null); }}
                    placeholder="Ko reikia? pvz. skambutis geodezininkui"
                    className="flex-1 min-w-[200px] text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <select
                    value={newInput.kind}
                    onChange={e => setNewInput(v => ({ ...v, kind: e.target.value as InputKind }))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  >
                    {(Object.keys(INPUT_KIND_META) as InputKind[]).map(k => (
                      <option key={k} value={k}>{INPUT_KIND_META[k].icon} {INPUT_KIND_META[k].label}</option>
                    ))}
                  </select>
                  <button onClick={() => addInput(resultId)} className="text-xs bg-slate-900 text-white px-2.5 py-1.5 rounded">Pridėti</button>
                  <button onClick={() => setAddingFor(null)} className="text-xs text-slate-500">Atšaukti</button>
                </div>
              ) : (
                <button onClick={() => { setAddingFor(resultId); setNewInput({ label: '', kind: 'skambutis' }); }} className="text-xs text-slate-400 hover:text-slate-600">
                  + Pridėti įėjimą
                </button>
              )}
              {customized && hasTemplate && addingFor !== resultId && (
                <button onClick={() => resetToTemplate(resultId)} className="text-xs text-slate-300 hover:text-slate-500" title="Grąžinti numatytą sąrašą">
                  ↺ šablonas
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
