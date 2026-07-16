/**
 * Šiandienos data Lietuvos laiku (YYYY-MM-DD).
 * `new Date().toISOString().slice(0, 10)` grąžina UTC datą — Vilniuje (UTC+2/+3)
 * tarp vidurnakčio ir ~03:00 ji būtų vakarykštė, todėl „šiandien", vėlavimų ir
 * terminų logika naktį persislinkdavo per vieną dieną.
 */
export function todayLT(): string {
  return new Intl.DateTimeFormat('lt-LT', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Prideda dienų prie YYYY-MM-DD eilutės (UTC aritmetika — nepriklauso nuo vietos juostos). */
export function addDaysStr(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
