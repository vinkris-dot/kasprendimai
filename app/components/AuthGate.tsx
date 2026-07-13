'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Prisijungimo vartai: be sesijos rodo prisijungimo formą (magic link į el. paštą).
 * Tikroji apsauga — Supabase RLS (duomenys pasiekiami tik prisijungusiems);
 * šis komponentas tik UI sluoksnis.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setStatus(data.session ? 'in' : 'out'));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'in' : 'out');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
    if (err) setError('Nepavyko išsiųsti nuorodos. Patikrinkite el. pašto adresą — prieigą turi tik pakviesti naudotojai.');
    else setSent(true);
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Prisijungimas</h1>
        <p className="text-sm text-slate-500 mb-6">Įveskite savo el. paštą — atsiųsime prisijungimo nuorodą.</p>
        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
            ✓ Nuoroda išsiųsta į <strong>{email}</strong>. Atidarykite laišką ir paspauskite nuorodą.
          </div>
        ) : (
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
              {sending ? 'Siunčiama…' : 'Gauti prisijungimo nuorodą'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
