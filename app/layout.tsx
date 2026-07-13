import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'KA sprendimai – Projektų valdymas',
  description: 'Architektūrinių projektų valdymo sistema',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt" style={{ colorScheme: 'light', background: '#f8fafc' }}>
      <body className="min-h-screen text-slate-900 antialiased" style={{ background: '#f8fafc' }}>
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold text-slate-800 tracking-tight text-lg">
              KA sprendimai
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/#sec-paused" title="Pristabdyti projektai" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                <span className="hidden sm:inline">Pristabdyti</span>
              </Link>
              <Link href="/#sec-archived" title="Archyvas" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                <span className="hidden sm:inline">Archyvas</span>
              </Link>
              <Link
                href="/projects/new"
                className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                + Naujas projektas
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
