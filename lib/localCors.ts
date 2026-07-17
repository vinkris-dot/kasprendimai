import { NextResponse } from 'next/server';

// CORS lokaliems pagalbiniams maršrutams: produkcijos puslapis (Vercel) kviečia
// lokalų serverį Kristinos kompiuteryje (localhost:3001) veiksmams, kuriems
// reikia jos disko — aplankų kūrimui ir didelių failų įkėlimui (Vercel priima
// tik ~4,5 MB). Leidžiamas tik produkcijos domenas.
export const LOCAL_CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://kasprendimai-sigma.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const corsJson = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: LOCAL_CORS_HEADERS });

export const corsPreflight = () =>
  new NextResponse(null, { status: 204, headers: LOCAL_CORS_HEADERS });
