'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(fullPin: string) {
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
      setPin('');
      setTimeout(() => {
        setShaking(false);
        inputRef.current?.focus();
      }, 500);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setError(false);
    if (val.length === 4) {
      submit(val);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 flex flex-col items-center gap-8 w-80">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">KA sprendimai</h1>
          <p className="text-slate-400 text-sm mt-1">Įveskite PIN kodą</p>
        </div>

        {/* Hidden real input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={handleChange}
          className="absolute opacity-0 w-0 h-0"
        />

        {/* Visual PIN dots */}
        <div
          className={`flex gap-3 cursor-pointer ${shaking ? 'animate-shake' : ''}`}
          onClick={() => inputRef.current?.focus()}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors
                ${error
                  ? 'border-red-400 bg-red-50'
                  : pin.length > i
                    ? 'border-slate-900 bg-slate-900'
                    : 'border-slate-200 bg-slate-50'
                }`}
            >
              {pin.length > i && <span className="text-white">●</span>}
            </div>
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
