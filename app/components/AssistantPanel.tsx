'use client';

import { useState } from 'react';
import { Project, StageId, TeamMemberId, ManualTask } from '@/lib/types';
import { STAGES, TEAM_MEMBERS, projectLabel } from '@/lib/defaultData';

// AI asistentas: laisva komanda → pasiūlyti veiksmai → Kristina patvirtina → taikoma.

interface ProposedAction {
  tool: string;
  input: Record<string, string>;
}

interface Props {
  projects: Project[];
  updateProject: (id: string, changes: Partial<Project>) => void;
  toggleStage: (projectId: string, stage: StageId) => void;
  finishProject: (projectId: string) => void;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function AssistantPanel({ projects, updateProject, toggleStage, finishProject }: Props) {
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [proposals, setProposals] = useState<ProposedAction[]>([]);
  const [applied, setApplied] = useState<string[]>([]);

  const byId = (id: string) => projects.find(p => p.id === id);

  function describe(a: ProposedAction): string {
    const p = byId(a.input.project_id);
    const name = p ? projectLabel(p) : a.input.project_id;
    switch (a.tool) {
      case 'finish_project': return `${name} — pažymėti BAIGTU (visi aktyvūs etapai užbaigiami šiandien)`;
      case 'set_stage': {
        const stage = STAGES.find(s => s.id === a.input.stage)?.shortName ?? a.input.stage;
        return `${name} — etapas ${stage}: ${a.input.action === 'activate' ? 'pradėti (nuo šiandien)' : 'užbaigti'}`;
      }
      case 'pause_project': return `${name} — pristabdyti („${a.input.reason}")`;
      case 'resume_project': return `${name} — atnaujinti (nuimti pauzę)`;
      case 'add_task': {
        const who = TEAM_MEMBERS.find(m => m.id === a.input.assignee)?.name ?? a.input.assignee;
        return `${name} — užduotis: „${a.input.label}" (${who}${a.input.due_date ? `, iki ${a.input.due_date}` : ''})`;
      }
      case 'add_note': return `${name} — pastaba: „${a.input.text}"`;
      case 'set_document': return `${name} — dokumentas ${a.input.doc_number}: ${a.input.status === 'gauta' ? 'gautas ✓' : 'užsakytas ⏳'}`;
      case 'archive_project': return `${name} — ARCHYVUOTI`;
      default: return `${name} — ${a.tool}`;
    }
  }

  function apply(a: ProposedAction) {
    const p = byId(a.input.project_id);
    if (!p) return;
    switch (a.tool) {
      case 'finish_project':
        finishProject(p.id);
        break;
      case 'set_stage': {
        const stage = a.input.stage as StageId;
        const active = (p.activeStages ?? []).includes(stage);
        const completed = (p.completedStages ?? []).includes(stage);
        if (a.input.action === 'activate' && !active) {
          if (completed) toggleStage(p.id, stage); // completed → inactive
          toggleStage(p.id, stage); // inactive → active (faktinė pradžia šiandien)
        } else if (a.input.action === 'complete' && active) {
          toggleStage(p.id, stage); // active → completed (pabaiga šiandien)
        }
        break;
      }
      case 'pause_project':
        updateProject(p.id, { paused: true, pauseReason: a.input.reason || 'Pristabdyta' });
        break;
      case 'resume_project':
        updateProject(p.id, { paused: false, pauseReason: undefined, pauseUntil: undefined });
        break;
      case 'add_task': {
        const task: ManualTask = {
          id: crypto.randomUUID(),
          label: a.input.label,
          assignee: (a.input.assignee || undefined) as TeamMemberId | undefined,
          dueDate: a.input.due_date || undefined,
          createdAt: new Date().toISOString(),
        };
        updateProject(p.id, { manualTasks: [...(p.manualTasks ?? []), task] });
        break;
      }
      case 'add_note':
        updateProject(p.id, { notes: `${TODAY()}: ${a.input.text}` + (p.notes ? '\n' + p.notes : '') });
        break;
      case 'set_document':
        updateProject(p.id, {
          dokumentai: p.dokumentai.map(d => d.number !== a.input.doc_number ? d : {
            ...d,
            received: a.input.status === 'gauta',
            orderedDate: a.input.status === 'uzsakyta' ? TODAY() : undefined,
          }),
        });
        break;
      case 'archive_project':
        updateProject(p.id, { archived: true });
        break;
    }
  }

  async function send() {
    if (!command.trim() || busy) return;
    setBusy(true); setError(''); setAssistantText(''); setProposals([]); setApplied([]);
    try {
      const snapshot = projects
        .filter(p => !p.archived)
        .map(p => ({
          id: p.id,
          label: projectLabel(p),
          number: p.projectNumber,
          client: p.client,
          activeStages: p.activeStages ?? [],
          paused: !!p.paused,
          missingDocs: p.dokumentai.filter(d => !d.received).length,
        }));
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, projects: snapshot }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Klaida.'); return; }
      setProposals(data.actions ?? []);
      setAssistantText(data.text ?? '');
      if ((data.actions ?? []).length === 0 && !data.text) setAssistantText('Veiksmų nesiūlau — patikslinkite komandą.');
    } catch {
      setError('Nepavyko susisiekti su serveriu.');
    } finally {
      setBusy(false);
    }
  }

  function confirmAll() {
    const done: string[] = [];
    for (const a of proposals) { apply(a); done.push(describe(a)); }
    setApplied(done);
    setProposals([]);
    setCommand('');
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
      >
        <span className={`transition-transform inline-block ${open ? 'rotate-90' : ''}`}>›</span>
        🤖 AI asistentas
      </button>

      {open && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex gap-2">
            <textarea
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="pvz.: Akmens baigta, Kopų gauta pastabų, Tujų 4 priduota SLD, Islandijos reikia užsakyti sąlygas..."
              rows={2}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
            <button
              onClick={send}
              disabled={busy || !command.trim()}
              className="self-end bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              {busy ? 'Galvoju…' : 'Siųsti'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {assistantText && <p className="text-sm text-slate-600 whitespace-pre-wrap">{assistantText}</p>}

          {proposals.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Siūlomi veiksmai — patvirtinkite</p>
              {proposals.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-800">
                  <button
                    onClick={() => setProposals(list => list.filter((_, j) => j !== i))}
                    className="text-slate-300 hover:text-red-400 shrink-0 mt-0.5"
                    title="Pašalinti šį veiksmą"
                  >×</button>
                  <span>{describe(a)}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={confirmAll} className="bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors">
                  ✓ Patvirtinti ({proposals.length})
                </button>
                <button onClick={() => setProposals([])} className="text-xs text-slate-500 hover:text-slate-700 px-2">Atšaukti</button>
              </div>
            </div>
          )}

          {applied.length > 0 && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Pritaikyta ✓</p>
              {applied.map((d, i) => <p key={i} className="text-sm text-emerald-900">{d}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
