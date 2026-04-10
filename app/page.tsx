'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/useProjects';
import { STAGES, calcStageDates, formatDate, TEAM_MEMBERS } from '@/lib/defaultData';
import { Project, StageId, TeamMemberId } from '@/lib/types';
import TasksSidebar from '@/app/components/TasksSidebar';
import { useNotifications } from '@/lib/useNotifications';

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

type SmartAction = {
  priority: 'urgent' | 'do' | 'soon';
  text: string;
  sub?: string;
  taskKey: string;
  checkable: boolean;
};

type SmartPlan = {
  chain: SmartAction[];    // sequential — each unlocks the next
  parallel: SmartAction[]; // can be done simultaneously
};

function getSmartPlan(project: Project): SmartPlan {
  const doc = (id: string) => project.dokumentai.find(d => d.id === id);
  const ts = project.taskStatuses ?? {};

  const d00 = doc('doc-00');
  const d02 = doc('doc-02');
  const d03 = doc('doc-03');
  const d04 = doc('doc-04');
  const d05 = doc('doc-05');
  const d06 = doc('doc-06');
  const d07 = doc('doc-07');

  const has02 = d02?.received ?? false;
  const has03 = d03?.received ?? false;

  const chain: SmartAction[] = [];
  const parallel: SmartAction[] = [];

  // Chain: 02+03 → įgaliojimas 00
  if (!has02 || !has03) {
    const missing = [!has02 && '02 nuosavybė', !has03 && '03 sklypo ribų planas'].filter(Boolean).join(', ');
    chain.push({ priority: 'urgent', text: 'Gauti pagrindinius dokumentus', sub: missing, taskKey: 'get-02-03', checkable: false });
  }
  if (!(d00?.received) && !ts['order-00']?.doneAt) {
    chain.push({ priority: 'do', text: 'Parengti įgaliojimą (00)', sub: has02 && has03 ? '02 ir 03 gauta ✓' : 'laukia 02 ir 03', taskKey: 'order-00', checkable: has02 && has03 });
  }

  // Parallel: can order independently
  if (!(d07?.received) && !ts['order-07']?.doneAt) {
    parallel.push({ priority: 'do', text: 'Toponuotrauka (07)', taskKey: 'order-07', checkable: true });
  }
  if (!(d04?.received) && !ts['order-04']?.doneAt) {
    parallel.push({ priority: 'do', text: 'Teritorijų planavimo ištrauka (04)', taskKey: 'order-04', checkable: true });
  }
  if (d06) {
    const dates = d06.connectionDates ?? {};
    const missing = [
      !dates.vanduo && 'vanduo/nuotekos',
      !dates.lietus && 'lietus',
      !dates.kelias && 'kelias',
      !dates.elektra && 'elektra',
      !dates.rysiai && 'ryšiai',
      !dates.dujos && 'dujos',
    ].filter(Boolean) as string[];
    if (missing.length > 0 && !ts['order-06']?.doneAt) {
      parallel.push({ priority: 'do', text: 'Prisijungimo sąlygos (06)', sub: missing.join(', '), taskKey: 'order-06', checkable: true });
    }
  }
  if (!(d05?.received) && !ts['order-05']?.doneAt) {
    parallel.push({ priority: 'soon', text: 'SR (05)', taskKey: 'order-05', checkable: true });
  }

  return { chain, parallel };
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
    if (project.paused) continue;
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
  const router = useRouter();
  const { projects, loaded, toggleStage, updateProject, toggleDocument, copyProject } = useProjects();
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<TeamMemberId | null>(null);
  const [stageFilter, setStageFilter] = useState<StageId | null>(null);
  const [sortBy, setSortBy] = useState<'deadline' | 'name' | 'stage'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('ka_sort') as 'deadline' | 'name' | 'stage') ?? 'deadline';
    return 'deadline';
  });
  const [showFinished, setShowFinished] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [taskSidebarOpen, setTaskSidebarOpen] = useState(false);
  const [expandedDocsId, setExpandedDocsId] = useState<string | null>(null);
  const [expandedTasksId, setExpandedTasksId] = useState<string | null>(null);
  const [copyConfirmId, setCopyConfirmId] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [pauseModal, setPauseModal] = useState<{ projectId: string; reason: string; until: string } | null>(null);

  useNotifications(projects, loaded);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  async function handleNotifClick() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      // Force send today's notification by clearing the stored date
      localStorage.removeItem('ka_last_notified');
      // Reload to trigger the hook again
      window.location.reload();
    }
  }

  if (!loaded) return null;

  const activeProjects = projects.filter(p => !p.archived && !p.paused && (p.activeStages ?? ['SR']).length > 0);
  const pausedProjects = projects.filter(p => !p.archived && p.paused);
  const finishedProjects = projects.filter(p => !p.archived && !p.paused && (p.activeStages ?? ['SR']).length === 0);
  const archivedProjects = projects.filter(p => p.archived);

  const alerts = buildAlerts(activeProjects);
  const overdue = alerts.filter(a => a.kind === 'overdue');
  const today = alerts.filter(a => a.kind === 'today');
  const thisWeek = alerts.filter(a => a.kind === 'week');
  const soon = alerts.filter(a => a.kind === 'next2weeks');
  const overdueProjectIds = new Set(overdue.map(a => a.projectId));

  function sortProjects(list: Project[]) {
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'lt');
      if (sortBy === 'stage') {
        const stageOrder = (p: Project) => Math.min(...(p.activeStages ?? ['SR']).map(s => STAGES.findIndex(st => st.id === s)));
        return stageOrder(a) - stageOrder(b);
      }
      // deadline: overdue first, then by targetConstructionDate asc
      const aOver = overdueProjectIds.has(a.id) ? 0 : 1;
      const bOver = overdueProjectIds.has(b.id) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return new Date(a.targetConstructionDate).getTime() - new Date(b.targetConstructionDate).getTime();
    });
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Projektai</h1>
        <div className="flex items-center gap-4">
        <Link href="/savane" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
          Savaitė
        </Link>
        <Link href="/print" target="_blank" className="text-sm text-slate-400 hover:text-slate-700 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Spausdinti sąrašą
        </Link>
        {notifPermission !== null && (
          <button
            onClick={handleNotifClick}
            title={
              notifPermission === 'granted' ? 'Pranešimai įjungti' :
              notifPermission === 'denied' ? 'Pranešimai užblokuoti naršyklėje' :
              'Įjungti pranešimus'
            }
            className={`text-slate-400 hover:text-slate-700 transition-colors ${notifPermission === 'denied' ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            {notifPermission === 'granted' ? (
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            ) : notifPermission === 'denied' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            )}
          </button>
        )}
        </div>
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

          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Ieškoti pagal pavadinimą, adresą ar užsakovą..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 bg-white"
            />
          </div>

          {/* Stage filter + member filter + sort — one compact row */}
          <div className="flex flex-wrap gap-1.5 items-center mb-6">
            {STAGES.map(s => (
              <button
                key={s.id}
                onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${s.bgClass} ${s.textClass} ${
                  stageFilter === s.id ? `ring-2 ring-offset-1 ${s.colorClass} opacity-100` : 'opacity-50 hover:opacity-80'
                }`}
              >
                {s.shortName}
              </button>
            ))}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            {TEAM_MEMBERS.filter(m => m.id !== 'EXT').map(m => (
              <button
                key={m.id}
                onClick={() => setMemberFilter(memberFilter === m.id ? null : m.id)}
                title={m.name}
                className={`text-xs font-semibold w-7 h-7 rounded-full transition-all ${
                  memberFilter === m.id ? `${m.color} ${m.textColor} ring-2 ring-offset-1 ring-current` : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                {m.initials}
              </button>
            ))}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            {([['deadline', '⚠ Vėluojantys'], ['name', 'A–Z'], ['stage', 'Etapas']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setSortBy(val); localStorage.setItem('ka_sort', val); }}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  sortBy === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {label}
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
            {sortProjects(activeProjects).filter(p => {
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
              const smartPlan = getSmartPlan(project);
              const isOverdue = overdueProjectIds.has(project.id);
              const daysToTarget = Math.ceil((new Date(project.targetConstructionDate).getTime() - Date.now()) / 86400000);
              const healthColor = isOverdue ? 'bg-red-500' : daysToTarget < 14 ? 'bg-amber-400' : 'bg-emerald-500';
              const healthBorder = isOverdue ? 'border-red-200' : daysToTarget < 14 ? 'border-amber-200' : 'border-slate-200';

              // Proportional gantt bar
              const plannedDates = calcStageDates(project.startDate, project.selectedParts);
              const totalMs = new Date(project.targetConstructionDate).getTime() - new Date(project.startDate).getTime();
              const todayMs = Date.now() - new Date(project.startDate).getTime();
              const todayPct = Math.min(100, Math.max(0, (todayMs / totalMs) * 100));

              return (
                <div key={project.id} className={`bg-white rounded-xl border hover:border-slate-300 hover:shadow-sm transition-all ${healthBorder}`}>
                  {project.paused && (
                    <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 rounded-t-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-amber-600 shrink-0">⏸</span>
                        <span className="text-sm font-medium text-amber-800 truncate">{project.pauseReason || 'Pristabdyta'}</span>
                        {project.pauseUntil && <span className="text-xs text-amber-500 shrink-0">kontrolė: {formatDate(project.pauseUntil)}</span>}
                      </div>
                      <button onClick={e => { e.preventDefault(); updateProject(project.id, { paused: false, pauseReason: undefined, pauseUntil: undefined }); }} className="text-xs text-amber-600 hover:text-amber-800 font-medium shrink-0">Atnaujinti</button>
                    </div>
                  )}
                  <Link href={`/projects/${project.id}`} className="block p-5 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-900 truncate">{project.name}</h2>
                        {project.address && project.address !== project.name && (
                          <p className="text-sm text-slate-500 mt-0.5 truncate">{project.address}</p>
                        )}
                        {project.client && project.client !== project.name && project.client !== project.address && (
                          <p className="text-xs text-slate-400 mt-0.5">{project.client}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {stages.map(stage => (
                            <span key={stage.id} className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${stage.bgClass} ${stage.textClass}`}>
                              {stage.shortName}
                            </span>
                          ))}
                        </div>
                        {missingDocs > 0 && (
                          <button
                            onClick={e => { e.preventDefault(); setExpandedDocsId(expandedDocsId === project.id ? null : project.id); }}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                              expandedDocsId === project.id
                                ? 'bg-amber-200 text-amber-800'
                                : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            }`}
                          >
                            {missingDocs} dok. trūksta {expandedDocsId === project.id ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mini Gantt */}
                    <div className="mt-4 relative">
                      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 relative">
                        {availableStages.map(s => {
                          const d = plannedDates[s.id];
                          if (!d) return null;
                          const stageMs = new Date(d.endDate).getTime() - new Date(d.startDate).getTime();
                          const pct = (stageMs / totalMs) * 100;
                          const isPast = (project.completedStages ?? []).includes(s.id);
                          const isCurrent = currentStageIds.includes(s.id);
                          return (
                            <div
                              key={s.id}
                              title={`${s.shortName}: ${formatDate(d.startDate)} → ${formatDate(d.endDate)}`}
                              style={{ width: `${pct}%` }}
                              className={`h-full transition-colors border-r border-white/40 last:border-0 ${
                                isPast ? 'bg-slate-400' : isCurrent ? s.colorClass.replace('border-l-', 'bg-').replace('-500','-400') || 'bg-slate-700' : 'bg-slate-200'
                              }`}
                            />
                          );
                        })}
                        {/* Today marker */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-80" style={{ left: `${todayPct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                        <span>{formatDate(project.startDate)}</span>
                        <div className="flex items-center gap-1">
                          {isOverdue && <span className="text-red-500 font-medium">vėluoja</span>}
                          {!isOverdue && daysToTarget < 14 && <span className="text-amber-500 font-medium">{daysToTarget}d. liko</span>}
                          <span className={isOverdue ? 'text-red-400' : ''}>{formatDate(project.targetConstructionDate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Checklist progress + health */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${healthColor}`} title={isOverdue ? 'Vėluoja' : daysToTarget < 14 ? 'Artėja terminas' : 'Vyksta pagal planą'} />
                      <div className="flex-1 bg-slate-100 rounded-full h-1">
                        <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{progress}%</span>
                    </div>
                  </Link>

                  {/* Quick doc marking */}
                  {expandedDocsId === project.id && (
                    <div className="px-5 pb-3 border-t border-amber-100 pt-3 bg-amber-50/50">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Trūkstami dokumentai</p>
                      <div className="space-y-1.5">
                        {project.dokumentai.filter(d => !d.received).map(doc => (
                          <label key={doc.id} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => toggleDocument(project.id, doc.id)}
                              className="w-4 h-4 rounded border-amber-300 text-emerald-500 cursor-pointer"
                            />
                            <span className="text-xs text-slate-700 group-hover:text-slate-900 transition-colors">
                              <span className="text-slate-400 mr-1">{doc.number}</span>
                              {doc.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Copy + Pause buttons */}
                  <div className="px-5 py-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={e => { e.preventDefault(); setPauseModal({ projectId: project.id, reason: project.pauseReason ?? '', until: project.pauseUntil ?? '' }); }}
                      className={`text-xs flex items-center gap-1 transition-colors ${project.paused ? 'text-amber-500 hover:text-amber-700 font-medium' : 'text-slate-400 hover:text-amber-600'}`}
                      title="Pristabdyti projektą"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                      </svg>
                      {project.paused ? 'Pristabdyta' : 'Pristabdyti'}
                    </button>
                    {copyConfirmId === project.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Kopijuoti?</span>
                        <button onClick={e => { e.preventDefault(); const copy = copyProject(project); setCopyConfirmId(null); router.push(`/projects/${copy.id}`); }} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors">Taip</button>
                        <button onClick={e => { e.preventDefault(); setCopyConfirmId(null); }} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Ne</button>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.preventDefault(); setCopyConfirmId(project.id); }}
                        className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                        title="Kopijuoti projektą"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Kopijuoti
                      </button>
                    )}
                  </div>

                  {/* Veiksmų diagrama */}
                  {(smartPlan.chain.length > 0 || smartPlan.parallel.length > 0) && (() => {
                    const allTasks = [...smartPlan.chain, ...smartPlan.parallel];
                    const isExpanded = expandedTasksId === project.id;
                    const LIMIT = 3;
                    const showAll = isExpanded || allTasks.length <= LIMIT;
                    return (
                    <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Šios dienos darbai</p>
                      <div style={{display:'block'}}>
                        {/* Sequential chain */}
                        {smartPlan.chain.filter((_, i) => showAll || i < LIMIT).map((a, i) => {
                          const tsk = (project.taskStatuses ?? {})[a.taskKey] ?? {};
                          const blocked = !a.checkable;
                          return (
                            <div key={a.taskKey} style={{display:'block'}}>
                              <div className={`rounded-lg px-3 py-2 border ${blocked ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-2">
                                  {a.checkable
                                    ? <button onClick={e => { e.stopPropagation(); updateProject(project.id, { taskStatuses: { ...(project.taskStatuses ?? {}), [a.taskKey]: { ...tsk, doneAt: new Date().toISOString().slice(0,10) } } }); }} className="shrink-0 w-4 h-4 rounded border-2 border-slate-300 hover:border-green-500 transition-colors" />
                                    : <span className="shrink-0 w-4 h-4" />}
                                  <span className={`text-xs font-medium ${blocked ? 'text-red-700' : 'text-slate-700'}`}>{a.text}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 pl-6">
                                  {a.sub && <span className="text-xs text-slate-400 flex-1">— {a.sub}</span>}
                                  <div className="relative shrink-0" onClick={e => { e.stopPropagation(); (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.(); }}>
                                    <span className="flex items-center gap-1 text-xs border border-slate-200 rounded px-1.5 py-0.5 w-28 text-slate-400 bg-white"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{tsk.dueDate ? formatDate(tsk.dueDate) : '—'}</span>
                                    <input type="date" value={tsk.dueDate ?? ''} onChange={e => { e.stopPropagation(); updateProject(project.id, { taskStatuses: { ...(project.taskStatuses ?? {}), [a.taskKey]: { ...tsk, dueDate: e.target.value } } }); }} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                                  </div>
                                </div>
                              </div>
                              {(i < smartPlan.chain.length - 1 || smartPlan.parallel.length > 0) && (
                                <div className="ml-5 my-1 text-slate-300 text-xs">↓</div>
                              )}
                            </div>
                          );
                        })}
                        {/* Parallel */}
                        {smartPlan.parallel.length > 0 && (
                          <div>
                            {smartPlan.chain.length > 0 && (
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs text-slate-400 font-medium">Lygiagrečiai</span>
                                <div className="flex-1 h-px bg-slate-100" />
                              </div>
                            )}
                            <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                              {smartPlan.parallel.filter((_, i) => showAll || smartPlan.chain.length + i < LIMIT).map(a => {
                                const tsk = (project.taskStatuses ?? {})[a.taskKey] ?? {};
                                return (
                                  <div key={a.taskKey} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <button onClick={e => { e.stopPropagation(); updateProject(project.id, { taskStatuses: { ...(project.taskStatuses ?? {}), [a.taskKey]: { ...tsk, doneAt: new Date().toISOString().slice(0,10) } } }); }} className="shrink-0 w-4 h-4 rounded border-2 border-slate-300 hover:border-green-500 transition-colors" />
                                      <span className="text-xs text-slate-700">{a.text}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 pl-6">
                                      {a.sub && <span className="text-xs text-slate-400 flex-1">— {a.sub}</span>}
                                      <div className="relative shrink-0" onClick={e => { e.stopPropagation(); (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker?.(); }}>
                                        <span className="flex items-center gap-1 text-xs border border-slate-200 rounded px-1.5 py-0.5 w-28 text-slate-400 bg-white"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{tsk.dueDate ? formatDate(tsk.dueDate) : '—'}</span>
                                        <input type="date" value={tsk.dueDate ?? ''} onChange={e => { e.stopPropagation(); updateProject(project.id, { taskStatuses: { ...(project.taskStatuses ?? {}), [a.taskKey]: { ...tsk, dueDate: e.target.value } } }); }} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {!showAll && allTasks.length > LIMIT && (
                          <button onClick={e => { e.stopPropagation(); setExpandedTasksId(project.id); }} className="text-xs text-slate-400 hover:text-slate-600 mt-2 transition-colors">
                            + {allTasks.length - LIMIT} daugiau...
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Quick stage toggles */}
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Aktyvūs etapai</p>
                    <div className="flex gap-1.5 flex-wrap">
                    {availableStages.map(s => {
                      const isOn = currentStageIds.includes(s.id);
                      const shortLabel = s.id === 'PP_VIESIMAS' ? 'Viešin.' : s.id === 'PAKARTOTINIS' ? 'Pakart.' : s.id === 'IP' ? 'IP' : s.id === 'EKSPERTIZE' ? 'Ekspert.' : s.shortName;
                      return (
                        <button
                          key={s.id}
                          onClick={e => { e.stopPropagation(); toggleStage(project.id, s.id); }}
                          title={`${s.name} — spausti norėdami ${isOn ? 'išjungti' : 'įjungti'}`}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                            isOn
                              ? `${s.bgClass} ${s.textClass} border-transparent`
                              : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {shortLabel}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paused projects */}
          {pausedProjects.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">
                <span>⏸</span> Pristabdyti ({pausedProjects.length})
              </div>
              <div className="grid gap-3">
                {pausedProjects.filter(p => {
                  if (search.trim()) {
                    const q = search.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.client.toLowerCase().includes(q);
                  }
                  return true;
                }).map(project => (
                  <div key={project.id} className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
                    <div className="px-5 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-amber-600 shrink-0">⏸</span>
                        <Link href={`/projects/${project.id}`} className="font-semibold text-slate-700 hover:text-slate-900 truncate">{project.name}</Link>
                        {project.address && project.address !== project.name && <span className="text-sm text-slate-400 truncate hidden sm:block">{project.address}</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {project.pauseUntil && <span className="text-xs text-amber-500">kontrolė: {formatDate(project.pauseUntil)}</span>}
                        <button onClick={() => updateProject(project.id, { paused: false, pauseReason: undefined, pauseUntil: undefined })} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Atnaujinti</button>
                        <button onClick={() => setPauseModal({ projectId: project.id, reason: project.pauseReason ?? '', until: project.pauseUntil ?? '' })} className="text-xs text-slate-400 hover:text-slate-600">Redaguoti</button>
                      </div>
                    </div>
                    {project.pauseReason && <div className="px-5 pb-3 text-sm text-amber-700">{project.pauseReason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                          <span>Pradžia: {formatDate(project.startDate)}</span>
                          <span>Tikslas: {formatDate(project.targetConstructionDate)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <TasksSidebar
            projects={projects}
            open={taskSidebarOpen}
            onToggle={() => setTaskSidebarOpen(v => !v)}
            updateProject={updateProject}
          />

          {archivedProjects.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 hover:text-slate-600 transition-colors"
              >
                <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>›</span>
                📦 Archyvas ({archivedProjects.length})
              </button>
              {showArchived && (
                <div className="grid gap-3">
                  {archivedProjects.map(project => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="bg-slate-50 rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-all block opacity-60 hover:opacity-90"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-slate-600 truncate text-sm">{project.name}</h2>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">📦 Archyvas</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{project.client} · {project.address}</p>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{formatDate(project.targetConstructionDate)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Pause modal */}
      {pauseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPauseModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Pristabdyti projektą</h2>
            <p className="text-sm text-slate-500 mb-5">Nurodykite priežastį. Projektas nebus skaičiuojamas kaip vėluojantis.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priežastis</label>
                <textarea
                  rows={3}
                  value={pauseModal.reason}
                  onChange={e => setPauseModal(m => m ? { ...m, reason: e.target.value } : null)}
                  placeholder="pvz. Laukiama užsakovo dokumentų..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 resize-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kontrolinė data (neprivalomai)</label>
                <input
                  type="date"
                  value={pauseModal.until}
                  onChange={e => setPauseModal(m => m ? { ...m, until: e.target.value } : null)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-slate-400"
                />
                <p className="text-xs text-slate-400 mt-1">Primins kada patikrinti užsakovą</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  updateProject(pauseModal.projectId, {
                    paused: true,
                    pauseReason: pauseModal.reason || undefined,
                    pauseUntil: pauseModal.until || undefined,
                  });
                  setPauseModal(null);
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Pristabdyti
              </button>
              <button onClick={() => setPauseModal(null)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors">
                Atšaukti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
