'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { PROJECT_PARTS, DEFAULT_PARTS, calcTargetDate, formatDate } from '@/lib/defaultData';
import { SelectedParts, PartId, ProjektavimoUzduotis, DEFAULT_PU } from '@/lib/types';

function suggestProjectNumber(existingNumbers: (string | undefined)[]): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `KAS ${yy}${mm}/`;
  const used = existingNumbers
    .filter((n): n is string => !!n && n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, '')) || 0);
  const next = used.length > 0 ? Math.max(...used) + 1 : 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

const GROUP_LABELS: Record<string, string> = {
  pp: 'Projektiniai pasiūlymai',
  sld: 'Leidimas',
  tdp: 'Techninis darbo projektas',
  other: 'Kita',
};

const PRIORITETAI_LABELS = [
  { key: 'funkcionalumas', label: 'Funkcionalumas' },
  { key: 'archIsraiška', label: 'Architektūrinė išraiška' },
  { key: 'statybosKaina', label: 'Statybos kaina' },
  { key: 'energinis', label: 'Energinis efektyvumas' },
  { key: 'paprastumas', label: 'Statybos paprastumas' },
] as const;

function RadioGroup({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? '' : o.value)}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
              value === o.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewProject() {
  const router = useRouter();
  const { addProject, projects } = useProjects();

  const suggested = useMemo(() => suggestProjectNumber(projects.map(p => p.projectNumber)), [projects]);
  const [projectNumber, setProjectNumber] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [parts, setParts] = useState<SelectedParts>({ ...DEFAULT_PARTS });
  const [showPU, setShowPU] = useState(false);
  const [pu, setPu] = useState<ProjektavimoUzduotis>({ ...DEFAULT_PU });

  const targetDate = useMemo(() => calcTargetDate(startDate, parts), [startDate, parts]);

  function togglePart(id: PartId) {
    setParts(p => ({ ...p, [id]: !p[id] }));
  }

  function handleKitaDays(val: string) {
    const n = parseInt(val) || 14;
    setParts(p => ({ ...p, KITA_days: n * 7 }));
  }

  function setPuField<K extends keyof ProjektavimoUzduotis>(key: K, val: ProjektavimoUzduotis[K]) {
    setPu(p => ({ ...p, [key]: val }));
  }

  function setPriority(key: keyof ProjektavimoUzduotis['prioritetai'], rank: number) {
    setPu(p => ({ ...p, prioritetai: { ...p.prioritetai, [key]: p.prioritetai[key] === rank ? 0 : rank } }));
  }

  function toggleFasadas(val: string) {
    setPu(p => ({
      ...p,
      fasadai: p.fasadai.includes(val) ? p.fasadai.filter(f => f !== val) : [...p.fasadai, val],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !address || !client || !startDate) return;
    const project = addProject({ name, address, client, clientEmail, startDate, selectedParts: parts, pu: showPU ? pu : undefined, projectNumber: projectNumber.trim() || suggested });
    router.push(`/projects/${project.id}`);
  }

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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Projekto Nr.</label>
            <div className="relative">
              <input
                value={projectNumber}
                onChange={e => setProjectNumber(e.target.value)}
                placeholder={suggested}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
              {!projectNumber && (
                <button type="button" onClick={() => setProjectNumber(suggested)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 transition-colors">
                  naudoti {suggested}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Formatas: KAS YYMM/NN — pvz. {suggested}</p>
          </div>

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
                    const hasSpSaLvn = !!(parts.SP || parts.SA || parts.LVN);
                    const bdDisabled = part.id === 'BD' && !hasSpSaLvn;
                    return (
                      <div key={part.id}>
                        <label
                          title={bdDisabled ? 'BD įjungiama tik kai yra SP, SA arba LVN' : undefined}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium select-none ${
                            bdDisabled
                              ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                              : checked
                                ? 'border-slate-900 bg-slate-900 text-white cursor-pointer'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={!!checked}
                            disabled={bdDisabled}
                            onChange={() => { if (!bdDisabled) togglePart(part.id); }}
                          />
                          {part.label}
                          <span className={`text-xs font-normal ${checked ? 'text-slate-300' : 'text-slate-400'}`}>
                            {part.id === 'KITA' ? `${Math.round(parts.KITA_days / 7)} sav.` : `${part.durationDays / 7} sav.`}
                          </span>
                        </label>
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

        {/* Projektavimo užduotis toggle */}
        <button
          type="button"
          onClick={() => setShowPU(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-400 transition-colors text-sm font-medium text-slate-700"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Projektavimo užduotis
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showPU ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showPU && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            {/* Section 2 extras */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">2. Projektavimo duomenys</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Projektavimo objektas</label>
                  <input value={pu.objektas} onChange={e => setPuField('objektas', e.target.value)}
                    placeholder="pvz. Gyvenamasis namas"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Statybos rūšis</label>
                  <input value={pu.statybosRusis} onChange={e => setPuField('statybosRusis', e.target.value)}
                    placeholder="pvz. Nauja statyba"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bendras plotas, m²</label>
                  <input value={pu.bendrasPlotai} onChange={e => setPuField('bendrasPlotai', e.target.value)}
                    placeholder="pvz. 180"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Sklypo plotas, m²</label>
                  <input value={pu.sklypoPlotai} onChange={e => setPuField('sklypoPlotai', e.target.value)}
                    placeholder="pvz. 1200"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Žemės sklypo paskirtis</label>
                  <input value={pu.zemesPaskirtis} onChange={e => setPuField('zemesPaskirtis', e.target.value)}
                    placeholder="pvz. Gyvenamoji"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefono Nr.</label>
                  <input value={pu.telefonas} onChange={e => setPuField('telefonas', e.target.value)}
                    placeholder="+370 600 00000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 4: Prioritetai */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">4. Prioritetai (1–5)</h3>
              <p className="text-xs text-slate-400">Sunumeruokite nuo 1 (svarbiausias) iki 5</p>
              <div className="space-y-2">
                {PRIORITETAI_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-48 shrink-0">{label}</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPriority(key, n)}
                          className={`w-8 h-8 rounded-lg border text-sm font-medium transition-all ${
                            pu.prioritetai[key] === n
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 5: Funkcinė struktūra */}
            <div className="space-y-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">5. Funkcinė struktūra</h3>

              {/* 5a Bendra erdvė */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-600">Bendra erdvė</p>
                <RadioGroup
                  label="Virtuvės tipas"
                  value={pu.virtuveTipas}
                  onChange={v => setPuField('virtuveTipas', v as any)}
                  options={[
                    { value: 'atvira', label: 'Atvira' },
                    { value: 'pusiau_atvira', label: 'Pusiau atvira' },
                    { value: 'uzdara', label: 'Uždara' },
                  ]}
                />
                <RadioGroup
                  label="Bendros erdvės dydis"
                  value={pu.bendrosErdvesDydis}
                  onChange={v => setPuField('bendrosErdvesDydis', v as any)}
                  options={[
                    { value: 'vidutine', label: '~45–50 m²' },
                    { value: 'erdvi', label: '~50–60 m²' },
                    { value: 'labai_erdvi', label: '60 m²+' },
                    { value: 'kita', label: 'Kita' },
                  ]}
                />
                {pu.bendrosErdvesDydis === 'kita' && (
                  <input value={pu.bendrosErdvesDydisKita} onChange={e => setPuField('bendrosErdvesDydisKita', e.target.value)}
                    placeholder="Nurodyti dydį"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                )}
                <RadioGroup
                  label="Lubų aukštis bendroje erdvėje"
                  value={pu.lubosAukstis}
                  onChange={v => setPuField('lubosAukstis', v as any)}
                  options={[
                    { value: 'standartinis', label: '~2,80–3,00 m' },
                    { value: 'padidintas', label: '~3,20–3,40 m' },
                    { value: 'dvieju_aukstu', label: 'Dviejų aukštų erdvė' },
                    { value: 'kitas', label: 'Kitas' },
                  ]}
                />
                {pu.lubosAukstis === 'kitas' && (
                  <input value={pu.lubosAukstisKitas} onChange={e => setPuField('lubosAukstisKitas', e.target.value)}
                    placeholder="Nurodyti aukštį"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pu.sandeliukasPrieVirtuve} onChange={e => setPuField('sandeliukasPrieVirtuve', e.target.checked)}
                    className="rounded border-slate-300 text-slate-900" />
                  <span className="text-sm text-slate-700">Sandėliukas prie virtuvės</span>
                </label>
              </div>

              {/* 5b Gyvenamosios */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-600">Gyvenamosios patalpos</p>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-700 shrink-0">Vaikų kambarių skaičius</label>
                  <input
                    type="number" min={0} max={10}
                    value={pu.vaikusKambariuSk || ''}
                    onChange={e => setPuField('vaikusKambariuSk', parseInt(e.target.value) || 0)}
                    className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="0"
                  />
                </div>
                <RadioGroup
                  label="Darbo kambarys / kabinetas"
                  value={pu.darbKambarys}
                  onChange={v => setPuField('darbKambarys', v as any)}
                  options={[
                    { value: 'reikalingas', label: 'Reikalingas' },
                    { value: 'universali', label: 'Universali patalpa' },
                    { value: 'nereikalingas', label: 'Nereikalingas' },
                  ]}
                />
                <RadioGroup
                  label="Tėvų drabužinė"
                  value={pu.drabuzine}
                  onChange={v => setPuField('drabuzine', v as any)}
                  options={[
                    { value: 'atskira', label: 'Atskira' },
                    { value: 'miegamojo', label: 'Miegamojo patalpoje' },
                    { value: 'nenumatoma', label: 'Nenumatoma' },
                  ]}
                />
                <RadioGroup
                  label="Atskiras tėvų sanitarinis mazgas"
                  value={pu.tevisSmaz}
                  onChange={v => setPuField('tevisSmaz', v as any)}
                  options={[
                    { value: 'su_dusu', label: 'Su dušu' },
                    { value: 'su_vonia', label: 'Su vonia' },
                    { value: 'ne', label: 'Ne' },
                  ]}
                />
              </div>

              {/* 5c Sanitarinės */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-600">Sanitarinės ir pagalbinės patalpos</p>
                <RadioGroup
                  label="Bendras vonios kambarys"
                  value={pu.bendrasVonios}
                  onChange={v => setPuField('bendrasVonios', v as any)}
                  options={[
                    { value: 'su_vonia', label: 'Su vonia' },
                    { value: 'su_dusu', label: 'Su dušu' },
                  ]}
                />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pu.papildomasWC} onChange={e => setPuField('papildomasWC', e.target.checked)}
                      className="rounded border-slate-300" />
                    <span className="text-sm text-slate-700">Papildomas WC</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={pu.techPatalpa} onChange={e => setPuField('techPatalpa', e.target.checked)}
                      className="rounded border-slate-300" />
                    <span className="text-sm text-slate-700">Techninė patalpa / sandėliukas</span>
                  </label>
                </div>
                <RadioGroup
                  label="Skalbykla"
                  value={pu.skalbykla}
                  onChange={v => setPuField('skalbykla', v as any)}
                  options={[
                    { value: 'atskira', label: 'Atskira patalpa' },
                    { value: 'technine', label: 'Techninėje patalpoje' },
                  ]}
                />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Garažas</p>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-700 shrink-0">Automobilių skaičius</label>
                    <input
                      type="number" min={0} max={10}
                      value={pu.garazasAutoSk || ''}
                      onChange={e => setPuField('garazasAutoSk', parseInt(e.target.value) || 0)}
                      className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="0"
                    />
                  </div>
                  <RadioGroup
                    label="Garažo sprendimas"
                    value={pu.garazasSprendimas}
                    onChange={v => setPuField('garazasSprendimas', v as any)}
                    options={[
                      { value: 'integruotas', label: 'Integruotas' },
                      { value: 'atskiras', label: 'Atskiras' },
                      { value: 'stogine', label: 'Stoginė' },
                      { value: 'projektuojant', label: 'Sprendžiama proj. metu' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Kitos patalpos</label>
                  <input value={pu.kitosPatalpos} onChange={e => setPuField('kitosPatalpos', e.target.value)}
                    placeholder="pvz. Svestinė, sporto kambarys..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 6: Architektūriniai pasirinkimai */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">6. Architektūriniai pasirinkimai</h3>
              <RadioGroup
                label="Pastato charakteris"
                value={pu.pastatoCharakteris}
                onChange={v => setPuField('pastatoCharakteris', v as any)}
                options={[
                  { value: 'siuolaikinis', label: 'Šiuolaikinis' },
                  { value: 'tradicinis', label: 'Tradicinis' },
                  { value: 'kita', label: 'Kita' },
                ]}
              />
              {pu.pastatoCharakteris === 'kita' && (
                <input value={pu.pastatoCharakterisKita} onChange={e => setPuField('pastatoCharakterisKita', e.target.value)}
                  placeholder="Apibūdinti stilių"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              )}
              <RadioGroup
                label="Stogo tipas"
                value={pu.stogasTipas}
                onChange={v => setPuField('stogasTipas', v as any)}
                options={[
                  { value: 'slaitinis', label: 'Šlaitinis' },
                  { value: 'plokscias', label: 'Plokščias' },
                  { value: 'kombinuotas', label: 'Kombinuotas' },
                ]}
              />
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Fasadų apdaila (galimi keli)</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'tinkas', label: 'Tinkas' },
                    { value: 'medis', label: 'Medis / lentelės' },
                    { value: 'klinkeris', label: 'Klinkeris' },
                    { value: 'kita', label: 'Kita' },
                  ].map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleFasadas(o.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        pu.fasadai.includes(o.value)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {pu.fasadai.includes('kita') && (
                  <input value={pu.fasadaiKita} onChange={e => setPuField('fasadaiKita', e.target.value)}
                    placeholder="Nurodyti medžiagą"
                    className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Auto-calculated date preview */}
        <div className={`rounded-xl border-2 p-5 transition-colors ${targetDate ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">
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
