import { useEffect } from 'react';
import { Project, StageId } from './types';
import { STAGES, calcStageDates } from './defaultData';
import { getAllTasks } from './tasks';

const STORAGE_KEY = 'ka_last_notified';

function getOverdueCount(projects: Project[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  for (const p of projects) {
    if (p.archived || p.paused) continue;
    const planned = calcStageDates(p.startDate, p.selectedParts);
    for (const sid of (p.activeStages ?? [])) {
      const d = planned[sid as StageId];
      if (!d) continue;
      const end = new Date(d.endDate);
      end.setHours(0, 0, 0, 0);
      if (end < today) count++;
    }
  }
  return count;
}

function getOverdueTaskCount(projects: Project[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return getAllTasks(projects).filter(t => t.dueDate && t.dueDate < today).length;
}

export function useNotifications(projects: Project[], loaded: boolean) {
  useEffect(() => {
    if (!loaded || projects.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Only notify once per day
    const lastNotified = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toISOString().slice(0, 10);
    if (lastNotified === today) return;

    const overdueStages = getOverdueCount(projects);
    const overdueTasks = getOverdueTaskCount(projects);

    if (overdueStages === 0 && overdueTasks === 0) return;

    async function sendNotification() {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      const parts: string[] = [];
      if (overdueStages > 0) parts.push(`${overdueStages} vėluojant${overdueStages === 1 ? 'is etapas' : 'ys etapai'}`);
      if (overdueTasks > 0) parts.push(`${overdueTasks} vėluojant${overdueTasks === 1 ? 'i užduotis' : 'ios užduotys'}`);

      new Notification('KA sprendimai ⚠️', {
        body: parts.join(', '),
        icon: '/favicon.ico',
        tag: 'ka-overdue',
      });

      localStorage.setItem(STORAGE_KEY, today);
    }

    sendNotification();
  }, [loaded, projects]);
}
