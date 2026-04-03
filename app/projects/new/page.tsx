'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { PROJECT_PARTS, DEFAULT_PARTS, calcTargetDate, formatDate } from '@/lib/defaultData';
import { SelectedParts, PartId } from '@/lib/types';

const GROUP_LABELS: Record<string, string> = {
  pp: 'Projektiniai pasiūlymai',
  sld: 'Leidimas',
  tdp: 'Techninis darbo projektas',
  other: 'Kita',
};

export default function NewProject() {
  const router = useRouter();
  const { addProject } = useProjects();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [parts, setParts] = useState<SelectedParts>({ ...DEFAULT_PARTS });

  const targetDate = useMemo(() => calcTargetDate(startDate, parts), [startDate, parts]);

  function togglePart(id: PartId) {
    setParts(p => ({ ...p, [id]: !p[id] }));
  }

  function handleKitaDays(val: string) {
    const n = parseInt(val) || 14;
    setParts(p => ({ ...p, KITA_days: n * 7 })); // val = weeks → days
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !address || !client || !startDate) return;
    const project = addProject({ name, address, client, clientEmail, startDate, selectedParts: parts });
    router.push(`/projects/${project.id}`);
  }

  // Group parts for display
  const groups = ['pp', 'sld', 'tdp', 'other'] as const;
  const grouped = groups.map(g => ({
    group: g,
    label: GROUP_LABELS[g],
    parts: PROJECT_PARTS.filter(p => p.group === g),
  }));

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Atgal</Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-3">Naujas projektas</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Projekto informacija</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Projekto pavadinimas *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="pvz. Gyvenamasis namas Kaune"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresas *</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="pvz. Gedimino pr. 1, Vilnius"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Užsakovas *</label>
            <input
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="pvz. Jonas Petraitis"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Užsakovo el. paštas</label>
            <input
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="pvz. jonas@example.lt"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Projekto pradžia *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Parts selection */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Projekto dalys</h2>

          <div className="space-y-5">
            {grouped.map(({ group, label, parts: groupParts }) => (
              <div key={group}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {groupParts.map(part => {
                    const checked = parts[part.id];
                    return (
                      <div key={part.id}>
                        <label
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium select-none ${
                            checked
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={!!checked}
                            onChange={() => togglePart(part.id)}
                          />
                          {part.label}
                          <span className={`text-xs font-normal ${checked ? 'text-slate-300' : 'text-slate-400'}`}>
                            {part.id === 'KITA' ? `${Math.round(parts.KITA_days / 7)} sav.` : `${part.durationDays / 7} sav.`}
                          </span>
                        </label>
                        {/* Kita weeks input */}
                        {part.id === 'KITA' && parts.KITA && (
                          <div className="mt-1.5">
                            <input
                              type="number"
                              min={1}
                              max={52}
                              value={Math.round(parts.KITA_days / 7)}
                              onChange={e => handleKitaDays(e.target.value)}
                              className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                              placeholder="sav."
                            />
                            <span className="text-xs text-slate-400 ml-1">sav.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {group === 'tdp' && (
                  <p className="text-xs text-slate-400 mt-1.5">* TDP vyksta lygiagrečiai su SLD etapu</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Auto-calculated date preview */}
        <div className={`rounded-xl border-2 p-5 transition-colors ${targetDate ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${targetDate ? 'text-slate-400' : 'text-slate-400'}`}>
                Apskaičiuota statybos pradžia
              </p>
              <p className={`text-2xl font-bold ${targetDate ? 'text-white' : 'text-slate-300'}`}>
                {targetDate ? formatDate(targetDate) : '—'}
              </p>
            </div>
            {targetDate && startDate && (
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Projekto trukmė</p>
                <p className="text-lg font-semibold text-white">
                  {Math.round((new Date(targetDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 7))} sav.
                </p>
              </div>
            )}
          </div>
          {targetDate && (
            <p className="text-xs text-slate-500 mt-2">
              Preliminari data pagal pasirinktas dalis. SR etapas visada įtrauktas (~3 sav.).
              {parts.TDP && ' TDP vyksta lygiagrečiai su SLD.'}
              {parts.TDP && ' Ekspertizė (~4 sav.) įtraukta automatiškai.'}
            </p>
          )}
        </div>

        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            className="flex-1 bg-slate-900 text-white text-sm py-3 rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            Sukurti projektą
          </button>
          <Link
            href="/"
            className="px-6 py-3 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            Atšaukti
          </Link>
        </div>
      </form>
    </div>
  );
}
