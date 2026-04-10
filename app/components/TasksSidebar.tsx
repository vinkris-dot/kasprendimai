'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Project, ManualTask, TeamMemberId } from '@/lib/types';
import { TEAM_MEMBERS } from '@/lib/defaultData';
import { getAllTasks, groupByUrgency, TaskItem } from '@/lib/tasks';

// ── Personal notes (localStorage) ──────────────────────────────
interface Note {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem('ka_notes') ?? '[]')); } catch {}
  }, []);
  function save(updated: Note[]) {
    setNotes(updated);
    localStorage.setItem('ka_notes', JSON.stringify(updated));
  }
  function addNote(text: string) {
    if (!text.trim()) return;
    save([{ id: crypto.randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() }, ...notes]);
  }
  function toggleNote(id: string) {
    save(notes.map(n => n.id === id ? { ...n, done: !n.done } : n));
  }
  function deleteNote(id: string) {
    save(notes.filter(n => n.id !== id));
  }
  return { notes, addNote, toggleNote, deleteNote };
}

// ── Project task helpers ────────────────────────────────────────
function AssigneeBadge({ id }: { id?: TeamMemberId }) {
  if (!id) return null;
  const m = TEAM_MEMBERS.find(m => m.id === id);
  if (!m) return null;
  return (
    <span className={`shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${m.color} ${m.textColor}`}>
      {m.initials}
    </span>
  );
}

function TaskRow({ task, onDone, onDelete, onSetDueDate }: {
  task: TaskItem; onDone: () => void; onDelete?: () => void; onSetDueDate: (date: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0 group">
      <button onClick={onDone} disabled={!task.checkable}
        className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 transition-colors ${
          task.checkable ? 'border-slate-300 hover:border-emerald-500 cursor-pointer' : 'border-slate-200 cursor-not-allowed opacity-40'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <AssigneeBadge id={task.assignee} />
          <Link href={`/projects/${task.projectId}`} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 truncate max-w-[120px]">
            {task.projectName}
          </Link>
        </div>
        <p className={`text-xs mt-0.5 leading-snug ${task.checkable ? 'text-slate-700' : 'text-slate-400'}`}>
          {task.label}{task.sub && <span className="text-slate-400"> — {task.sub}</span>}
        </p>
        <div className="relative mt-1 inline-flex" onClick={e => { (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.(); }}>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer ${
            task.dueDate
              ? task.dueDate < new Date().toISOString().slice(0, 10) ? 'border-red-200 bg-red-50 text-red-500' : 'border-slate-200 bg-white text-slate-400'
              : 'border-dashed border-slate-200 text-slate-300'
          }`}>
            {task.dueDate ? `iki ${task.dueDate}` : 'iki...'}
          </span>
          <input type="date" value={task.dueDate ?? ''} onChange={e => onSetDueDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
        </div>
      </div>
      {task.isManual && onDelete && (
        <button onClick={onDelete} className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-sm leading-none mt-0.5">×</button>
      )}
    </div>
  );
}

function TaskGroup({ label, color, tasks, onDone, onDelete, onSetDueDate }: {
  label: string; color: string; tasks: TaskItem[];
  onDone: (t: TaskItem) => void; onDelete: (t: TaskItem) => void; onSetDueDate: (t: TaskItem, date: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-4">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-semibold bg-current/10 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      {tasks.map(t => (
        <TaskRow key={t.key} task={t} onDone={() => onDone(t)} onDelete={() => onDelete(t)} onSetDueDate={date => onSetDueDate(t, date)} />
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────
export default function TasksSidebar({ projects, open, onToggle, updateProject }: {
  projects: Project[]; open: boolean; onToggle: () => void; updateProject: (id: string, data: Partial<Project>) => void;
}) {
  const [tab, setTab] = useState<'tasks' | 'notes'>('tasks');
  const [addingFor, setAddingFor] = useState<string>('');
  const [newLabel, setNewLabel] = useState('');
  const [newAssignee, setNewAssignee] = useState<TeamMemberId | ''>('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const noteInputRef = useRef<HTMLInputElement>(null);

  const { notes, addNote, toggleNote, deleteNote } = useNotes();

  const allTasks = getAllTasks(projects);
  const groups = groupByUrgency(allTasks);
  const totalPending = allTasks.length;
  const pendingNotes = notes.filter(n => !n.done).length;

  function markDone(t: TaskItem) {
    const project = projects.find(p => p.id === t.projectId);
    if (!project) return;
    updateProject(t.projectId, { taskStatuses: { ...(project.taskStatuses ?? {}), [t.taskKey]: { ...(project.taskStatuses?.[t.taskKey] ?? {}), doneAt: new Date().toISOString().slice(0, 10) } } });
  }

  function deleteTask(t: TaskItem) {
    if (!t.isManual) return;
    const project = projects.find(p => p.id === t.projectId);
    if (!project) return;
    const newManual = (project.manualTasks ?? []).filter(m => m.id !== t.taskKey);
    const newStatuses = Object.fromEntries(Object.entries(project.taskStatuses ?? {}).filter(([k]) => k !== t.taskKey));
    updateProject(t.projectId, { manualTasks: newManual, taskStatuses: newStatuses });
  }

  function setDueDate(t: TaskItem, date: string) {
    const project = projects.find(p => p.id === t.projectId);
    if (!project) return;
    updateProject(t.projectId, { taskStatuses: { ...(project.taskStatuses ?? {}), [t.taskKey]: { ...(project.taskStatuses?.[t.taskKey] ?? {}), dueDate: date } } });
  }

  function addManualTask() {
    if (!addingFor || !newLabel.trim()) return;
    const project = projects.find(p => p.id === addingFor);
    if (!project) return;
    const task: ManualTask = { id: crypto.randomUUID(), label: newLabel.trim(), assignee: newAssignee || undefined, dueDate: newDueDate || undefined, createdAt: new Date().toISOString() };
    updateProject(addingFor, { manualTasks: [...(project.manualTasks ?? []), task], ...(newDueDate ? { taskStatuses: { ...(project.taskStatuses ?? {}), [task.id]: { dueDate: newDueDate } } } : {}) });
    setNewLabel(''); setNewAssignee(''); setNewDueDate(''); setAddingFor('');
  }

  const activeProjects = projects.filter(p => !p.archived && (p.activeStages ?? []).length > 0);

  return (
    <>
      {/* Toggle button */}
      <button onClick={onToggle} className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 py-4 px-2 rounded-l-xl shadow-md transition-all ${open ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {(totalPending + pendingNotes) > 0 && (
          <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${groups.overdue.length > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
            {(totalPending + pendingNotes) > 99 ? '99+' : totalPending + pendingNotes}
          </span>
        )}
        <span className="text-[9px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">Užduotys</span>
      </button>

      {/* Sidebar panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-slate-200 shadow-xl z-30 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-0 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900 text-sm">
              {tab === 'tasks' ? `Užduotys · ${totalPending}` : `Užrašai · ${notes.filter(n => !n.done).length}`}
            </h2>
            <button onClick={onToggle} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-0">
            <button onClick={() => setTab('tasks')} className={`flex-1 text-xs font-medium py-2 border-b-2 transition-colors ${tab === 'tasks' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              Projektų užduotys
            </button>
            <button onClick={() => { setTab('notes'); setTimeout(() => noteInputRef.current?.focus(), 100); }} className={`flex-1 text-xs font-medium py-2 border-b-2 transition-colors ${tab === 'notes' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              Užrašai
              {pendingNotes > 0 && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{pendingNotes}</span>}
            </button>
          </div>
        </div>

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {totalPending === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm text-slate-500 font-medium">Viskas atlikta!</p>
                  <p className="text-xs text-slate-400 mt-1">Nėra laukiančių užduočių</p>
                </div>
              ) : (
                <>
                  <TaskGroup label="🔴 Vėluoja" color="text-red-500" tasks={groups.overdue} onDone={markDone} onDelete={deleteTask} onSetDueDate={setDueDate} />
                  <TaskGroup label="🟡 Šiandien" color="text-amber-500" tasks={groups.today} onDone={markDone} onDelete={deleteTask} onSetDueDate={setDueDate} />
                  <TaskGroup label="🟢 Ši savaitė" color="text-emerald-600" tasks={groups.thisWeek} onDone={markDone} onDelete={deleteTask} onSetDueDate={setDueDate} />
                  <TaskGroup label="📅 Vėliau / be termino" color="text-slate-400" tasks={groups.later} onDone={markDone} onDelete={deleteTask} onSetDueDate={setDueDate} />
                </>
              )}
            </div>
            <div className="border-t border-slate-100 p-4">
              {addingFor ? (
                <div className="space-y-2">
                  <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addManualTask(); if (e.key === 'Escape') setAddingFor(''); }}
                    placeholder="Užduoties aprašymas..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400" />
                  <div className="flex gap-2">
                    <select value={newAssignee} onChange={e => setNewAssignee(e.target.value as TeamMemberId | '')} className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-400">
                      <option value="">Atlikėjas...</option>
                      {TEAM_MEMBERS.filter(m => m.id !== 'EXT').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-400" />
                  </div>
                  <select value={addingFor} onChange={e => setAddingFor(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-400">
                    <option value="">Projektas...</option>
                    {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={addManualTask} disabled={!newLabel.trim() || !addingFor} className="flex-1 bg-slate-900 text-white text-xs font-medium py-2 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors">Pridėti</button>
                    <button onClick={() => { setAddingFor(''); setNewLabel(''); setNewAssignee(''); setNewDueDate(''); }} className="px-3 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">Atšaukti</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingFor(activeProjects[0]?.id ?? '')} className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800 border border-dashed border-slate-200 rounded-lg py-2.5 hover:border-slate-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Pridėti užduotį
                </button>
              )}
            </div>
          </>
        )}

        {/* ── NOTES TAB ── */}
        {tab === 'notes' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {/* New note input */}
              <div className="flex gap-2 mb-4">
                <input
                  ref={noteInputRef}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { addNote(newNote); setNewNote(''); } }}
                  placeholder="Nauja mintis ar darbas..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
                />
                <button onClick={() => { addNote(newNote); setNewNote(''); }} disabled={!newNote.trim()} className="bg-slate-900 text-white text-xs px-3 rounded-lg hover:bg-slate-700 disabled:opacity-30 transition-colors">
                  +
                </button>
              </div>

              {notes.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">Nėra užrašų. Rašykite viršuje ↑</div>
              ) : (
                <div className="space-y-1">
                  {/* Pending notes */}
                  {notes.filter(n => !n.done).map(note => (
                    <div key={note.id} className="flex items-start gap-2 py-2 border-b border-slate-100 group">
                      <button onClick={() => toggleNote(note.id)} className="mt-0.5 shrink-0 w-4 h-4 rounded border-2 border-slate-300 hover:border-emerald-500 transition-colors cursor-pointer" />
                      <span className="flex-1 text-sm text-slate-700 leading-snug">{note.text}</span>
                      <button onClick={() => deleteNote(note.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-sm leading-none mt-0.5">×</button>
                    </div>
                  ))}
                  {/* Done notes */}
                  {notes.filter(n => n.done).length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-2">Atlikta</p>
                      {notes.filter(n => n.done).map(note => (
                        <div key={note.id} className="flex items-start gap-2 py-2 border-b border-slate-100 group opacity-50">
                          <button onClick={() => toggleNote(note.id)} className="mt-0.5 shrink-0 w-4 h-4 rounded border-2 border-emerald-400 bg-emerald-400 transition-colors cursor-pointer flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <span className="flex-1 text-sm text-slate-400 line-through leading-snug">{note.text}</span>
                          <button onClick={() => deleteNote(note.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-sm leading-none mt-0.5">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-20 bg-black/10" onClick={onToggle} />}
    </>
  );
}
