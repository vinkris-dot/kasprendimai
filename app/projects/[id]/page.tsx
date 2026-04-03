'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { STAGES, PROJECT_PARTS, formatDate, calcTargetDate, calcStageDates, TEAM_MEMBERS } from '@/lib/defaultData';
import { StageId, SelectedParts, PartId, MotyvuotasAtsakymas, TeamMemberId } from '@/lib/types';

const GROUP_LABELS: Record<string, string> = {
  pp: 'Projektiniai pasiūlymai',
  sld: 'Leidimas',
  tdp: 'Techninis darbo projektas',
  other: 'Kita',
};

type Tab = 'grafikas' | 'pp' | 'dokumentai' | 'motyvuoti' | 'pastabos';

const CATEGORY_ICONS: Record<string, string> = {
  'I. Tekstinė ir dokumentų dalis': '📄',
  'II. Sklypo plano sprendiniai': '🗺️',
  'III. Architektūriniai sprendiniai': '🏛️',
};

/** Determine which stages to show based on selected project parts */
function getActiveStages(selectedParts: import('@/lib/types').SelectedParts) {
  const show: StageId[] = ['SR'];
  if (selectedParts.PP) show.push('PP');
  if (selectedParts.VIESIMAS) show.push('PP_VIESIMAS');
  if (selectedParts.IP) show.push('IP');
  if (selectedParts.SLD) show.push('SLD');
  if (selectedParts.PAKARTOTINIS) show.push('PAKARTOTINIS');
  if (selectedParts.TDP) show.push('TDP');
  if (selectedParts.EKSPERTIZE) show.push('EKSPERTIZE');
  return show;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    projects, loaded,
    toggleChecklistItem, toggleDocument, updateDocumentNotes,
    toggleStage, updateProject, deleteProject, updateMotyvuotiAtsakymai,
  } = useProjects();

  const [tab, setTab] = useState<Tab>('grafikas');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [notesValue, setNotesValue] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', client: '', clientEmail: '', startDate: '' });
  const [editParts, setEditParts] = useState<SelectedParts | null>(null);
  const [newAtsakymas, setNewAtsakymas] = useState({ date: '', pastaba: '', atsakymas: '' });
  const [addingAtsakymas, setAddingAtsakymas] = useState(false);
  const [editingAtsakymasId, setEditingAtsakymasId] = useState<string | null>(null);

  const editPreviewDate = useMemo(() => {
    if (!editing || !editParts || !editForm.startDate) return '';
    return calcTargetDate(editForm.startDate, editParts);
  }, [editing, editParts, editForm.startDate]);

  if (!loaded) return null;

  const project = projects.find(p => p.id === id);
  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Projektas nerastas.</p>
        <Link href="/" className="text-sm text-slate-900 underline mt-2 block">← Grįžti</Link>
      </div>
    );
  }

  const selectedParts = project.selectedParts ?? {
    PP: true, VIESIMAS: false, SLD: true, TDP: true,
    BD: false, SP: false, SA: false, LVN: false, KITA: false, KITA_days: 14,
  };

  const activeStageIds = getActiveStages(selectedParts);
  const activeStages = STAGES.filter(s => activeStageIds.includes(s.id));
  const currentStages = project.activeStages ?? ['SR'];
  const completedStages = project.completedStages ?? [];
  const minActiveIndex = Math.min(...currentStages.map(s => activeStages.findIndex(a => a.id === s)).filter(i => i >= 0));

  const plannedDates = calcStageDates(project.startDate, selectedParts);

  const ppDone = project.ppByla.filter(i => i.done).length;
  const docsDone = project.dokumentai.filter(d => d.received).length;
  const ppCategories = Array.from(new Set(project.ppByla.map(i => i.category)));

  // All TDP sub-parts (for toggles)
  const tdpSubParts = PROJECT_PARTS.filter(p => p.group === 'tdp' && p.id !== 'TDP' && p.id !== 'EKSPERTIZE');

  // Compute planned dates for each active TDP sub-part (sequential within TDP window)
  const tdpPlannedDates: Record<string, { startDate: string; endDate: string }> = (() => {
    const tdpStart = plannedDates['TDP']?.startDate;
    if (!tdpStart) return {};
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let cursor = new Date(tdpStart);
    const result: Record<string, { startDate: string; endDate: string }> = {};
    for (const p of tdpSubParts) {
      if (!selectedParts[p.id as PartId]) continue;
      result[p.id] = { startDate: fmt(cursor), endDate: fmt(addDays(cursor, p.durationDays)) };
      cursor = addDays(cursor, p.durationDays);
    }
    return result;
  })();

  function handleSaveNotes() {
    updateProject(project!.id, { notes: notesValue || project!.notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  function handleEditOpen() {
    setEditForm({ name: project!.name, address: project!.address, client: project!.client, clientEmail: project!.clientEmail ?? '', startDate: project!.startDate });
    setEditParts({ ...project!.selectedParts });
    setEditing(true);
  }

  function handleEditSave() {
    const parts = editParts ?? project!.selectedParts;
    const newTarget = calcTargetDate(editForm.startDate, parts);
    updateProject(project!.id, { ...editForm, selectedParts: parts, targetConstructionDate: newTarget });
    setEditing(false);
  }

  function toggleEditPart(id: PartId) {
    setEditParts(p => p ? { ...p, [id]: !p[id] } : p);
  }

  function handleDelete() {
    if (confirm(`Ištrinti projektą "${project!.name}"?`)) {
      deleteProject(project!.id);
      router.push('/');
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'grafikas', label: 'Grafikas' },
    { id: 'pp', label: `PP sąrašas (${ppDone}/${project.ppByla.length})` },
    { id: 'dokumentai', label: `Dokumentai (${docsDone}/${project.dokumentai.length})` },
    { id: 'motyvuoti', label: `Motyvuoti atsakymai${project.motyvuotiAtsakymai.length > 0 ? ` (${project.motyvuotiAtsakymai.length})` : ''}` },
    { id: 'pastabos', label: 'Pastabos' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Visi projektai</Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            {editing && editParts ? (
              <div className="space-y-3 w-full">
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-lg font-semibold border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  value={editForm.client}
                  onChange={e => setEditForm(f => ({ ...f, client: e.target.value }))}
                  placeholder="Užsakovas"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  type="email"
                  value={editForm.clientEmail}
                  onChange={e => setEditForm(f => ({ ...f, clientEmail: e.target.value }))}
                  placeholder="Užsakovo el. paštas"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Projekto pradžia</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {/* Parts selection */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Projekto dalys</p>
                  {(['pp','sld','tdp','other'] as const).map(group => (
                    <div key={group} className="mb-3">
                      <p className="text-xs text-slate-400 mb-1.5">{GROUP_LABELS[group]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PROJECT_PARTS.filter(p => p.group === group).map(part => {
                          const checked = !!editParts[part.id];
                          return (
                            <label key={part.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 cursor-pointer text-xs font-medium transition-all select-none ${
                              checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                            }`}>
                              <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleEditPart(part.id as PartId)} />
                              {part.label}
                              <span className={`font-normal ${checked ? 'text-slate-400' : 'text-slate-400'}`}>
                                {part.durationDays / 7} sav.
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Live date preview */}
                  {editPreviewDate && (
                    <div className="mt-3 bg-slate-900 text-white rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Apskaičiuota statybos pradžia</span>
                      <span className="font-bold text-sm">{formatDate(editPreviewDate)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={handleEditSave} className="bg-slate-900 text-white text-xs px-4 py-2 rounded-lg hover:bg-slate-700">Išsaugoti</button>
                  <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Atšaukti</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
                  {currentStages.length === 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Baigtas</span>
                  )}
                  <button onClick={handleEditOpen} className="text-slate-400 hover:text-slate-700 transition-colors" title="Redaguoti">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
                <p className="text-slate-500 text-sm mt-0.5">{project.address}</p>
                <p className="text-slate-400 text-xs mt-0.5">{project.client}{project.clientEmail && <> · <a href={`mailto:${project.clientEmail}`} className="hover:text-slate-600">{project.clientEmail}</a></>}</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-2">
              <p className="text-xs text-slate-400">Statybos pradžia</p>
              <p className="text-lg font-bold text-slate-900">{formatDate(project.targetConstructionDate)}</p>
            </div>
            <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition-colors">
              Ištrinti projektą
            </button>
          </div>
        </div>
      </div>

      {/* Selected parts chips */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {PROJECT_PARTS.filter(p => selectedParts[p.id]).map(p => (
          <span key={p.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
            {p.label}
          </span>
        ))}
      </div>

      {/* Stage selector */}
      <div className={`rounded-xl border p-4 mb-6 ${currentStages.length === 0 ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Aktyvūs etapai</p>
          {currentStages.length === 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Projektas baigtas</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">Pasirinkite vienu metu vykstančius etapus</p>
        <div className="flex gap-2 flex-wrap">
          {activeStages.map((stage, i) => {
            const isCurrent = currentStages.includes(stage.id);
            const isPast = i < minActiveIndex || completedStages.includes(stage.id as StageId);
            return (
              <button
                key={stage.id}
                onClick={() => toggleStage(project.id, stage.id as StageId)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border-2 transition-all ${
                  isCurrent
                    ? `${stage.bgClass} ${stage.textClass} ${stage.colorClass}`
                    : isPast || currentStages.length === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                }`}
              >
                {(isPast || currentStages.length === 0) ? '✓ ' : ''}{stage.shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const missingDocs = project.dokumentai.filter(d => !d.received);
        const overdueStages = activeStages.filter(s => {
          const planned = plannedDates[s.id as StageId];
          if (!planned?.endDate) return false;
          const end = new Date(planned.endDate); end.setHours(0,0,0,0);
          return currentStages.includes(s.id) && end < today;
        });
        const urgentStages = activeStages.filter(s => {
          const planned = plannedDates[s.id as StageId];
          if (!planned?.endDate) return false;
          const end = new Date(planned.endDate); end.setHours(0,0,0,0);
          const days = Math.round((end.getTime() - today.getTime()) / 86400000);
          return currentStages.includes(s.id) && days >= 0 && days <= 7;
        });
        if (overdueStages.length === 0 && urgentStages.length === 0 && missingDocs.length === 0) return null;
        return (
          <div className="space-y-2 mb-6">
            {overdueStages.map(s => (
              <div key={s.id} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bgClass} ${s.textClass}`}>{s.shortName}</span>
                <span className="text-sm text-red-700 font-medium">Etapas vėluoja pagal planą</span>
              </div>
            ))}
            {urgentStages.map(s => {
              const end = new Date(plannedDates[s.id as StageId]!.endDate);
              const days = Math.round((end.getTime() - today.getTime()) / 86400000);
              return (
                <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bgClass} ${s.textClass}`}>{s.shortName}</span>
                  <span className="text-sm text-amber-700 font-medium">{days === 0 ? 'Baigiasi šiandien' : `Baigiasi po ${days} d.`}</span>
                </div>
              );
            })}
            {missingDocs.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700 font-medium mb-1">Trūksta {missingDocs.length} dokumentų</p>
                <p className="text-xs text-red-400">{missingDocs.slice(0,3).map(d => d.name).join(', ')}{missingDocs.length > 3 ? ` ir dar ${missingDocs.length - 3}...` : ''}</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* GRAFIKAS */}
      {tab === 'grafikas' && (
        <div className="space-y-3">
          {/* SR always first */}
          {activeStages.map((stage, i) => {
            const isCurrent = currentStages.includes(stage.id);
            const isPast = i < minActiveIndex || completedStages.includes(stage.id as StageId);
            const status = project.stageStatuses[stage.id as StageId];
            const isParallel = stage.id === 'TDP';

            return (
              <div
                key={stage.id}
                className={`bg-white rounded-xl border-l-4 ${stage.colorClass} border border-slate-200 p-4 ${
                  !isCurrent && !isPast ? 'opacity-50' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stage.bgClass} ${stage.textClass}`}>
                      {stage.shortName}
                    </span>
                    <span className="font-medium text-sm text-slate-800">{stage.name}</span>
                    {isParallel && (
                      <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">⇄ lygiagrečiai su SLD</span>
                    )}
                    {status?.endDate && <span className="text-green-500 text-xs font-medium">✓ Baigta</span>}
                    {!status?.endDate && isCurrent && <span className="text-xs text-slate-500 font-medium">⬤ vyksta</span>}
                    {!status?.endDate && isPast && !isCurrent && <span className="text-xs text-slate-400 font-medium">◦ ankstesnis</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Assignee badges */}
                    {(() => {
                      const assignees = (project.stageAssignees ?? {})[stage.id as StageId] ?? [];
                      return (
                        <div className="flex gap-1">
                          {TEAM_MEMBERS.map(m => {
                            const active = assignees.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                title={m.name}
                                onClick={() => {
                                  const cur = (project.stageAssignees ?? {})[stage.id as StageId] ?? [];
                                  const next = cur.includes(m.id) ? cur.filter(x => x !== m.id) : [...cur, m.id];
                                  updateProject(project.id, {
                                    stageAssignees: { ...(project.stageAssignees ?? {}), [stage.id]: next }
                                  });
                                }}
                                className={`text-xs font-semibold w-7 h-7 rounded-full transition-all ${
                                  active ? `${m.color} ${m.textColor}` : 'bg-slate-100 text-slate-300'
                                }`}
                              >
                                {m.id === 'EXT' ? 'E' : m.initials}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <span className="text-xs text-slate-400">{stage.durationLabel}</span>
                  </div>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left: dates + tasks */}
                  <div>
                    {/* Planned dates */}
                    {(() => {
                      const planned = plannedDates[stage.id as StageId];
                      return planned ? (
                        <div className="flex items-center gap-3 text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-2">
                          <span className="text-slate-400 font-medium shrink-0">Planas:</span>
                          <span className="text-slate-600">{formatDate(planned.startDate)}</span>
                          <span className="text-slate-300">→</span>
                          <span className="text-slate-600">{formatDate(planned.endDate)}</span>
                        </div>
                      ) : null;
                    })()}

                    {/* Actual dates */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Faktas: pradžia</label>
                        <input
                          type="date"
                          value={status?.startDate ?? ''}
                          onChange={e => updateProject(project.id, {
                            stageStatuses: { ...project.stageStatuses, [stage.id]: { ...status, startDate: e.target.value } },
                          })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Faktas: pabaiga</label>
                        <input
                          type="date"
                          value={status?.endDate ?? ''}
                          onChange={e => updateProject(project.id, {
                            stageStatuses: { ...project.stageStatuses, [stage.id]: { ...status, endDate: e.target.value } },
                          })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    {/* TDP sub-parts — toggles + per-part date tracking */}
                    {stage.id === 'TDP' && (
                      <div className="mb-3 space-y-2">
                        {/* Toggle buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {tdpSubParts.map(p => {
                            const active = !!selectedParts[p.id as PartId];
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  const newParts = { ...selectedParts, [p.id]: !active };
                                  const newTarget = calcTargetDate(project.startDate, newParts);
                                  updateProject(project.id, { selectedParts: newParts, targetConstructionDate: newTarget });
                                }}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                                  active
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-400'
                                }`}
                              >
                                {p.label} <span className={active ? 'text-indigo-200' : 'text-slate-300'}>{p.durationDays / 7} sav.</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Active sub-part rows — compact */}
                        {tdpSubParts.filter(p => !!selectedParts[p.id as PartId]).map(p => {
                          const planned = tdpPlannedDates[p.id];
                          const pStatus = (project.partStatuses ?? {})[p.id];
                          const done = !!pStatus?.endDate;
                          return (
                            <div key={p.id} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 border transition-all ${done ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                              {/* Done toggle */}
                              <button
                                onClick={() => updateProject(project.id, {
                                  partStatuses: { ...(project.partStatuses ?? {}), [p.id]: { ...pStatus, endDate: done ? '' : new Date().toISOString().slice(0, 10) } }
                                })}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-indigo-400'}`}
                              >
                                {done && <span className="text-xs">✓</span>}
                              </button>
                              {/* Label */}
                              <span className={`text-xs font-semibold w-8 shrink-0 ${done ? 'text-green-600' : 'text-indigo-700'}`}>{p.label}</span>
                              {/* Planned dates */}
                              {planned && (
                                <span className={`text-xs flex-1 ${done ? 'text-green-500 line-through' : 'text-slate-400'}`}>
                                  {formatDate(planned.startDate)} → {formatDate(planned.endDate)}
                                </span>
                              )}
                              {/* Actual end date (editable, shown only when done) */}
                              {done && (
                                <input type="date" value={pStatus?.endDate ?? ''}
                                  onChange={e => updateProject(project.id, {
                                    partStatuses: { ...(project.partStatuses ?? {}), [p.id]: { ...pStatus, endDate: e.target.value } }
                                  })}
                                  className="border border-green-200 rounded px-1.5 py-0.5 text-xs text-green-700 bg-white focus:outline-none w-32 shrink-0"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tasks */}
                    <div className="space-y-1">
                      {stage.tasks.map(task => (
                        <div key={task.label} className="flex items-center justify-between text-xs text-slate-500">
                          <span>• {task.label}</span>
                          <span className="text-slate-400 ml-4 flex-shrink-0">{task.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: notes */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Pastabos</label>
                    <textarea
                      value={status?.notes ?? ''}
                      onChange={e => updateProject(project.id, {
                        stageStatuses: { ...project.stageStatuses, [stage.id]: { ...status, notes: e.target.value } },
                      })}
                      placeholder="Komentarai, susitarimai, savivaldybės pastabos..."
                      rows={5}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none text-slate-700 placeholder-slate-300"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Target date summary */}
          <div className="bg-slate-900 text-white rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Tikslinė statybos pradžia</p>
                <p className="text-xl font-bold">{formatDate(project.targetConstructionDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Pradžia</p>
                <p className="text-sm font-medium">{formatDate(project.startDate)}</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* PP SĄRAŠAS */}
      {tab === 'pp' && (
        <div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5 text-xs text-slate-600">
            <strong>📁 FAILAS Nr. 1 – PP BYLA</strong> (Adresas_PP_projektiniai_pasiulymai.pdf)<br />
            Techninė ir architektūrinė projekto dalis. Teikiama <strong>atskirai</strong> nuo dokumentų failo.
          </div>

          <div className="space-y-6">
            {ppCategories.map(category => {
              const items = project.ppByla.filter(i => i.category === category);
              const categoryDone = items.filter(i => i.done).length;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{CATEGORY_ICONS[category] ?? '📋'}</span>
                    <h3 className="font-semibold text-sm text-slate-700">{category}</h3>
                    <span className="text-xs text-slate-400 ml-auto">{categoryDone}/{items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(item => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          item.done ? 'bg-green-50 border border-green-100' : 'bg-white border border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleChecklistItem(project.id, item.id)}
                          className="mt-0.5 h-4 w-4 accent-green-600 flex-shrink-0"
                        />
                        <span className={`text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOKUMENTAI */}
      {tab === 'dokumentai' && (
        <div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5 text-xs text-slate-600">
            <strong>📜 FAILAS Nr. 2 – DOKUMENTAI</strong> (Adresas_PP_dokumentai.pdf)<br />
            Teikiami <strong>atskirame</strong> faile nuo PP bylos.
          </div>

          <div className="space-y-2">
            {project.dokumentai.map(doc => (
              <div
                key={doc.id}
                className={`bg-white rounded-xl border p-4 transition-colors ${
                  doc.received ? 'border-green-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={doc.received}
                    onChange={() => toggleDocument(project.id, doc.id)}
                    className="mt-0.5 h-4 w-4 accent-green-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        doc.received ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>{doc.number}</span>
                      <span className={`text-sm font-medium ${doc.received ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {doc.name}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-xs text-slate-400 mt-0.5 ml-7">{doc.description}</p>
                    )}
                    {editingNote === doc.id ? (
                      <div className="mt-2 ml-7">
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          placeholder="Pastabos..."
                          rows={2}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <button
                            onClick={() => { updateDocumentNotes(project.id, doc.id, noteText); setEditingNote(null); }}
                            className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded"
                          >Išsaugoti</button>
                          <button onClick={() => setEditingNote(null)} className="text-xs text-slate-500">Atšaukti</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingNote(doc.id); setNoteText(doc.notes); }}
                        className="mt-1.5 ml-7 text-xs text-slate-400 hover:text-slate-600"
                      >
                        {doc.notes ? `📝 ${doc.notes}` : '+ Pastaba'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Missing summary */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            {project.dokumentai.every(d => d.received) ? (
              <p className="text-sm text-green-700 font-medium">✓ Visi dokumentai gauti!</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  Trūksta {project.dokumentai.filter(d => !d.received).length} dokumentų:
                </p>
                <div className="space-y-1">
                  {project.dokumentai.filter(d => !d.received).map(d => (
                    <p key={d.id} className="text-xs text-amber-700">
                      • <strong>{d.number}.</strong> {d.name}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* MOTYVUOTI ATSAKYMAI */}
      {tab === 'motyvuoti' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-400">Savivaldybės pastabos ir mūsų atsakymai</p>
            <button
              onClick={() => { setAddingAtsakymas(true); setNewAtsakymas({ date: new Date().toISOString().slice(0, 10), pastaba: '', atsakymas: '' }); }}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            >+ Pridėti</button>
          </div>

          {addingAtsakymas && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Data</label>
                <input type="date" value={newAtsakymas.date} onChange={e => setNewAtsakymas(a => ({ ...a, date: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Savivaldybės pastaba</label>
                <textarea rows={3} value={newAtsakymas.pastaba} onChange={e => setNewAtsakymas(a => ({ ...a, pastaba: e.target.value }))}
                  placeholder="Pastabos tekstas..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Mūsų atsakymas / veiksmai</label>
                <textarea rows={2} value={newAtsakymas.atsakymas} onChange={e => setNewAtsakymas(a => ({ ...a, atsakymas: e.target.value }))}
                  placeholder="Kaip atsakėme ar ką padarėme..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!newAtsakymas.pastaba.trim()) return;
                    const item: MotyvuotasAtsakymas = { id: crypto.randomUUID(), atsakyta: false, ...newAtsakymas };
                    updateMotyvuotiAtsakymai(project.id, [...(project.motyvuotiAtsakymai ?? []), item]);
                    setAddingAtsakymas(false);
                  }}
                  className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700"
                >Išsaugoti</button>
                <button onClick={() => setAddingAtsakymas(false)} className="text-xs text-slate-500 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50">Atšaukti</button>
              </div>
            </div>
          )}

          {(project.motyvuotiAtsakymai ?? []).length === 0 && !addingAtsakymas ? (
            <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">Nėra įrašų</p>
          ) : (
            <div className="space-y-3">
              {(project.motyvuotiAtsakymai ?? []).map(item => (
                <div key={item.id} className={`bg-white rounded-xl border p-4 ${item.atsakyta ? 'border-green-200' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">{item.date ? item.date.split('-').reverse().join('.') : '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.atsakyta ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.atsakyta ? '✓ Atsakyta' : 'Laukia atsakymo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const updated = (project.motyvuotiAtsakymai ?? []).map(a => a.id === item.id ? { ...a, atsakyta: !a.atsakyta } : a);
                          updateMotyvuotiAtsakymai(project.id, updated);
                        }}
                        className="text-xs text-slate-400 hover:text-slate-700"
                      >{item.atsakyta ? 'Atžymėti' : 'Pažymėti atsakyta'}</button>
                      <button
                        onClick={() => {
                          if (confirm('Ištrinti šį įrašą?')) {
                            updateMotyvuotiAtsakymai(project.id, (project.motyvuotiAtsakymai ?? []).filter(a => a.id !== item.id));
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >✕</button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mb-2 whitespace-pre-wrap">{item.pastaba}</p>
                  {item.atsakymas && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2 mt-2">
                      <p className="text-xs text-slate-400 mb-1">Mūsų atsakymas:</p>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{item.atsakymas}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PASTABOS */}
      {tab === 'pastabos' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Projekto pastabos</label>
          <textarea
            value={notesValue !== '' ? notesValue : project.notes}
            onChange={e => setNotesValue(e.target.value)}
            onFocus={() => notesValue === '' && setNotesValue(project.notes)}
            placeholder="Pastabos, susitarimai su užsakovu, savivaldybės komentarai..."
            rows={10}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSaveNotes}
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Išsaugoti
            </button>
            {notesSaved && <span className="text-sm text-green-600">✓ Išsaugota</span>}
          </div>
        </div>
      )}
    </div>
  );
}
