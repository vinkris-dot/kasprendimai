'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Prisijungimo vartai: be sesijos rodo prisijungimo formą (magic link į el. paštą).
 * Tikroji apsauga — Supabase RLS (duomenys pasiekiami tik prisijungusiems);
 * šis komponentas tik UI sluoksnis.
 *
 * Kodas iš laiško (2026-07-17): Dock/PWA programėlė turi ATSKIRĄ saugyklą nuo
 * naršyklės — magic-link nuoroda visada atsidaro naršyklėje, tad programėlė
 * lieka neprisijungusi. Todėl šalia nuorodos priimamas ir vienkartinis kodas
 * ({{ .Token }} Supabase Magic Link šablone) — įvedamas tiesiai programėlėje.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setStatus(data.session ? 'in' : 'out'));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'in' : 'out');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Dev apėjimas naršyklės patikroms be sesijos: veikia TIK development
  // build'e ir tik su aiškiu NEXT_PUBLIC_DEV_NO_AUTH=1 (.env.local).
  // Produkcijoje išsikompiliuoja į false; duomenis vis tiek saugo RLS.
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_NO_AUTH === '1') {
    return <>{children}</>;
  }

  if (status === 'checking') return null;
  if (status === 'in') return <>{children}</>;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (err) {
      // Rodome tikrą priežastį — bendrinis tekstas slėpė laiškų kvotos limitą
      // (įmontuotas Supabase paštas leidžia vos kelis laiškus per valandą)
      const code = (err as { code?: string }).code ?? '';
      const status = (err as { status?: number }).status;
      if (code === 'over_email_send_rate_limit' || status === 429) {
        setError('Per daug laiškų per trumpą laiką — leidžiami tik keli per valandą. Palaukite ~valandą arba įveskite kodą iš jau gauto laiško (žemiau).');
      } else if (/signup/i.test(err.message ?? '')) {
        setError('Šis el. paštas neturi prieigos — ją turi tik pakviesti naudotojai.');
      } else {
        setError(`Nepavyko išsiųsti laiško. ${err.message ?? ''}`);
      }
      return;
    }
    setSent(true);
  }

  // Kodo patvirtinimas vyksta ČIA, be jokio peradresavimo — todėl sesija
  // atsiranda būtent toje programoje/naršyklėje, kurioje įvestas kodas.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setVerifying(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setVerifying(false);
    if (err) setError('Kodas netinka arba baigėsi jo galiojimas. Užsisakykite naują laišką ir bandykite dar kartą.');
    // Pavykus onAuthStateChange perjungia į „in" automatiškai
  }

  const codeForm = (
    <form onSubmit={verifyCode} className="space-y-3">
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="el. paštas"
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      <input
        type="text"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="kodas iš laiško (6 skaitmenys)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={verifying}
        className="w-full bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        {verifying ? 'Tikrinama…' : 'Prisijungti su kodu'}
      </button>
    </form>
  );

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Prisijungimas</h1>
        <p className="text-sm text-slate-500 mb-6">Įveskite savo el. paštą — atsiųsime prisijungimo laišką.</p>
        {sent ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
              ✓ Laiškas išsiųstas į <strong>{email}</strong>. Naršyklėje — spauskite nuorodą;
              programėlėje (Dock) — įveskite kodą iš laiško žemiau.
            </div>
            {codeForm}
            <button
              onClick={() => { setSent(false); setCode(''); setError(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Siųsti laišką iš naujo
            </button>
          </div>
        ) : showCode ? (
          <div className="space-y-4">
            {codeForm}
            <button
              onClick={() => { setShowCode(false); setError(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Neturiu kodo — siųsti laišką
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={sendLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="el. paštas"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {sending ? 'Siunčiama…' : 'Gauti prisijungimo laišką'}
              </button>
            </form>
            <button
              onClick={() => { setShowCode(true); setError(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Jau turiu kodą iš laiško
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
