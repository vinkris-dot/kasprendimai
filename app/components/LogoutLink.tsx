'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Rodo „Atsijungti" viršutinėje juostoje, kai naudotojas prisijungęs. */
export default function LogoutLink() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!signedIn) return null;
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="text-sm text-slate-400 hover:text-slate-700 transition-colors hidden sm:inline"
      title="Atsijungti"
    >
      Atsijungti
    </button>
  );
}
