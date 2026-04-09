'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/useProjects';
import { STAGES, PROJECT_PARTS, formatDate, calcStageDates } from '@/lib/defaultData';
import { StageId, ProjektavimoUzduotis } from '@/lib/types';

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

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
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

  const ppCategories = Array.from(new Set(project.ppByla.map(i => i.category)));
  const docsDone = project.dokumentai.filter(d => d.received).length;
  const ppDone = project.ppByla.filter(i => i.done).length;

  const CONNECTION_KEYS = [
    { key: 'vanduo', label: 'vanduo, nuotekos' },
    { key: 'lietus', label: 'lietus' },
    { key: 'kelias', label: 'kelias' },
    { key: 'elektra', label: 'elektra' },
    { key: 'rysiai', label: 'ryšiai' },
    { key: 'dujos', label: 'dujos' },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Screen-only nav */}
      <div className="print:hidden flex items-center gap-4 px-8 py-4 border-b border-slate-200 bg-slate-50">
        <Link href={`/projects/${project.id}`} className="text-sm text-slate-600 hover:text-slate-900">← Grįžti į projektą</Link>
        <button onClick={() => window.print()} className="ml-auto bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700">
          Spausdinti / Išsaugoti PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10 text-slate-900">
        {/* Header */}
        <div className="mb-8 border-b border-slate-300 pb-6">
          <h1 className="text-2xl font-bold mb-1">{project.name}</h1>
          {project.address && project.address !== project.name && (
            <p className="text-slate-600 mb-0.5">{project.address}</p>
          )}
          {project.client && project.client !== project.name && (
            <p className="text-slate-500 text-sm">{project.client}</p>
          )}
          {project.clientEmail && (
            <p className="text-slate-400 text-sm">{project.clientEmail}</p>
          )}
          <div className="flex gap-6 mt-3 text-sm text-slate-600">
            <span>Pradžia: <strong>{formatDate(project.startDate)}</strong></span>
            <span>Tikslas: <strong>{formatDate(project.targetConstructionDate)}</strong></span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Suvestinė: {formatDate(new Date().toISOString().slice(0,10))}</p>
        </div>

        {/* Stages */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Etapai</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5 font-semibold text-slate-700 w-40">Etapas</th>
                <th className="text-left py-1.5 font-semibold text-slate-700">Planuojama pradžia</th>
                <th className="text-left py-1.5 font-semibold text-slate-700">Planuojama pabaiga</th>
                <th className="text-left py-1.5 font-semibold text-slate-700">Faktas</th>
                <th className="text-center py-1.5 font-semibold text-slate-700">Būsena</th>
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
                    <td className="py-1.5 font-medium">{s.name}</td>
                    <td className="py-1.5 text-slate-600">{planned ? formatDate(planned.startDate) : '—'}</td>
                    <td className="py-1.5 text-slate-600">{planned ? formatDate(planned.endDate) : '—'}</td>
                    <td className="py-1.5 text-slate-600">
                      {status?.startDate ? `${formatDate(status.startDate)}${status.endDate ? ` – ${formatDate(status.endDate)}` : ''}` : '—'}
                    </td>
                    <td className="py-1.5 text-center">
                      {isDone ? '✓' : isActive ? '▶' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Documents */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Dokumentai ({docsDone}/{project.dokumentai.length} gauta)
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5 font-semibold text-slate-700 w-8">Nr.</th>
                <th className="text-left py-1.5 font-semibold text-slate-700">Dokumentas</th>
                <th className="text-center py-1.5 font-semibold text-slate-700 w-16">Gauta</th>
                <th className="text-left py-1.5 font-semibold text-slate-700">Pastaba</th>
              </tr>
            </thead>
            <tbody>
              {project.dokumentai.map(doc => (
                <>
                  <tr key={doc.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-400">{doc.number}</td>
                    <td className="py-1.5 font-medium">{doc.name}</td>
                    <td className="py-1.5 text-center">{doc.received ? '✓' : '—'}</td>
                    <td className="py-1.5 text-slate-500 text-xs">{doc.notes || ''}</td>
                  </tr>
                  {doc.id === 'doc-06' && (
                    <tr key={`${doc.id}-conn`} className="border-b border-slate-100">
                      <td />
                      <td colSpan={3} className="py-1 pl-4">
                        <div className="flex flex-wrap gap-x-6 gap-y-0.5">
                          {CONNECTION_KEYS.map(({ key, label }) => {
                            const date = doc.connectionDates?.[key];
                            return (
                              <span key={key} className="text-xs text-slate-500">
                                {label}: <span className={date ? 'text-slate-700' : 'text-slate-300'}>{date ? formatDate(date) : '—'}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </section>

        {/* PP Checklist */}
        {project.ppByla.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
              PP Byla ({ppDone}/{project.ppByla.length} atlikta)
            </h2>
            {ppCategories.map(cat => {
              const items = project.ppByla.filter(i => i.category === cat);
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold text-slate-600 mb-1">{cat}</p>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-1 text-center w-6">{item.done ? '✓' : '☐'}</td>
                          <td className="py-1 text-slate-700">{item.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        )}

        {/* Motyvuoti atsakymai */}
        {(project.motyvuotiAtsakymai ?? []).length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Motyvuoti atsakymai</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5 font-semibold text-slate-700 w-24">Data</th>
                  <th className="text-left py-1.5 font-semibold text-slate-700">Savivaldybės pastaba</th>
                  <th className="text-left py-1.5 font-semibold text-slate-700">Mūsų atsakymas</th>
                  <th className="text-center py-1.5 font-semibold text-slate-700 w-16">Atsakyta</th>
                </tr>
              </thead>
              <tbody>
                {project.motyvuotiAtsakymai.map(ma => (
                  <tr key={ma.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-500">{formatDate(ma.date)}</td>
                    <td className="py-1.5">{ma.pastaba}</td>
                    <td className="py-1.5 text-slate-600">{ma.atsakymas}</td>
                    <td className="py-1.5 text-center">{ma.atsakyta ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Notes */}
        {project.notes && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Pastabos</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{project.notes}</p>
          </section>
        )}

        {/* Projektavimo užduotis */}
        {project.pu && <PUPrintSection pu={project.pu} project={project} />}
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { font-size: 11px; }
        }
      `}</style>
    </div>
  );
}

const VIRTUAL_TIP_MAP: Record<string, string> = {
  atvira: 'Atvira', pusiau_atvira: 'Pusiau atvira', uzdara: 'Uždara',
  vidutine: '~45–50 m²', erdvi: '~50–60 m²', labai_erdvi: '60 m²+',
  standartinis: '~2,80–3,00 m', padidintas: '~3,20–3,40 m', dvieju_aukstu: 'Dviejų aukštų erdvė',
  reikalingas: 'Reikalingas', nereikalingas: 'Nereikalingas', universali: 'Universali patalpa',
  atskira: 'Atskira', miegamojo: 'Miegamojo patalpoje', nenumatoma: 'Nenumatoma',
  su_dusu: 'Su dušu', su_vonia: 'Su vonia', ne: 'Ne',
  su_vonia_: 'Su vonia',
  integruotas: 'Integruotas į pastato tūrį', atskirasG: 'Atskiras garažas',
  stogine: 'Stoginė', projektuojant: 'Sprendžiama projektavimo metu',
  siuolaikinis: 'Šiuolaikinis', tradicinis: 'Tradicinis',
  slaitinis: 'Šlaitinis', plokscias: 'Plokščias', kombinuotas: 'Kombinuotas',
  tinkas: 'Tinkas', medis: 'Medis / lentelės', klinkeris: 'Klinkeris',
};
function v(val: string) { return VIRTUAL_TIP_MAP[val] ?? val; }

const PRIORITETAI_LABELS = [
  { key: 'funkcionalumas' as const, label: 'Funkcionalumas' },
  { key: 'archIsraiška' as const, label: 'Architektūrinė išraiška' },
  { key: 'statybosKaina' as const, label: 'Statybos kaina' },
  { key: 'energinis' as const, label: 'Energinis efektyvumas' },
  { key: 'paprastumas' as const, label: 'Statybos paprastumas' },
];

function PUPrintSection({ pu, project }: { pu: ProjektavimoUzduotis; project: { name: string; address: string; client: string; clientEmail: string; startDate: string } }) {
  const rankedPriorities = [...PRIORITETAI_LABELS]
    .filter(p => pu.prioritetai[p.key] > 0)
    .sort((a, b) => pu.prioritetai[a.key] - pu.prioritetai[b.key]);

  const row = (label: string, val: string | undefined | null) => val ? (
    <tr key={label} className="border-b border-slate-100">
      <td className="py-1 text-slate-500 w-48 pr-4">{label}</td>
      <td className="py-1 text-slate-900">{val}</td>
    </tr>
  ) : null;

  return (
    <section className="mt-10 pt-8 border-t-2 border-slate-300">
      <h2 className="text-lg font-bold mb-1">Statinio projektavimo užduotis</h2>
      <p className="text-xs text-slate-400 mb-6">Parengta vadovaujantis LR Statybos įstatymu ir STR 1.04.04:2017</p>

      {/* Section 2 */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">2. Projektavimo duomenys</h3>
        <table className="w-full text-sm">
          <tbody>
            {row('Projektavimo objektas', pu.objektas)}
            {row('Statybos rūšis', pu.statybosRusis)}
            {row('Objekto adresas', project.address)}
            {row('Bendras pastato plotas, m²', pu.bendrasPlotai)}
            {row('Sklypo plotas, m²', pu.sklypoPlotai)}
            {row('Žemės sklypo paskirtis', pu.zemesPaskirtis)}
            {row('Statytojas', project.client)}
            {row('Telefono Nr.', pu.telefonas)}
            {row('El. paštas', project.clientEmail)}
          </tbody>
        </table>
      </div>

      {/* Section 4: Prioritetai */}
      {rankedPriorities.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">4. Prioritetai</h3>
          <table className="text-sm">
            <tbody>
              {rankedPriorities.map(p => (
                <tr key={p.key}>
                  <td className="py-0.5 pr-4 text-slate-900 font-medium w-6">{pu.prioritetai[p.key]}.</td>
                  <td className="py-0.5 text-slate-700">{p.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 5: Funkcinė struktūra */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">5. Funkcinė struktūra</h3>
        <table className="w-full text-sm">
          <tbody>
            {row('Virtuvės tipas', pu.virtuveTipas ? v(pu.virtuveTipas) : undefined)}
            {row('Bendros erdvės dydis', pu.bendrosErdvesDydis ? (pu.bendrosErdvesDydis === 'kita' ? pu.bendrosErdvesDydisKita : v(pu.bendrosErdvesDydis)) : undefined)}
            {row('Lubų aukštis', pu.lubosAukstis ? (pu.lubosAukstis === 'kitas' ? pu.lubosAukstisKitas : v(pu.lubosAukstis)) : undefined)}
            {row('Sandėliukas prie virtuvės', pu.sandeliukasPrieVirtuve ? 'Taip' : undefined)}
            {row('Vaikų kambariai', pu.vaikusKambariuSk > 0 ? `${pu.vaikusKambariuSk} vnt.` : undefined)}
            {row('Darbo kambarys', pu.darbKambarys ? v(pu.darbKambarys) : undefined)}
            {row('Tėvų drabužinė', pu.drabuzine ? v(pu.drabuzine) : undefined)}
            {row('Tėvų sanitarinis mazgas', pu.tevisSmaz ? v(pu.tevisSmaz) : undefined)}
            {row('Bendras vonios kambarys', pu.bendrasVonios ? v(pu.bendrasVonios) : undefined)}
            {row('Papildomas WC', pu.papildomasWC ? 'Taip' : undefined)}
            {row('Techninė patalpa', pu.techPatalpa ? 'Taip' : undefined)}
            {row('Skalbykla', pu.skalbykla ? v(pu.skalbykla) : undefined)}
            {row('Garažas', pu.garazasAutoSk > 0 ? `${pu.garazasAutoSk} aut.${pu.garazasSprendimas ? ` – ${v(pu.garazasSprendimas)}` : ''}` : undefined)}
            {row('Kitos patalpos', pu.kitosPatalpos || undefined)}
          </tbody>
        </table>
      </div>

      {/* Section 6: Architektūriniai */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">6. Architektūriniai pasirinkimai</h3>
        <table className="w-full text-sm">
          <tbody>
            {row('Pastato charakteris', pu.pastatoCharakteris ? (pu.pastatoCharakteris === 'kita' ? pu.pastatoCharakterisKita : v(pu.pastatoCharakteris)) : undefined)}
            {row('Stogo tipas', pu.stogasTipas ? v(pu.stogasTipas) : undefined)}
            {row('Fasadų apdaila', pu.fasadai.length > 0 ? pu.fasadai.map(f => f === 'kita' ? pu.fasadaiKita || 'Kita' : v(f)).join(', ') : undefined)}
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div className="flex gap-16 mt-10 pt-6 border-t border-slate-200 text-sm">
        <div className="flex-1">
          <p className="font-semibold mb-4">STATYTOJAS:</p>
          <p className="text-slate-700">{project.client}</p>
          <div className="mt-6 border-t border-slate-400 pt-1 text-xs text-slate-400">Parašas, data</div>
        </div>
        <div className="flex-1">
          <p className="font-semibold mb-4">PROJEKTUOTOJAS:</p>
          <p className="text-slate-700">MB „KA sprendimai"</p>
          <div className="mt-6 border-t border-slate-400 pt-1 text-xs text-slate-400">Parašas, data</div>
        </div>
      </div>
    </section>
  );
}
