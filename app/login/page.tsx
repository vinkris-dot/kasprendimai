'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  async function submit(fullPin: string) {
    setError(false);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: fullPin }),
    });
    if (res.ok) {
      router.push('/');
    } else {
      setShaking(true);
      setError(true);
      setPin(['', '', '', '']);
      setTimeout(() => {
        setShaking(false);
        inputs.current[0]?.focus();
      }, 500);
    }
  }

  function handleChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const newPin = [...pin];
    newPin[i] = val.slice(-1);
    setPin(newPin);
    setError(false);
    if (val && i < 3) {
      inputs.current[i + 1]?.focus();
    }
    if (newPin.every(d => d !== '') && newPin.join('').length === 4) {
      submit(newPin.join(''));
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 flex flex-col items-center gap-8 w-80">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">KA sprendimai</h1>
          <p className="text-slate-400 text-sm mt-1">Įveskite PIN kodą</p>
        </div>

        <div className={`flex gap-3 ${shaking ? 'animate-shake' : ''}`}>
          {pin.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-colors
                ${error ? 'border-red-400 bg-red-50 text-red-500' : 'border-slate-200 focus:border-slate-900 bg-slate-50'}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm -mt-4">Neteisingas PIN kodas</p>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
