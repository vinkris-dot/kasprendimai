'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { STAGES, calcStageDates, formatDate, TEAM_MEMBERS } from '@/lib/defaultData';
import { Project, StageId, TeamMemberId } from '@/lib/types';
import { getAllTasks, groupByUrgency } from '@/lib/tasks';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const WEEK_END = (() => {
  const d = new Date(TODAY);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow));
  d.setHours(23, 59, 59, 999);
  return d;
})();
const WEEK_START = (() => {
  const d = new Date(TODAY);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
})();

const DAY_LT = ['sekmadienis', 'pirmadienis', 'antradienis', 'trečiadienis', 'ketvirtadienis', 'penktadienis', 'šeštadienis'];
const MONTH_LT = ['sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio', 'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio'];

function dateStr(d: Date) {
  return `${DAY_LT[d.getDay()]}, ${d.getDate()} ${MONTH_LT[d.getMonth()]}`;
}

function AssigneeBadge({ id }: { id?: TeamMemberId }) {
  if (!id) return null;
  const m = TEAM_MEMBERS.find(m => m.id === id);
  if (!m) return null;
  return (
    <span className={`shrink-0 inline-flex w-6 h-6 rounded-full text-xs font-bold items-center justify-center ${m.color} ${m.textColor}`}>
      {m.initials}
    </span>
  );
}

function Section({ title, color, children, defaultOpen = true }: { title: string; color: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-3 border-b ${color} hover:opacity-90 transition-opacity`}
      >
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className={`transition-transform text-current ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

export default function SavanePage() {
  const { projects, loaded } = useProjects();
  if (!loaded) return null;

  const active = projects.filter(p => !p.archived && !p.paused && (p.activeStages ?? []).length > 0);

  // ── Overdue stages ───────────────────────────────────────────────────────
  const overdueStages: { project: Project; stageId: StageId; daysLate: number }[] = [];
  for (const p of active) {
    const planned = calcStageDates(p.startDate, p.selectedParts);
    for (const sid of (p.activeStages ?? [])) {
      const d = planned[sid as StageId];
      if (!d) continue;
      const end = new Date(d.endDate);
      end.setHours(0, 0, 0, 0);
      if (end < TODAY) {
        overdueStages.push({ project: p, stageId: sid as StageId, daysLate: Math.round((TODAY.getTime() - end.getTime()) / 86400000) });
      }
    }
  }
  overdueStages.sort((a, b) => b.daysLate - a.daysLate);

  // ── Stages ending this week ──────────────────────────────────────────────
  const thisWeekStages: { project: Project; stageId: StageId; endDate: string; daysLeft: number }[] = [];
  for (const p of active) {
    const planned = calcStageDates(p.startDate, p.selectedParts);
    for (const sid of (p.activeStages ?? [])) {
      const d = planned[sid as StageId];
      if (!d) continue;
      const end = new Date(d.endDate);
      end.setHours(0, 0, 0, 0);
      if (end >= TODAY && end <= WEEK_END) {
        const daysLeft = Math.round((end.getTime() - TODAY.getTime()) / 86400000);
        thisWeekStages.push({ project: p, stageId: sid as StageId, endDate: d.endDate, daysLeft });
      }
    }
  }
  thisWeekStages.sort((a, b) => a.daysLeft - b.daysLeft);

  // ── Tasks this week ──────────────────────────────────────────────────────
  const allTasks = getAllTasks(projects);
  const { overdue: overdueTasks, today: todayTasks, thisWeek: weekTasks } = groupByUrgency(allTasks);
  const urgentTasks = [...overdueTasks, ...todayTasks, ...weekTasks];

  // ── Missing docs ─────────────────────────────────────────────────────────
  const missingByProject = active
    .map(p => ({ project: p, missing: p.dokumentai.filter(d => !d.received) }))
    .filter(x => x.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length)
    .slice(0, 8);

  // ── Team workload ────────────────────────────────────────────────────────
  const workload: Record<TeamMemberId, { name: string; id: string; stages: StageId[] }[]> = { NR: [], KV: [], LL: [], EXT: [] };
  for (const p of active) {
    for (const [sid, assignees] of Object.entries(p.stageAssignees ?? {})) {
      if ((p.activeStages ?? []).includes(sid as StageId)) {
        for (const a of (assignees ?? [])) {
          const existing = workload[a].find(x => x.id === p.id);
          if (existing) {
            if (!existing.stages.includes(sid as StageId)) existing.stages.push(sid as StageId);
          } else {
            workload[a].push({ name: p.name, id: p.id, stages: [sid as StageId] });
          }
        }
      }
    }
  }

  const todayFormatted = dateStr(TODAY);
  const weekEndFormatted = dateStr(WEEK_END);

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 mb-2 inline-block">← Visi projektai</Link>
          <h1 className="text-2xl font-bold text-slate-900">Savaitės suvestinė</h1>
          <p className="text-slate-400 text-sm mt-1">
            {todayFormatted} — {weekEndFormatted}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${overdueStages.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{overdueStages.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">vėluojantys</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${thisWeekStages.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{thisWeekStages.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">šią savaitę</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${urgentTasks.length > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{urgentTasks.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">užduotys</div>
          </div>
        </div>
      </div>

      {/* Overdue */}
      {overdueStages.length > 0 && (
        <Section title={`🔴 Vėluojantys etapai (${overdueStages.length})`} color="bg-red-50 border-red-100 text-red-800" defaultOpen={overdueStages.length <= 5}>
          <div className="space-y-2">
            {overdueStages.map(({ project, stageId, daysLate }) => {
              const stage = STAGES.find(s => s.id === stageId);
              return (
                <Link key={`${project.id}-${stageId}`} href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-red-50 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stage?.bgClass} ${stage?.textClass}`}>{stage?.shortName}</span>
                    <span className="text-sm text-slate-800 truncate group-hover:text-red-700">{project.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-500 shrink-0 ml-4">{daysLate} d. vėluoja</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* This week stages */}
      {thisWeekStages.length > 0 && (
        <Section title={`🟡 Šią savaitę baigiasi (${thisWeekStages.length})`} color="bg-amber-50 border-amber-100 text-amber-800">
          <div className="space-y-2">
            {thisWeekStages.map(({ project, stageId, endDate, daysLeft }) => {
              const stage = STAGES.find(s => s.id === stageId);
              return (
                <Link key={`${project.id}-${stageId}`} href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-amber-50 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stage?.bgClass} ${stage?.textClass}`}>{stage?.shortName}</span>
                    <span className="text-sm text-slate-800 truncate">{project.name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-sm font-medium text-amber-700">{daysLeft === 0 ? 'šiandien' : `${daysLeft} d.`}</span>
                    <div className="text-xs text-slate-400">{formatDate(endDate)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* Tasks */}
      {urgentTasks.length > 0 && (
        <Section title={`📋 Užduotys šią savaitę (${urgentTasks.length})`} color="bg-blue-50 border-blue-100 text-blue-800">
          <div className="space-y-1.5">
            {urgentTasks.slice(0, 15).map(t => (
              <Link key={t.key} href={`/projects/${t.projectId}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                <AssigneeBadge id={t.assignee} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-400 truncate block">{t.projectName}</span>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{t.label}</span>
                </div>
                {t.dueDate && (
                  <span className={`text-xs font-medium shrink-0 ${t.dueDate < TODAY.toISOString().slice(0,10) ? 'text-red-500' : 'text-slate-400'}`}>
                    {t.dueDate === TODAY.toISOString().slice(0,10) ? 'šiandien' : t.dueDate}
                  </span>
                )}
              </Link>
            ))}
            {urgentTasks.length > 15 && (
              <p className="text-xs text-slate-400 text-center pt-2">+ {urgentTasks.length - 15} daugiau užduočių</p>
            )}
          </div>
        </Section>
      )}

      {/* Missing docs */}
      {missingByProject.length > 0 && (
        <Section title={`📄 Laukiami dokumentai`} color="bg-slate-50 border-slate-100 text-slate-700">
          <div className="grid grid-cols-2 gap-3">
            {missingByProject.map(({ project, missing }) => (
              <Link key={project.id} href={`/projects/${project.id}`}
                className="p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-amber-800">{project.name}</span>
                  <span className="text-xs font-bold text-amber-600 shrink-0 ml-2">{missing.length}</span>
                </div>
                <div className="space-y-0.5">
                  {missing.slice(0, 3).map(d => (
                    <div key={d.id} className="text-xs text-slate-400 truncate">
                      <span className="text-slate-300 mr-1">{d.number}</span>{d.name}
                    </div>
                  ))}
                  {missing.length > 3 && <div className="text-xs text-slate-300">+ {missing.length - 3} daugiau</div>}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Team workload */}
      <Section title="👥 Komandos krūvis šią savaitę" color="bg-slate-50 border-slate-100 text-slate-700">
        <div className="grid grid-cols-3 gap-4">
          {TEAM_MEMBERS.filter(m => m.id !== 'EXT').map(m => {
            const items = workload[m.id] ?? [];
            return (
              <div key={m.id} className="space-y-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${m.color} ${m.textColor}`}>
                  <span className="font-bold text-sm">{m.initials}</span>
                  <span className="text-xs font-medium">{m.name}</span>
                  <span className="text-xs font-bold ml-auto">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-slate-300 pl-1">Nepriskirta</p>
                ) : (
                  <div className="space-y-1.5 pl-1">
                    {items.slice(0, 5).map(({ name, id, stages }) => {
                      const stageBadges = stages.map(sid => STAGES.find(s => s.id === sid)).filter(Boolean);
                      return (
                        <Link key={id} href={`/projects/${id}`} className="block group">
                          <p className="text-xs text-slate-600 truncate group-hover:text-slate-900 leading-tight">{name}</p>
                          {stageBadges.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {stageBadges.map(s => s && (
                                <span key={s.id} className={`text-[9px] font-semibold px-1.5 py-0 rounded-full ${s.bgClass} ${s.textClass}`}>
                                  {s.shortName}
                                </span>
                              ))}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                    {items.length > 5 && <p className="text-xs text-slate-300">+ {items.length - 5} daugiau</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* All good */}
      {overdueStages.length === 0 && thisWeekStages.length === 0 && urgentTasks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-lg font-semibold text-slate-800">Viskas tvarkoje!</h2>
          <p className="text-slate-400 text-sm mt-1">Šią savaitę nėra vėluojančių etapų ar skubių užduočių</p>
        </div>
      )}
    </div>
  );
}
