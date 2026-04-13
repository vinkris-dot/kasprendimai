'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { STAGES, formatDate, calcStageDates, calcEffectiveStageDates } from '@/lib/defaultData';
import { StageId } from '@/lib/types';

function getActiveStageIds(selectedParts: import('@/lib/types').SelectedParts): StageId[] {
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

// Client-friendly stage names
const STAGE_CLIENT_NAMES: Partial<Record<StageId, string>> = {
  SR: 'Parengiamasis etapas',
  PP: 'Projektiniai pasiūlymai',
  PP_VIESIMAS: 'Viešinimas ir derinimas',
  IP: 'Išankstiniai pritarimai',
  SLD: 'Statybos leidimas',
  PAKARTOTINIS: 'Pakartotinis derinimas',
  TDP: 'Techninis darbo projektas',
  EKSPERTIZE: 'Projekto ekspertizė',
};

// Short client-friendly descriptions
const STAGE_CLIENT_DESC: Partial<Record<StageId, string>> = {
  SR: 'Renkamos sąlygos, užsakomi dokumentai',
  PP: 'Rengiamos architektūrinės koncepcijos, derinamos su Jumis',
  PP_VIESIMAS: 'Projektas svarstomas viešai, gauname savivaldybės patvirtinimą',
  IP: 'Gaunami reikalingų institucijų pritarimai',
  SLD: 'Pateikiama dokumentacija statybos leidimui gauti',
  PAKARTOTINIS: 'Papildomas derinimo ratas pagal pastabas',
  TDP: 'Rengiamas detalus vykdymo projektas',
  EKSPERTIZE: 'Nepriklausoma projekto patikra',
};

export default function KlientasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { projects, loaded } = useProjects();

  useEffect(() => {
    if (loaded) {
      setTimeout(() => window.print(), 400);
    }
  }, [loaded]);

  if (!loaded) return null;

  const project = projects.find(p => p.id === id);
  if (!project) {
    return (
      <div className="p-8 text-center">
        <p>Projektas nerastas.</p>
        <Link href="/" className="underline">← Grįžti</Link>
      </div>
    );
  }

  const selectedParts = project.selectedParts;
  const activeStageIds = getActiveStageIds(selectedParts);
  const activeStages = STAGES.filter(s => activeStageIds.includes(s.id));
  const currentStages = project.activeStages ?? ['SR'];
  const completedStages = project.completedStages ?? [];
  const plannedDates = calcStageDates(project.startDate, selectedParts);
  const effectiveDates = calcEffectiveStageDates(project.startDate, selectedParts, project.stageStatuses ?? {});

  const today = new Date().toISOString().slice(0, 10);

  // Find "current" stage to highlight
  const currentStageName = currentStages.length > 0
    ? currentStages.map(sid => STAGE_CLIENT_NAMES[sid as StageId] ?? sid).join(', ')
    : null;

  // Effective target date
  const stageOrder: StageId[] = ['SR', 'PP', 'PP_VIESIMAS', 'IP', 'SLD', 'TDP', 'PAKARTOTINIS', 'EKSPERTIZE'];
  const effectiveTarget = (() => {
    for (let i = stageOrder.length - 1; i >= 0; i--) {
      const sid = stageOrder[i];
      const d = effectiveDates[sid];
      if (d) return d.endDate;
    }
    return project.targetConstructionDate;
  })();

  // Compute progress % — exclude PAKARTOTINIS (sub-stage of SLD, shouldn't inflate total)
  const progressStageIds = activeStageIds.filter(s => s !== 'PAKARTOTINIS');
  const minActiveIdx = Math.min(...currentStages.map(s => progressStageIds.indexOf(s as StageId)).filter(i => i >= 0));
  const inferredDone = progressStageIds.filter((sid, idx) =>
    idx < minActiveIdx || completedStages.includes(sid)
  );
  const totalStages = progressStageIds.length;
  const progressPct = totalStages > 0 ? Math.round((inferredDone.length / totalStages) * 100) : 0;

  return (
    <div className="bg-white min-h-screen">
      {/* Screen-only nav */}
      <div className="print:hidden flex items-center gap-4 px-8 py-4 border-b border-slate-200 bg-slate-50">
        <Link href={`/projects/${project.id}`} className="text-sm text-slate-600 hover:text-slate-900">← Grįžti į projektą</Link>
        <button
          onClick={() => window.print()}
          className="ml-auto bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700"
        >
          Spausdinti / Išsaugoti PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-12 text-slate-900">

        {/* Firm header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">MB „KA sprendimai"</p>
            <h1 className="text-3xl font-bold text-slate-900 leading-tight">{project.name}</h1>
            {project.address && project.address !== project.name && (
              <p className="text-slate-500 mt-1">{project.address}</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="text-xs text-slate-400">Ataskaitos data</p>
            <p className="font-semibold text-slate-700">{formatDate(today)}</p>
          </div>
        </div>

        {/* Client info box */}
        <div className="bg-slate-50 rounded-2xl p-5 mb-8 flex gap-8">
          {project.client && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Užsakovas</p>
              <p className="font-semibold text-slate-800">{project.client}</p>
              {project.clientEmail && <p className="text-sm text-slate-500">{project.clientEmail}</p>}
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Projekto pradžia</p>
            <p className="font-semibold text-slate-800">{formatDate(project.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Planuojama statybos pradžia</p>
            <p className="font-bold text-slate-900">{formatDate(effectiveTarget)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Projekto vykdymas</p>
            <p className="text-sm font-bold text-slate-900">{progressPct}%</p>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {currentStageName && (
            <p className="text-xs text-slate-500 mt-1.5">
              Šiuo metu: <span className="font-medium text-slate-700">{currentStageName}</span>
            </p>
          )}
        </div>

        {/* Stage timeline */}
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Projekto etapai</h2>
          <div className="space-y-0">
            {activeStages.filter(s => s.id !== 'PAKARTOTINIS').map((stage, idx, arr) => {
              const isDone = inferredDone.includes(stage.id as StageId);
              const isActive = currentStages.includes(stage.id);
              const planned = plannedDates[stage.id];
              const effective = effectiveDates[stage.id];
              const displayDates = effective ?? planned;
              const isLast = idx === arr.length - 1;
              const mainNumber = idx + 1;

              // Pakartotinis sub-stages (shown nested under SLD)
              const showPakartotinis = stage.id === 'SLD' && activeStageIds.includes('PAKARTOTINIS');
              const pakIsDone = completedStages.includes('PAKARTOTINIS');
              const pakIsActive = currentStages.includes('PAKARTOTINIS');
              const completedRounds = project.pakartotinisRounds ?? 0;
              const rounds = completedRounds + (pakIsActive && completedRounds > 0 ? 1 : 0);
              const pakPlanned = plannedDates['PAKARTOTINIS'];
              const pakEffective = effectiveDates['PAKARTOTINIS'];
              const pakDates = pakEffective ?? pakPlanned;

              return (
                <div key={stage.id}>
                  <div className="flex gap-4">
                    {/* Timeline column */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        isDone
                          ? 'bg-slate-800 border-slate-800 text-white'
                          : isActive
                          ? 'bg-white border-slate-800 text-slate-800'
                          : 'bg-white border-slate-200 text-slate-300'
                      }`}>
                        {isDone ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-xs font-bold">{mainNumber}</span>
                        )}
                      </div>
                      {(!isLast || showPakartotinis) && (
                        <div className={`w-0.5 flex-1 my-1 ${isDone ? 'bg-slate-800' : 'bg-slate-200'}`} style={{ minHeight: '20px' }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`${showPakartotinis ? 'pb-2' : 'pb-5'} flex-1 min-w-0`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className={`font-semibold text-sm leading-tight ${
                            isDone ? 'text-slate-500 line-through' : isActive ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {STAGE_CLIENT_NAMES[stage.id] ?? stage.name}
                          </p>
                          {STAGE_CLIENT_DESC[stage.id] && !isDone && (
                            <p className={`text-xs mt-0.5 ${isActive ? 'text-slate-500' : 'text-slate-300'}`}>
                              {STAGE_CLIENT_DESC[stage.id]}
                            </p>
                          )}
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Vykdoma
                            </span>
                          )}
                        </div>
                        {displayDates && (
                          <div className="text-right shrink-0">
                            {isDone ? (
                              <p className="text-xs text-slate-400">Baigta {formatDate(displayDates.endDate)}</p>
                            ) : (
                              <>
                                <p className="text-xs text-slate-400">{formatDate(displayDates.startDate)}</p>
                                <p className="text-xs text-slate-400">– {formatDate(displayDates.endDate)}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pakartotinis nested under SLD */}
                  {showPakartotinis && (
                    <div className="flex gap-4 ml-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 text-[10px] font-bold ${
                          pakIsDone
                            ? 'bg-slate-600 border-slate-600 text-white'
                            : pakIsActive
                            ? 'bg-white border-slate-600 text-slate-600'
                            : 'bg-white border-slate-200 text-slate-300'
                        }`}>
                          {pakIsDone ? '✓' : '↺'}
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 flex-1 my-1 ${pakIsDone ? 'bg-slate-600' : 'bg-slate-200'}`} style={{ minHeight: '20px' }} />
                        )}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm leading-tight ${
                              pakIsDone ? 'text-slate-400 line-through' : pakIsActive ? 'text-slate-700 font-medium' : 'text-slate-300'
                            }`}>
                              Pakartotinis derinimas{rounds > 1 ? ` (${rounds} ratai)` : rounds === 1 ? ' (1 ratas)' : ''}
                            </p>
                            {!pakIsDone && (
                              <p className={`text-xs mt-0.5 ${pakIsActive ? 'text-slate-500' : 'text-slate-300'}`}>
                                Papildomas derinimo ratas pagal pastabas
                              </p>
                            )}
                            {pakIsActive && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full mt-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Vykdoma
                              </span>
                            )}
                          </div>
                          {pakDates && pakIsDone && (
                            <p className="text-xs text-slate-400 shrink-0">Baigta {formatDate(pakDates.endDate)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes (if any, trimmed) */}
        {project.notes && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1.5">Pastabos</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{project.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 pt-6 flex items-end justify-between text-xs text-slate-400">
          <div>
            <p className="font-semibold text-slate-600 mb-0.5">MB „KA sprendimai"</p>
            <p>Architekto ataskaita · {formatDate(today)}</p>
          </div>
          <div className="text-right">
            <p>Projektas: {project.name}</p>
            {project.client && <p>Užsakovas: {project.client}</p>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 portrait; }
          body { font-size: 11px; }
          .animate-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
