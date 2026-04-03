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
            <Link
              href="/projects/new"
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              + Naujas projektas
            </Link>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
