'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useProjects } from '@/lib/useProjects';
import { STAGES, calcStageDates, formatDate, TEAM_MEMBERS } from '@/lib/defaultData';
import { Project, StageId, TeamMemberId } from '@/lib/types';

function getActiveStageIds(project: Project) {
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

function stageLabels(project: Project) {
  const active = project.activeStages ?? ['SR'];
  return STAGES.filter(s => active.includes(s.id));
}

function missingDocCount(project: Project) {
  return project.dokumentai.filter(d => !d.received).length;
}

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function endOfWeek(d: Date) {
  const mon = startOfWeek(d);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

type Alert = {
  projectId: string;
  projectName: string;
  stageShortName: string;
  stageColorClass: string;
  stageBgClass: string;
  stageTextClass: string;
  endDate: string;
  daysLeft: number;
  kind: 'overdue' | 'today' | 'week' | 'next2weeks';
};

function buildAlerts(projects: Project[]): Alert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = endOfWeek(today);
  const twoWeeksEnd = new Date(today);
  twoWeeksEnd.setDate(today.getDate() + 14);

  const alerts: Alert[] = [];

  for (const project of projects) {
    const parts = project.selectedParts;
    const planned = calcStageDates(project.startDate, parts);
    const activeIds = project.activeStages ?? ['SR'];

    for (const stageId of activeIds) {
      const stageDates = planned[stageId as StageId];
      if (!stageDates?.endDate) continue;
      const end = new Date(stageDates.endDate);
      end.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const stageInfo = STAGES.find(s => s.id === stageId);
      if (!stageInfo) continue;

      let kind: Alert['kind'] | null = null;
      if (daysLeft < 0) kind = 'overdue';
      else if (daysLeft === 0) kind = 'today';
      else if (end <= weekEnd) kind = 'week';
      else if (end <= twoWeeksEnd) kind = 'next2weeks';

      if (kind) {
        alerts.push({
          projectId: project.id,
          projectName: project.name,
          stageShortName: stageInfo.shortName,
          stageColorClass: stageInfo.colorClass,
          stageBgClass: stageInfo.bgClass,
          stageTextClass: stageInfo.textClass,
          endDate: stageDates.endDate,
          daysLeft,
          kind,
        });
      }
    }
  }

  // Sort: overdue first, then by daysLeft asc
  return alerts.sort((a, b) => {
    const order = { overdue: 0, today: 1, week: 2, next2weeks: 3 };
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    return a.daysLeft - b.daysLeft;
  });
}

const STAGE_HEX: Record<string, string> = {
  SR: '#3b82f6',
  PP: '#a855f7',
  'PP Viešinimas': '#f97316',
  'Išankst. pritarimai': '#eab308',
  SLD: '#14b8a6',
  'Pakartotinis': '#2dd4bf',
  TDP: '#6366f1',
  Ekspertizė: '#ef4444',
};

function SoonDonut({ soon }: { soon: Alert[] }) {
  const r = 58;
  const cx = 80, cy = 80;
  const strokeW = 20;
  const circ = 2 * Math.PI * r;
  const total = soon.length;

  // Group by stage short name
  const groups: { label: string; count: number; color: string }[] = [];
  const seen: Record<string, number> = {};
  for (const a of soon) {
    const key = a.stageShortName;
    if (seen[key] === undefined) {
      seen[key] = groups.length;
      groups.push({ label: key, count: 0, color: STAGE_HEX[key] ?? '#94a3b8' });
    }
    groups[seen[key]].count++;
  }

  // Pre-compute segments: each segment rotated by its cumulative angle
  let cumAngle = -90; // start at top
  const segments = groups.map(g => {
    const angle = (g.count / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...g, angle, startAngle };
  });

  // Arc path helper
  function arcPath(startDeg: number, endDeg: number, radius: number, cxp: number, cyp: number) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x1 = cxp + radius * Math.cos(toRad(startDeg));
    const y1 = cyp + radius * Math.sin(toRad(startDeg));
    const x2 = cxp + radius * Math.cos(toRad(endDeg));
    const y2 = cyp + radius * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
          {segments.map((g, i) => (
            <path key={i}
              d={arcPath(g.startAngle, g.startAngle + g.angle - 0.5, r, cx, cy)}
              fill="none" stroke={g.color} strokeWidth={strokeW} strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-slate-400">etapų</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        {groups.map((g, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
              <span className="text-slate-600">{g.label}</span>
            </div>
            <span className="font-semibold text-slate-800">{g.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { projects, loaded, toggleStage } = useProjects();
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<TeamMemberId | null>(null);
  const [stageFilter, setStageFilter] = useState<StageId | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  if (!loaded) return null;

  const activeProjects = projects.filter(p => (p.activeStages ?? ['SR']).length > 0);
  const finishedProjects = projects.filter(p => (p.activeStages ?? ['SR']).length === 0);

  const alerts = buildAlerts(activeProjects);
  const overdue = alerts.filter(a => a.kind === 'overdue');
  const today = alerts.filter(a => a.kind === 'today');
  const thisWeek = alerts.filter(a => a.kind === 'week');
  const soon = alerts.filter(a => a.kind === 'next2weeks');
  const overdueProjectIds = new Set(overdue.map(a => a.projectId));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Projektai</h1>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-400 text-sm mb-4">Nėra projektų</p>
          <Link href="/projects/new" className="bg-slate-900 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-slate-700 transition-colors">
            + Pridėti pirmą projektą
          </Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-3xl font-bold text-slate-900">{activeProjects.length}</div>
              <div className="text-sm text-slate-500 mt-1">Aktyvūs projektai</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className={`text-3xl font-bold ${overdueProjectIds.size > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueProjectIds.size}</div>
              <div className="text-sm text-slate-500 mt-1">Vėluojantys projektai</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className={`text-3xl font-bold ${activeProjects.filter(p => missingDocCount(p) > 0).length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {activeProjects.filter(p => missingDocCount(p) > 0).length}
              </div>
              <div className="text-sm text-slate-500 mt-1">Projektų trūksta dok.</div>
            </div>
          </div>

          {/* Search + member filter */}
          <div className="flex gap-3 mb-3 items-center">
            <input
              type="text"
              placeholder="Ieškoti pagal pavadinimą, adresą ar užsakovą..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 bg-white"
            />
            <div className="flex gap-1.5 shrink-0">
              {TEAM_MEMBERS.filter(m => m.id !== 'EXT').map(m => (
                <button
                  key={m.id}
                  onClick={() => setMemberFilter(memberFilter === m.id ? null : m.id)}
                  title={m.name}
                  className={`text-xs font-semibold w-8 h-8 rounded-full transition-all ${
                    memberFilter === m.id ? `${m.color} ${m.textColor} ring-2 ring-offset-1 ring-current` : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {m.initials}
                </button>
              ))}
            </div>
          </div>

          {/* Stage filter */}
          <div className="flex gap-1.5 flex-wrap mb-6">
            {STAGES.map(s => (
              <button
                key={s.id}
                onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${s.bgClass} ${s.textClass} ${
                  stageFilter === s.id
                    ? `ring-2 ring-offset-1 ${s.colorClass} opacity-100`
                    : 'opacity-50 hover:opacity-80'
                }`}
              >
                {s.shortName}
              </button>
            ))}
          </div>

          {/* Work overview */}
          {(overdue.length > 0 || today.length > 0 || thisWeek.length > 0 || soon.length > 0) && (
            <div className="mb-8">
              <button
                onClick={() => setShowOverview(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 hover:text-slate-700 transition-colors"
              >
                <span className={`transition-transform inline-block ${showOverview ? 'rotate-90' : ''}`}>›</span>
                Darbų apžvalga
                {overdue.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 normal-case tracking-normal">{overdue.length} vėluoja</span>}
                {thisWeek.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 normal-case tracking-normal">{thisWeek.length} šią sav.</span>}
              </button>
              {showOverview && (
                <div className="space-y-4">
                  {overdue.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">
                        Vėluoja — {overdue.length} etap{overdue.length === 1 ? 'as' : 'ai'}
                      </p>
                      <div className="space-y-2">
                        {overdue.map((a, i) => (
                          <Link key={i} href={`/projects/${a.projectId}`} className="flex items-center justify-between hover:opacity-80 transition-opacity">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${a.stageBgClass} ${a.stageTextClass}`}>{a.stageShortName}</span>
                              <span className="text-sm text-slate-800 truncate">{a.projectName}</span>
                            </div>
                            <span className="text-xs text-red-500 font-medium shrink-0 ml-3">{Math.abs(a.daysLeft)} d. vėluoja</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {thisWeek.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">
                        Ši savaitė — {thisWeek.length} etap{thisWeek.length === 1 ? 'as' : 'ai'}
                      </p>
                      <div className="space-y-2">
                        {thisWeek.map((a, i) => (
                          <Link key={i} href={`/projects/${a.projectId}`} className="flex items-center justify-between hover:opacity-80 transition-opacity">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${a.stageBgClass} ${a.stageTextClass}`}>{a.stageShortName}</span>
                              <span className="text-sm text-slate-800 truncate">{a.projectName}</span>
                            </div>
                            <span className="text-xs text-amber-600 font-medium shrink-0 ml-3">{a.daysLeft} d. · {formatDate(a.endDate)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {(today.length > 0 || soon.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          Šiandien{today.length > 0 ? ` — ${today.length}` : ''}
                        </p>
                        {today.length === 0 ? (
                          <p className="text-xs text-slate-400">Nieko šiandien</p>
                        ) : (
                          <div className="space-y-2">
                            {today.map((a, i) => (
                              <Link key={i} href={`/projects/${a.projectId}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${a.stageBgClass} ${a.stageTextClass}`}>{a.stageShortName}</span>
                                <span className="text-sm text-slate-800 truncate">{a.projectName}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                          Ateinančios 2 sav.
                        </p>
                        {soon.length === 0 ? (
                          <p className="text-xs text-slate-400">Nieko artimiausiomis savaitėmis</p>
                        ) : (
                          <SoonDonut soon={soon} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Project cards */}
          <div className="grid gap-4">
            {activeProjects.filter(p => {
              if (search.trim()) {
                const q = search.toLowerCase();
                if (!p.name.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q) && !p.client.toLowerCase().includes(q)) return false;
              }
              if (memberFilter) {
                const assignees = p.stageAssignees ?? {};
                const activeIds = p.activeStages ?? ['SR'];
                const hasMatch = activeIds.some(sid => (assignees[sid as StageId] ?? []).includes(memberFilter));
                if (!hasMatch) return false;
              }
              if (stageFilter) {
                const activeIds = p.activeStages ?? ['SR'];
                if (!activeIds.includes(stageFilter)) return false;
              }
              return true;
            }).map(project => {
              const stages = stageLabels(project);
              const progress = progressPercent(project);
              const missingDocs = missingDocCount(project);
              const currentStageIds = project.activeStages ?? ['SR'];
              const availableStageIds = getActiveStageIds(project);
              const availableStages = STAGES.filter(s => availableStageIds.includes(s.id));
              const minActiveIdx = Math.min(...currentStageIds.map(s => STAGES.findIndex(st => st.id === s)).filter(i => i >= 0));
              return (
                <div key={project.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                  <Link href={`/projects/${project.id}`} className="block p-5 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-900 truncate">{project.name}</h2>
                        <p className="text-sm text-slate-500 mt-0.5 truncate">{project.address}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{project.client}</p>
                      </div>
                      <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                        {stages.map(stage => (
                          <span key={stage.id} className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${stage.bgClass} ${stage.textClass}`}>
                            {stage.shortName}
                          </span>
                        ))}
                        {missingDocs > 0 && (
                          <p className="text-xs text-amber-600 mt-1">{missingDocs} dok. trūksta</p>
                        )}
                      </div>
                    </div>

                    {/* Stage progress bar */}
                    <div className="mt-4 flex gap-1">
                      {STAGES.map((s, i) => {
                        const isPast = i < minActiveIdx;
                        const isCurrent = currentStageIds.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            title={s.shortName}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              isPast ? 'bg-slate-400' : isCurrent ? 'bg-slate-900' : 'bg-slate-100'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-400">
                      <span>Pradžia: {project.startDate}</span>
                      <span>Tikslas: {project.targetConstructionDate}</span>
                    </div>

                    {/* Checklist progress */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1">
                        <div className="bg-green-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{progress}% atlikta</span>
                    </div>
                  </Link>

                  {/* Quick stage toggles */}
                  <div className="px-5 pb-4 flex gap-1.5 flex-wrap border-t border-slate-100 pt-3">
                    {availableStages.map(s => {
                      const isOn = currentStageIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={e => { e.stopPropagation(); toggleStage(project.id, s.id); }}
                          title={isOn ? `Išjungti: ${s.shortName}` : `Įjungti: ${s.shortName}`}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                            isOn
                              ? `${s.bgClass} ${s.textClass} border-transparent`
                              : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {s.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Finished projects */}
          {finishedProjects.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowFinished(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 hover:text-slate-700 transition-colors"
              >
                <span className={`transition-transform ${showFinished ? 'rotate-90' : ''}`}>›</span>
                Baigti projektai ({finishedProjects.length})
              </button>
              {showFinished && (
                <div className="grid gap-3">
                  {finishedProjects.filter(p => {
                    if (search.trim()) {
                      const q = search.toLowerCase();
                      return p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.client.toLowerCase().includes(q);
                    }
                    return true;
                  }).map(project => {
                    const progress = progressPercent(project);
                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="bg-slate-50 rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all block opacity-75 hover:opacity-100"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h2 className="font-semibold text-slate-700 truncate">{project.name}</h2>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Baigtas</span>
                            </div>
                            <p className="text-sm text-slate-400 mt-0.5 truncate">{project.address}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{project.client}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="flex-1 flex items-center gap-2 mt-1">
                              <div className="w-20 bg-slate-200 rounded-full h-1">
                                <div className="bg-green-500 h-1 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-slate-400">{progress}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-1">
                          {STAGES.map(s => (
                            <div key={s.id} title={s.shortName} className="h-1.5 flex-1 rounded-full bg-slate-400" />
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-400">
                          <span>Pradžia: {project.startDate}</span>
                          <span>Tikslas: {project.targetConstructionDate}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
