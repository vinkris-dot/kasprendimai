'use client';

import { useRef } from 'react';
import { Project } from '@/lib/types';
import { SyncStatus } from '@/lib/useProjects';
import { todayLT } from '@/lib/dates';

/**
 * Duomenų saugumo juosta: sinchronizacijos būsena + atsarginė kopija (JSON).
 * Eksportas/importas veikia nepriklausomai nuo Supabase.
 */
export default function DataSafety({ projects, syncStatus }: { projects: Project[]; syncStatus: SyncStatus }) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ka-projektai-${todayLT()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed) || parsed.some(p => !p?.id || !p?.name)) {
          alert('Failas neatpažintas — tai ne projektų kopija.');
          return;
        }
        if (!confirm(`Rasta ${parsed.length} projektų kopijoje. Pakeisti dabartinius (${projects.length})?`)) return;
        localStorage.setItem('openclaw_projects', JSON.stringify(parsed));
        window.location.reload();
      } catch {
        alert('Nepavyko perskaityti failo.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex items-center gap-3">
      {syncStatus === 'synced' ? (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600" title="Duomenys sinchronizuojami su debesiu">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Debesis
        </span>
      ) : syncStatus === 'local-only' ? (
        <span
          className="flex items-center gap-1.5 text-xs text-amber-600 font-medium"
          title="Debesų sinchronizacija neveikia — duomenys saugomi tik šioje naršyklėje. Būtinai atsisiųskite kopiją."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
          Tik šioje naršyklėje
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-slate-300" title="Tikrinama sinchronizacija...">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block animate-pulse" />
        </span>
      )}
      <button
        onClick={handleExport}
        className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
        title="Atsisiųsti visų projektų atsarginę kopiją (JSON)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Kopija
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
        title="Atkurti projektus iš anksčiau atsisiųstos kopijos"
      >
        Įkelti
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
    </div>
  );
}
