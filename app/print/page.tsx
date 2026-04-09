'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { STAGES, formatDate, calcStageDates } from '@/lib/defaultData';
import { Project, StageId } from '@/lib/types';

function getActiveStageIds(project: Project): StageId[] {
  const sp = project.selectedParts;
  const ids: StageId[] = ['SR'];
  if (sp.PP) ids.push('PP');
  if (sp.VIESIMAS) ids.push('PP_VIESIMAS');
  if (sp.IP) ids.push('IP');
  if (sp.SLD) ids.push('SLD');
  if (sp.PAKARTOTINIS) ids.push('PAKARTOTINIS');
  if (sp.TDP) ids.push('TDP');
  if (sp.EKSPERTIZE) ids.push('EKSPERTIZE');
  return ids;
}

function progressPercent(project: Project) {
  const total = project.ppByla.length + project.dokumentai.length;
  const done = project.ppByla.filter(i => i.done).length + project.dokumentai.filter(d => d.received).length;
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export default function PrintAllPage() {
  const { projects, loaded } = useProjects();

  useEffect(() => {
    if (loaded) setTimeout(() => window.print(), 400);
  }, [loaded]);

  if (!loaded) return null;

  const active = projects.filter(p => (p.activeStages ?? ['SR']).length > 0);

  return (
    <div className="bg-white min-h-screen">
      {/* Screen-only nav */}
      <div className="print:hidden flex items-center gap-4 px-8 py-4 border-b border-slate-200 bg-slate-50">
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">← Grįžti</Link>
        <button onClick={() => window.print()} className="ml-auto bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700">
          Spausdinti / Išsaugoti PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10 text-slate-900">
        <div className="flex items-baseline justify-between mb-8 border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold">KA sprendimai — Projektų sąrašas</h1>
          <p className="text-sm text-slate-400">{formatDate(new Date().toISOString().slice(0, 10))}</p>
        </div>

        {active.length === 0 && (
          <p className="text-slate-400">Nėra aktyvių projektų.</p>
        )}

        {active.map((project, idx) => {
          const activeStageIds = getActiveStageIds(project);
          const activeStages = STAGES.filter(s => activeStageIds.includes(s.id));
          const currentStages = project.activeStages ?? ['SR'];
          const completedStages = project.completedStages ?? [];
          const plannedDates = calcStageDates(project.startDate, project.selectedParts);
          const progress = progressPercent(project);
          const missingDocs = project.dokumentai.filter(d => !d.received).length;
          const docsDone = project.dokumentai.filter(d => d.received).length;
          const ppDone = project.ppByla.filter(i => i.done).length;

          return (
            <div key={project.id} className={`mb-10 ${idx < active.length - 1 ? 'pb-10 border-b border-slate-200' : ''}`}>
              {/* Project header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold">{project.name}</h2>
                  {project.address && project.address !== project.name && (
                    <p className="text-sm text-slate-500">{project.address}</p>
                  )}
                  {project.client && project.client !== project.name && (
                    <p className="text-xs text-slate-400">{project.client}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-500">Pradžia: <strong>{formatDate(project.startDate)}</strong></p>
                  <p className="text-slate-500">Tikslas: <strong>{formatDate(project.targetConstructionDate)}</strong></p>
                  <p className="text-slate-400 text-xs mt-0.5">Pažanga: {progress}%</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 text-xs text-slate-500 mb-3">
                <span>Dokumentai: <strong className={missingDocs > 0 ? 'text-amber-600' : 'text-green-600'}>{docsDone}/{project.dokumentai.length}</strong></span>
                <span>PP byla: <strong>{ppDone}/{project.ppByla.length}</strong></span>
                {missingDocs > 0 && <span className="text-amber-600">Trūksta {missingDocs} dok.</span>}
              </div>

              {/* Stages table */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1 font-semibold text-slate-600 w-36">Etapas</th>
                    <th className="text-left py-1 font-semibold text-slate-600">Pradžia (planas)</th>
                    <th className="text-left py-1 font-semibold text-slate-600">Pabaiga (planas)</th>
                    <th className="text-left py-1 font-semibold text-slate-600">Faktas</th>
                    <th className="text-center py-1 font-semibold text-slate-600 w-16">Būsena</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStages.map(s => {
                    const planned = plannedDates[s.id];
                    const status = project.stageStatuses?.[s.id];
                    const isActive = currentStages.includes(s.id);
                    const isDone = completedStages.includes(s.id);
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-1 font-medium">{s.name}</td>
                        <td className="py-1 text-slate-500">{planned ? formatDate(planned.startDate) : '—'}</td>
                        <td className="py-1 text-slate-500">{planned ? formatDate(planned.endDate) : '—'}</td>
                        <td className="py-1 text-slate-500">
                          {status?.startDate ? `${formatDate(status.startDate)}${status.endDate ? ` – ${formatDate(status.endDate)}` : ''}` : '—'}
                        </td>
                        <td className="py-1 text-center">{isDone ? '✓' : isActive ? '▶' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Notes */}
              {project.notes && (
                <p className="mt-2 text-xs text-slate-500 italic">{project.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { font-size: 10px; }
        }
      `}</style>
    </div>
  );
}
