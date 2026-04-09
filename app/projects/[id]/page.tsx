'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { STAGES, PROJECT_PARTS, formatDate, calcTargetDate, calcStageDates, calcEffectiveStageDates, TEAM_MEMBERS } from '@/lib/defaultData';
import { StageId, SelectedParts, PartId, MotyvuotasAtsakymas, TeamMemberId, UploadedFile, ProjektavimoUzduotis, DEFAULT_PU } from '@/lib/types';

const GROUP_LABELS: Record<string, string> = {
  pp: 'Projektiniai pasiūlymai',
  sld: 'Leidimas',
  tdp: 'Techninis darbo projektas',
  other: 'Kita',
};

type Tab = 'grafikas' | 'pp' | 'dokumentai' | 'motyvuoti' | 'pastabos' | 'pu';

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
    updateConnectionDate,
    addDocumentFile, addChecklistFile, removeDocumentFile, removeChecklistFile,
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
  const [folderStatus, setFolderStatus] = useState<'idle' | 'creating' | 'done' | 'error'>('idle');

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
  const effectiveDates = calcEffectiveStageDates(project.startDate, selectedParts, project.stageStatuses ?? {});
  // Efektyvi statybos pradžios data — paskutinio aktyvaus etapo prognozuojama pabaiga
  const effectiveTargetDate = (() => {
    const stageOrder: StageId[] = ['SR', 'PP', 'PP_VIESIMAS', 'IP', 'SLD', 'TDP', 'PAKARTOTINIS', 'EKSPERTIZE'];
    // Pirma tikrinam aktyvius etapus: jei yra faktinė pradžia, skaičiuojam prognozę
    for (let i = stageOrder.length - 1; i >= 0; i--) {
      const sid = stageOrder[i];
      const planned = plannedDates[sid];
      const status = project.stageStatuses?.[sid];
      if (!planned) continue;
      if (status?.startDate && !status?.endDate) {
        const dur = new Date(planned.endDate).getTime() - new Date(planned.startDate).getTime();
        return new Date(new Date(status.startDate).getTime() + dur).toISOString().slice(0, 10);
      }
      if (status?.endDate) return status.endDate;
      const d = effectiveDates[sid];
      if (d) return d.endDate;
    }
    return project.targetConstructionDate;
  })();

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

  async function uploadFile(file: File, subfolder: string, filename: string, onDone: (f: UploadedFile) => void, onError: () => void) {
    const form = new FormData();
    form.append('file', file);
    form.append('projectName', project!.name);
    form.append('subfolder', subfolder);
    form.append('filename', filename);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) { onError(); return; }
      const data = await res.json();
      onDone({ name: data.name, path: data.path, uploadedAt: new Date().toISOString() });
    } catch { onError(); }
  }

  async function deleteFile(filePath: string, onDone: () => void) {
    try {
      await fetch('/api/delete-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) });
    } catch {}
    onDone();
  }

  async function handleCreateFolder() {
    setFolderStatus('creating');
    try {
      const res = await fetch('/api/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: project!.name,
          parts: { PP: selectedParts.PP, SLD: selectedParts.SLD, TDP: selectedParts.TDP },
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`Klaida: ${data.error}`); setFolderStatus('error'); return; }
      setFolderStatus('done');
      setTimeout(() => setFolderStatus('idle'), 3000);
    } catch {
      setFolderStatus('error');
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'grafikas', label: 'Grafikas' },
    { id: 'pp', label: `PP sąrašas (${ppDone}/${project.ppByla.length})` },
    { id: 'dokumentai', label: `Dokumentai (${docsDone}/${project.dokumentai.length})` },
    { id: 'motyvuoti', label: `Motyvuoti${project.motyvuotiAtsakymai.length > 0 ? ` (${project.motyvuotiAtsakymai.length})` : ''}` },
    { id: 'pastabos', label: 'Pastabos' },
    { id: 'pu', label: 'PU' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Visi projektai</Link>
          <div className="flex items-center gap-3">
            <Link href={`/projects/${project.id}/klientas`} target="_blank" className="text-sm text-slate-400 hover:text-slate-700 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Kliento ataskaita
            </Link>
            <span className="text-slate-200">|</span>
            <Link href={`/projects/${project.id}/print`} target="_blank" className="text-sm text-slate-400 hover:text-slate-700 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Spausdinti
            </Link>
          </div>
        </div>
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

                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-2">
                    <button onClick={handleEditSave} className="bg-slate-900 text-white text-xs px-4 py-2 rounded-lg hover:bg-slate-700">Išsaugoti</button>
                    <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Atšaukti</button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { updateProject(project!.id, { archived: !project!.archived }); setEditing(false); }} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">{project!.archived ? '↩ Atarchyvuoti' : '📦 Archyvuoti'}</button>
                    <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition-colors">Ištrinti projektą</button>
                  </div>
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
                {project.address && project.address !== project.name && (
                  <p className="text-slate-500 text-sm mt-0.5">{project.address}</p>
                )}
                <p className="text-slate-400 text-xs mt-0.5">{project.client}{project.clientEmail && <> · <a href={`mailto:${project.clientEmail}`} className="hover:text-slate-600">{project.clientEmail}</a></>}</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <div className={`border rounded-xl px-4 py-2.5 mb-2 ${effectiveTargetDate !== project.targetConstructionDate ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-xs text-slate-400">Statybos pradžia</p>
              <p className="text-lg font-bold text-slate-900">{formatDate(project.targetConstructionDate)}</p>
              {effectiveTargetDate !== project.targetConstructionDate && (
                <p className="text-xs text-amber-600 mt-0.5">Numatoma: <strong>{formatDate(effectiveTargetDate)}</strong></p>
              )}
            </div>
            <button
              onClick={handleCreateFolder}
              disabled={folderStatus === 'creating'}
              className={`text-xs mb-1 block transition-colors ${
                folderStatus === 'done' ? 'text-green-600' :
                folderStatus === 'error' ? 'text-red-500 hover:text-red-700' :
                'text-slate-500 hover:text-slate-900'
              }`}
            >
              {folderStatus === 'creating' ? '⏳ Kuriama...' :
               folderStatus === 'done' ? '✓ Aplankas sukurtas' :
               folderStatus === 'error' ? '↺ Bandyti vėl' :
               '📁 Sukurti aplanką'}
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
        <div className="flex gap-1 overflow-x-auto scrollbar-none"
          style={{scrollbarWidth:'none',msOverflowStyle:'none'}}>
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
                    {status?.endDate && <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓ Baigta</span>}
                    {!status?.endDate && isCurrent && <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>vyksta</span>}
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
                    {/* Planned dates + forecast */}
                    {(() => {
                      const planned = plannedDates[stage.id as StageId];
                      if (!planned) return null;
                      // Prognozuojama pabaiga: faktinė pradžia + planuota trukmė
                      const plannedDuration = new Date(planned.endDate).getTime() - new Date(planned.startDate).getTime();
                      const forecastEnd = status?.startDate && !status?.endDate
                        ? new Date(new Date(status.startDate).getTime() + plannedDuration).toISOString().slice(0, 10)
                        : null;
                      return (
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-3 text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            <span className="text-slate-400 font-medium shrink-0 w-14">Planas:</span>
                            <span className="text-slate-600 whitespace-nowrap">{formatDate(planned.startDate)}</span>
                            <span className="text-slate-300">→</span>
                            <span className="text-slate-600 whitespace-nowrap">{formatDate(planned.endDate)}</span>
                          </div>
                          {forecastEnd && (
                            <div className="flex items-center gap-3 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <span className="text-amber-500 font-medium shrink-0 w-14">Numatoma:</span>
                              <span className="text-amber-700 whitespace-nowrap">{formatDate(status!.startDate)}</span>
                              <span className="text-amber-300">→</span>
                              <span className="text-amber-700 font-medium whitespace-nowrap">{formatDate(forecastEnd)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Baigti šiandien */}
                    {isCurrent && !status?.endDate && (
                      <button
                        onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          updateProject(project.id, { stageStatuses: { ...project.stageStatuses, [stage.id]: { ...status, endDate: today } } });
                        }}
                        className="w-full mb-2 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        ✓ Baigti šiandien
                      </button>
                    )}

                    {/* Actual dates */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Faktas: pradžia</label>
                        <div className="relative w-full" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.()}>
                          <span className="flex items-center gap-1.5 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{status?.startDate ? formatDate(status.startDate) : '—'}</span>
                          <input type="date" value={status?.startDate ?? ''} onChange={e => updateProject(project.id, { stageStatuses: { ...project.stageStatuses, [stage.id]: { ...status, startDate: e.target.value } } })} className="absolute inset-0 opacity-0 w-full" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Faktas: pabaiga</label>
                        <div className="relative w-full" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.()}>
                          <span className="flex items-center gap-1.5 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{status?.endDate ? formatDate(status.endDate) : '—'}</span>
                          <input type="date" value={status?.endDate ?? ''} onChange={e => updateProject(project.id, { stageStatuses: { ...project.stageStatuses, [stage.id]: { ...status, endDate: e.target.value } } })} className="absolute inset-0 opacity-0 w-full" />
                        </div>
                      </div>
                    </div>

                    {/* TDP sub-parts — toggles + per-part date tracking */}
                    {stage.id === 'TDP' && (
                      <div className="mb-3 space-y-2">
                        {/* Toggle buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {tdpSubParts.map(p => {
                            const active = !!selectedParts[p.id as PartId];
                            const hasSpSaLvn = !!(selectedParts.SP || selectedParts.SA || selectedParts.LVN);
                            const bdDisabled = p.id === 'BD' && !hasSpSaLvn;
                            return (
                              <button
                                key={p.id}
                                disabled={bdDisabled}
                                title={bdDisabled ? 'BD įjungiama tik kai yra SP, SA arba LVN' : undefined}
                                onClick={() => {
                                  if (bdDisabled) return;
                                  const newParts = { ...selectedParts, [p.id]: !active };
                                  const newTarget = calcTargetDate(project.startDate, newParts);
                                  updateProject(project.id, { selectedParts: newParts, targetConstructionDate: newTarget });
                                }}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                                  bdDisabled
                                    ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                    : active
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
                                  partStatuses: { ...(project.partStatuses ?? {}), [p.id]: { startDate: pStatus?.startDate ?? '', completed: pStatus?.completed ?? false, notes: pStatus?.notes ?? '', endDate: done ? '' : new Date().toISOString().slice(0, 10) } }
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
                                <div className="relative shrink-0" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.()}>
                                  <span className="flex items-center gap-1 border border-green-200 rounded px-1.5 py-0.5 text-xs text-green-700 bg-white w-32 cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{pStatus?.endDate ? formatDate(pStatus.endDate) : '—'}</span>
                                  <input type="date" value={pStatus?.endDate ?? ''} onChange={e => updateProject(project.id, { partStatuses: { ...(project.partStatuses ?? {}), [p.id]: { ...pStatus, endDate: e.target.value } } })} className="absolute inset-0 opacity-0 w-full" />
                                </div>
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
                <p className="text-xs text-slate-400 mb-1">Planuojama statybos pradžia</p>
                <p className="text-xl font-bold">{formatDate(project.targetConstructionDate)}</p>
                {effectiveTargetDate !== project.targetConstructionDate && (
                  <p className="text-xs text-amber-400 mt-1">Numatoma: <strong>{formatDate(effectiveTargetDate)}</strong></p>
                )}
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
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg transition-colors ${
                          item.done ? 'bg-green-50 border border-green-100' : 'bg-white border border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => toggleChecklistItem(project.id, item.id)}
                            className="mt-0.5 h-4 w-4 accent-green-600 flex-shrink-0"
                          />
                          <span className={`text-sm flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {item.label}
                          </span>
                          <label className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 bg-slate-100 hover:bg-slate-200 rounded px-1.5 py-0.5 text-xs" title="Pridėti failą">
                            <input type="file" className="hidden" onChange={e => {
                              const f = e.target.files?.[0]; if (!f) return;
                              uploadFile(f, item.subfolder ?? '01_PP/01_PP_BYLA/01_DOKUMENTAI', item.label, uf => addChecklistFile(project.id, item.id, uf), () => alert('Klaida įkeliant failą'));
                              e.target.value = '';
                            }} />
                            📎
                          </label>
                        </div>
                        {(item.files ?? []).length > 0 && (
                          <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                            {(item.files ?? []).map(f => (
                              <span key={f.path} className="flex items-center gap-1 text-xs bg-slate-100 rounded px-2 py-0.5">
                                <a href={`/api/files?path=${encodeURIComponent(f.path)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[160px] truncate">{f.name}</a>
                                {f.uploadedAt && <span className="text-slate-400">{f.uploadedAt.slice(0, 10)}</span>}
                                <button onClick={() => deleteFile(f.path, () => removeChecklistFile(project.id, item.id, f.path))} className="text-slate-300 hover:text-red-400 ml-0.5">×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        doc.received ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>{doc.number}</span>
                      <span className={`text-sm font-medium flex-1 ${doc.received ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {doc.name}
                      </span>
                      <label className="cursor-pointer text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0" title="Pridėti failą">
                        <input type="file" className="hidden" onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          uploadFile(f, doc.subfolder ?? 'DOKUMENTAI', `${doc.number}_${doc.name}`, uf => addDocumentFile(project.id, doc.id, uf), () => alert('Klaida įkeliant failą'));
                          e.target.value = '';
                        }} />
                        📎
                      </label>
                    </div>
                    {(doc.files ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(doc.files ?? []).map(f => (
                          <span key={f.path} className="flex items-center gap-1 text-xs bg-slate-100 rounded px-2 py-0.5">
                            <a href={`/api/files?path=${encodeURIComponent(f.path)}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline max-w-[180px] truncate">{f.name}</a>
                            {f.uploadedAt && <span className="text-slate-400">{f.uploadedAt.slice(0, 10)}</span>}
                            <button onClick={() => deleteFile(f.path, () => removeDocumentFile(project.id, doc.id, f.path))} className="text-slate-300 hover:text-red-400 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {doc.description && (
                      <p className="text-xs text-slate-400 mt-0.5 ml-7">{doc.description}</p>
                    )}
                    {doc.id === 'doc-06' && (
                      <div className="mt-2 ml-7 space-y-1">
                        {[
                          { key: 'vanduo', label: 'vanduo, nuotekos' },
                          { key: 'lietus', label: 'lietus' },
                          { key: 'kelias', label: 'kelias' },
                          { key: 'elektra', label: 'elektra' },
                          { key: 'rysiai', label: 'ryšiai' },
                          { key: 'dujos', label: 'dujos' },
                        ].map(({ key, label }) => {
                          const date = doc.connectionDates?.[key] ?? '';
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className={`text-xs w-36 ${date ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
                              <div className="relative flex items-center" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.()}>
                                <span className={`flex items-center gap-1 text-xs border border-slate-200 rounded px-2 py-0.5 w-28 cursor-pointer ${date ? 'text-slate-700' : 'text-slate-400'}`}><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{date ? formatDate(date) : '—'}</span>
                                <input
                                  type="date"
                                  value={date}
                                  onChange={e => updateConnectionDate(project.id, doc.id, key, e.target.value)}
                                  className="absolute inset-0 opacity-0 w-full"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                <div className="relative inline-block" onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.()}>
                  <span className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 min-w-[120px] cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{newAtsakymas.date ? formatDate(newAtsakymas.date) : '—'}</span>
                  <input type="date" value={newAtsakymas.date} onChange={e => setNewAtsakymas(a => ({ ...a, date: e.target.value }))} className="absolute inset-0 opacity-0 w-full" />
                </div>
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
                      <span className="text-xs text-slate-400 font-medium">{formatDate(item.date)}</span>
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

      {tab === 'pu' && (
        <PUTab pu={project.pu ?? { ...DEFAULT_PU }} onChange={pu => updateProject(project.id, { pu })} project={project} />
      )}
    </div>
  );
}

// ─── Projektavimo užduotis tab ───────────────────────────────────────────────

const PRIORITETAI_LABELS = [
  { key: 'funkcionalumas' as const, label: 'Funkcionalumas' },
  { key: 'archIsraiška' as const, label: 'Architektūrinė išraiška' },
  { key: 'statybosKaina' as const, label: 'Statybos kaina' },
  { key: 'energinis' as const, label: 'Energinis efektyvumas' },
  { key: 'paprastumas' as const, label: 'Statybos paprastumas' },
];

function PURadio({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.value} type="button"
            onClick={() => onChange(value === o.value ? '' : o.value)}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
              value === o.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PUTab({ pu, onChange, project }: { pu: ProjektavimoUzduotis; onChange: (pu: ProjektavimoUzduotis) => void; project: import('@/lib/types').Project }) {
  const [exporting, setExporting] = useState(false);

  function set<K extends keyof ProjektavimoUzduotis>(key: K, val: ProjektavimoUzduotis[K]) {
    onChange({ ...pu, [key]: val });
  }
  function setPriority(key: keyof ProjektavimoUzduotis['prioritetai'], rank: number) {
    onChange({ ...pu, prioritetai: { ...pu.prioritetai, [key]: pu.prioritetai[key] === rank ? 0 : rank } });
  }
  function toggleFasadas(val: string) {
    onChange({ ...pu, fasadai: pu.fasadai.includes(val) ? pu.fasadai.filter(f => f !== val) : [...pu.fasadai, val] });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const body = {
        projectName: project.name,
        address: project.address,
        client: project.client,
        clientEmail: project.clientEmail,
        startDate: project.startDate,
        hasPP: project.selectedParts.PP,
        hasSLD: project.selectedParts.SLD,
        hasTDP: project.selectedParts.TDP,
        hasBD: project.selectedParts.BD,
        hasLVN: project.selectedParts.LVN,
        ...pu,
      };
      const res = await fetch('/api/pu-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : 'PU.docx';

      // 1. Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 2. Auto-save to project folder DOKUMENTAI/01_PROJEKTAVIMO UZDUOTIS
      try {
        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('projectName', project.name);
        formData.append('subfolder', 'DOKUMENTAI/01_PROJEKTAVIMO UZDUOTIS');
        formData.append('filename', 'PU');
        await fetch('/api/upload', { method: 'POST', body: formData });
      } catch {
        // silent — download already succeeded
      }
    } catch {
      alert('Nepavyko eksportuoti. Bandykite dar kartą.');
    } finally {
      setExporting(false);
    }
  }

  const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900";
  const section = "bg-white rounded-xl border border-slate-200 p-5 space-y-4";

  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {exporting ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
          )}
          {exporting ? 'Eksportuojama…' : 'Eksportuoti į Word'}
        </button>
      </div>
      {/* Section 2 */}
      <div className={section}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">2. Projektavimo duomenys</h3>
        <div className="grid grid-cols-2 gap-4">
          {([
            ['objektas', 'Projektavimo objektas', 'pvz. Gyvenamasis namas'],
            ['statybosRusis', 'Statybos rūšis', 'pvz. Nauja statyba'],
            ['bendrasPlotai', 'Bendras plotas, m²', 'pvz. 180'],
            ['sklypoPlotai', 'Sklypo plotas, m²', 'pvz. 1200'],
            ['zemesPaskirtis', 'Žemės sklypo paskirtis', 'pvz. Gyvenamoji'],
            ['telefonas', 'Telefono Nr.', '+370 600 00000'],
          ] as [keyof ProjektavimoUzduotis, string, string][]).map(([key, lbl, ph]) => (
            <div key={key as string}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{lbl}</label>
              <input value={pu[key] as string} onChange={e => set(key, e.target.value as any)}
                placeholder={ph} className={inp} />
            </div>
          ))}
        </div>
      </div>

      {/* Section 4 */}
      <div className={section}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">4. Prioritetai (1–5)</h3>
        <p className="text-xs text-slate-400">Sunumeruokite nuo 1 (svarbiausias) iki 5</p>
        {PRIORITETAI_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm text-slate-700 w-48 shrink-0">{label}</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setPriority(key, n)}
                  className={`w-8 h-8 rounded-lg border text-sm font-medium transition-all ${
                    pu.prioritetai[key] === n ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Section 5 */}
      <div className={section}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">5. Funkcinė struktūra</h3>

        <p className="text-sm font-semibold text-slate-600">Bendra erdvė</p>
        <PURadio label="Virtuvės tipas" value={pu.virtuveTipas} onChange={v => set('virtuveTipas', v as any)}
          options={[{ value: 'atvira', label: 'Atvira' }, { value: 'pusiau_atvira', label: 'Pusiau atvira' }, { value: 'uzdara', label: 'Uždara' }]} />
        <PURadio label="Bendros erdvės dydis" value={pu.bendrosErdvesDydis} onChange={v => set('bendrosErdvesDydis', v as any)}
          options={[{ value: 'vidutine', label: '~45–50 m²' }, { value: 'erdvi', label: '~50–60 m²' }, { value: 'labai_erdvi', label: '60 m²+' }, { value: 'kita', label: 'Kita' }]} />
        {pu.bendrosErdvesDydis === 'kita' && (
          <input value={pu.bendrosErdvesDydisKita} onChange={e => set('bendrosErdvesDydisKita', e.target.value)} placeholder="Nurodyti dydį" className={inp} />
        )}
        <PURadio label="Lubų aukštis" value={pu.lubosAukstis} onChange={v => set('lubosAukstis', v as any)}
          options={[{ value: 'standartinis', label: '~2,80–3,00 m' }, { value: 'padidintas', label: '~3,20–3,40 m' }, { value: 'dvieju_aukstu', label: 'Dviejų aukštų' }, { value: 'kitas', label: 'Kitas' }]} />
        {pu.lubosAukstis === 'kitas' && (
          <input value={pu.lubosAukstisKitas} onChange={e => set('lubosAukstisKitas', e.target.value)} placeholder="Nurodyti aukštį" className={inp} />
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={pu.sandeliukasPrieVirtuve} onChange={e => set('sandeliukasPrieVirtuve', e.target.checked)} className="rounded border-slate-300" />
          <span className="text-sm text-slate-700">Sandėliukas prie virtuvės</span>
        </label>

        <p className="text-sm font-semibold text-slate-600 pt-2">Gyvenamosios patalpos</p>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-700 shrink-0">Vaikų kambarių skaičius</label>
          <input type="number" min={0} max={10} value={pu.vaikusKambariuSk || ''} onChange={e => set('vaikusKambariuSk', parseInt(e.target.value) || 0)}
            className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0" />
        </div>
        <PURadio label="Darbo kambarys" value={pu.darbKambarys} onChange={v => set('darbKambarys', v as any)}
          options={[{ value: 'reikalingas', label: 'Reikalingas' }, { value: 'universali', label: 'Universali patalpa' }, { value: 'nereikalingas', label: 'Nereikalingas' }]} />
        <PURadio label="Tėvų drabužinė" value={pu.drabuzine} onChange={v => set('drabuzine', v as any)}
          options={[{ value: 'atskira', label: 'Atskira' }, { value: 'miegamojo', label: 'Miegamojo patalpoje' }, { value: 'nenumatoma', label: 'Nenumatoma' }]} />
        <PURadio label="Atskiras tėvų sanitarinis mazgas" value={pu.tevisSmaz} onChange={v => set('tevisSmaz', v as any)}
          options={[{ value: 'su_dusu', label: 'Su dušu' }, { value: 'su_vonia', label: 'Su vonia' }, { value: 'ne', label: 'Ne' }]} />

        <p className="text-sm font-semibold text-slate-600 pt-2">Sanitarinės ir pagalbinės patalpos</p>
        <PURadio label="Bendras vonios kambarys" value={pu.bendrasVonios} onChange={v => set('bendrasVonios', v as any)}
          options={[{ value: 'su_vonia', label: 'Su vonia' }, { value: 'su_dusu', label: 'Su dušu' }]} />
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pu.papildomasWC} onChange={e => set('papildomasWC', e.target.checked)} className="rounded border-slate-300" />
            <span className="text-sm text-slate-700">Papildomas WC</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pu.techPatalpa} onChange={e => set('techPatalpa', e.target.checked)} className="rounded border-slate-300" />
            <span className="text-sm text-slate-700">Techninė patalpa / sandėliukas</span>
          </label>
        </div>
        <PURadio label="Skalbykla" value={pu.skalbykla} onChange={v => set('skalbykla', v as any)}
          options={[{ value: 'atskira', label: 'Atskira patalpa' }, { value: 'technine', label: 'Techninėje patalpoje' }]} />
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-700 shrink-0">Automobilių garaže skaičius</label>
          <input type="number" min={0} max={10} value={pu.garazasAutoSk || ''} onChange={e => set('garazasAutoSk', parseInt(e.target.value) || 0)}
            className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0" />
        </div>
        <PURadio label="Garažo sprendimas" value={pu.garazasSprendimas} onChange={v => set('garazasSprendimas', v as any)}
          options={[{ value: 'integruotas', label: 'Integruotas' }, { value: 'atskiras', label: 'Atskiras' }, { value: 'stogine', label: 'Stoginė' }, { value: 'projektuojant', label: 'Sprendžiama proj. metu' }]} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Kitos patalpos</label>
          <input value={pu.kitosPatalpos} onChange={e => set('kitosPatalpos', e.target.value)}
            placeholder="pvz. Svečių kambarys, sporto kambarys..." className={inp} />
        </div>
      </div>

      {/* Section 6 */}
      <div className={section}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">6. Architektūriniai pasirinkimai</h3>
        <PURadio label="Pastato charakteris" value={pu.pastatoCharakteris} onChange={v => set('pastatoCharakteris', v as any)}
          options={[{ value: 'siuolaikinis', label: 'Šiuolaikinis' }, { value: 'tradicinis', label: 'Tradicinis' }, { value: 'kita', label: 'Kita' }]} />
        {pu.pastatoCharakteris === 'kita' && (
          <input value={pu.pastatoCharakterisKita} onChange={e => set('pastatoCharakterisKita', e.target.value)} placeholder="Apibūdinti stilių" className={inp} />
        )}
        <PURadio label="Stogo tipas" value={pu.stogasTipas} onChange={v => set('stogasTipas', v as any)}
          options={[{ value: 'slaitinis', label: 'Šlaitinis' }, { value: 'plokscias', label: 'Plokščias' }, { value: 'kombinuotas', label: 'Kombinuotas' }]} />
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Fasadų apdaila (galimi keli)</p>
          <div className="flex flex-wrap gap-2">
            {[{ value: 'tinkas', label: 'Tinkas' }, { value: 'medis', label: 'Medis / lentelės' }, { value: 'klinkeris', label: 'Klinkeris' }, { value: 'kita', label: 'Kita' }].map(o => (
              <button key={o.value} type="button" onClick={() => toggleFasadas(o.value)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  pu.fasadai.includes(o.value) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          {pu.fasadai.includes('kita') && (
            <input value={pu.fasadaiKita} onChange={e => set('fasadaiKita', e.target.value)}
              placeholder="Nurodyti medžiagą" className={`mt-2 ${inp}`} />
          )}
        </div>
      </div>
    </div>
  );
}
