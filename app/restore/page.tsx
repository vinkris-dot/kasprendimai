'use client';
import { useEffect, useState } from 'react';

const ppByla = [
  { id: 'pp-01', label: 'Titulinis lapas', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-02', label: 'Projekto dokumentų sudėties žiniaraštis (su lapų Nr.)', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-03', label: 'Bendrieji statinio rodikliai (pagal STR 5 priedą)', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-04', label: 'Aiškinamasis raštas', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-05', label: 'Projektinių pasiūlymų viešinimo informacija (jei taikoma)', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-06', label: 'Pritarimų ir sutikimų sąrašas', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-07', label: 'Prisijungimo sąlygos ir specialieji reikalavimai', category: 'I. Tekstinė ir dokumentų dalis', done: false },
  { id: 'pp-08', label: 'Sklypo situacijos schema', category: 'II. Sklypo plano sprendiniai', done: false },
  { id: 'pp-09', label: 'Sklypo planas (su sprendiniais)', category: 'II. Sklypo plano sprendiniai', done: false },
  { id: 'pp-10', label: 'Sklypo vertikalusis planas', category: 'II. Sklypo plano sprendiniai', done: false },
  { id: 'pp-11', label: 'Gaisrinių automobilių privažiavimo schema', category: 'II. Sklypo plano sprendiniai', done: false },
  { id: 'pp-12', label: 'Lietaus vandens tvarkymo schema', category: 'II. Sklypo plano sprendiniai', done: false },
  { id: 'pp-13', label: 'Planai', category: 'III. Architektūriniai sprendiniai', done: false },
  { id: 'pp-14', label: 'Pjūviai', category: 'III. Architektūriniai sprendiniai', done: false },
  { id: 'pp-15', label: 'Fasadai', category: 'III. Architektūriniai sprendiniai', done: false },
  { id: 'pp-16', label: 'Vizualizacija – vaizdas iš viešosios erdvės', category: 'III. Architektūriniai sprendiniai', done: false },
  { id: 'pp-17', label: 'Vizualizacija – pastato santykis su aplinka', category: 'III. Architektūriniai sprendiniai', done: false },
  { id: 'pp-18', label: 'Vizualizacija – aiškus mastelis (žmonės, kontekstas)', category: 'III. Architektūriniai sprendiniai', done: false },
];

const dokumentai = [
  { id: 'doc-00', number: '00', name: 'Statytojo (užsakovo) įgaliojimas', description: 'Jei PP teikia projektuotojas', received: false, notes: '' },
  { id: 'doc-01', number: '01', name: 'Projektavimo užduotis', description: '', received: false, notes: '' },
  { id: 'doc-02', number: '02', name: 'Nuosavybės teisę patvirtinantis dokumentas', description: 'NT registro išrašas arba nuomos/panaudos sutartis', received: false, notes: '' },
  { id: 'doc-03', number: '03', name: 'Žemės sklypo ribų planas', description: 'Galiojantis, sutampa su NT registro duomenimis', received: false, notes: '' },
  { id: 'doc-04', number: '04', name: 'Teritorijų planavimo dokumentų ištraukos', description: 'Detalusis/bendrasis planas, reglamentų santrauka', received: false, notes: '' },
  { id: 'doc-05', number: '05', name: 'Specialieji reikalavimai (SR)', description: 'Pateikti jei išduoti, sprendiniai atitinka SAR', received: false, notes: '' },
  { id: 'doc-06', number: '06', name: 'Prisijungimo sąlygos', description: 'Vandentiekis/nuotekos, elektros tinklai, dujos, susisiekimo komunikacijos', received: false, notes: '' },
  { id: 'doc-07', number: '07', name: 'Topografinė nuotrauka (toponuotrauka)', description: 'Aktualizuota, su galiojančiu derinimu', received: false, notes: '' },
  { id: 'doc-08', number: '08', name: 'Projektavimo įmonės registravimo dokumentai', description: 'Juridinio asmens registracijos duomenys', received: false, notes: '' },
  { id: 'doc-09', number: '09', name: 'Civilinės atsakomybės draudimas', description: 'Projektavimo veiklos, galiojantis', received: false, notes: '' },
  { id: 'doc-10', number: '10', name: 'Naudotos projektavimo programinės įrangos sąrašas', description: 'Visos programos, licencijuota, nurodytas projektas ir adresas', received: false, notes: '' },
  { id: 'doc-11', number: '11', name: 'Projekto vadovo paskyrimo dokumentas', description: '', received: false, notes: '' },
  { id: 'doc-12', number: '12', name: 'Projekto vadovo kvalifikacijos atestatas', description: 'Galiojantis, sritis atitinka statinį, duomenys sutampa su Infostatyba', received: false, notes: '' },
  { id: 'doc-13', number: '13', name: 'Gretimo sklypo sutikimai dėl neišlaikomo norminio atstumo', description: 'Jei statinys neišlaiko norminių atstumų iki kaimyninio sklypo', received: false, notes: '' },
  { id: 'doc-14', number: '14', name: 'Apjungimas į bendrą gaisrinį skyrių', description: 'Sutikimas dėl apjungimo su gretimo pastato gaisriniu skyriumi', received: false, notes: '' },
  { id: 'doc-15', number: '15', name: 'Bendraturčių sutikimai', description: 'Bendrosios nuosavybės dalyvių raštiški sutikimai', received: false, notes: '' },
  { id: 'doc-16', number: '16', name: 'Sutikimai', description: 'Kiti reikalingi sutikimai (nurodyti SR)', received: false, notes: '' },
];

const selectedParts = { PP: true, VIESIMAS: false, IP: false, SLD: true, TDP: true, BD: false, SP: false, SA: false, SK: false, LVN: false, PAKARTOTINIS: false, EKSPERTIZE: true, KITA: false, KITA_days: 14 };
const stageAssignees = { SR: ['NR'], PP: ['KV', 'NR'], PP_VIESIMAS: ['NR'], IP: ['NR'], SLD: ['NR'], PAKARTOTINIS: ['NR'], TDP: ['LL'], EKSPERTIZE: ['NR'] };

const addresses = [
  'Aitvarų g. 13, Didvyrių k., Kauno r. sav.',
  'Aitvarų g. 15, Didvyrių k., Kauno r. sav.',
  'Akmens g. 10, Karkazų k., Kauno r. sav.',
  'Ateities pl. 21, Bendorių k., Vilniaus r. sav.',
  'Frenkelių g. 1, Šiauliai',
  'Girios g. 21, Kaunas',
  'Islandijos pl. 121, Kaunas',
  'Kalnelių g. 5, Kaunas',
  'Kauno g. 12, Marijampolė',
  'Kopų gatvė, Virbališkių k., Kauno r. sav.',
  'Liepų g. 1, Jonava',
  'Liepų g. 34, Garliava',
  'Lubinų kvartalas, Mastaičių k., Kauno r. sav.',
  'Medeinos g. 13, Mitkūnų k., Kauno r. sav.',
  'Miglės g. 15, Pyplių k., Kauno r. sav.',
  'Nemuno g. 12A, Vilkija, Kauno r. sav.',
  'Obelų g., Giraitės k., Kauno r. sav.',
  'Pavasario g. 23, Domeikavos k., Kauno r. sav.',
  'Pavasario g. 23A, Domeikavos k., Kauno r. sav.',
  'Partizanų g. 144, Kaunas',
  'Perkūno al. 28, Kaunas',
  'Pievų g. 1, Ringaudų k., Kauno r. sav.',
  'Sėkmės g. namai',
  'Sporto g. 5, Kėdainiai',
  'Statybininkų g. 4, Alytus',
  'Taikos per. 96C, Kaunas',
  'J. Vienožinskio g. 73, 75, Kaunas',
  'Žirgyno g. 14A, Margavos k., Kauno r. sav.',
  'Žemaičių pl. 21C, 21B',
  'Ūkininkas',
];

export default function RestorePage() {
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  function restore() {
    const now = new Date().toISOString();
    const projects = addresses.map(a => ({
      id: crypto.randomUUID(),
      name: a,
      address: a,
      client: '',
      clientEmail: '',
      activeStages: ['SR'],
      startDate: '2026-01-01',
      targetConstructionDate: '2026-08-20',
      selectedParts,
      ppByla: JSON.parse(JSON.stringify(ppByla)),
      dokumentai: JSON.parse(JSON.stringify(dokumentai)),
      motyvuotiAtsakymai: [],
      stageStatuses: {},
      partStatuses: {},
      stageAssignees,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }));
    localStorage.setItem('openclaw_projects', JSON.stringify(projects));
    setStatus('done');
    setTimeout(() => { window.location.href = '/'; }, 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-md w-full shadow-sm">
        {status === 'idle' ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Projektų atkūrimas</h1>
            <p className="text-sm text-slate-500 mb-6">
              Bus sukurti <strong>30 projektų</strong> iš projektu sąrašo.<br />
              Detalės (klientas, datos, etapai) — tuščios, reikės suvesti.
            </p>
            <button
              onClick={restore}
              className="bg-slate-900 text-white px-8 py-3 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Atkurti projektus
            </button>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Sukurta 30 projektų</h1>
            <p className="text-sm text-slate-500">Nukreipiama į pagrindinį puslapį...</p>
          </>
        )}
      </div>
    </div>
  );
}
