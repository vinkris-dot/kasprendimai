import { describe, it, expect } from 'vitest';
import { calcTargetDate, calcStageDates, calcEffectiveStageDates, calcEffectiveTargetDate, calcCustomPartDates, validStageIds } from './defaultData';
import { tdpBlockDays, tdpPartOffsetDays } from './schedule';
import { SelectedParts, CustomPart } from './types';

// SVARBU: testai leidžiami su TZ=Europe/Vilnius (žr. package.json „test" skriptą),
// nes datų aritmetika naudoja lokalų laiką ir rezultatai priklauso nuo juostos.

const base: SelectedParts = {
  DP: false, DP_days: 84, PP: true, VIESIMAS: false, IP: false, SLD: true, TDP: true,
  BD: false, SP: true, SA: true, SK: false, LVN: false, PAKARTOTINIS: false, EKSPERTIZE: false,
  KITA: false, KITA_days: 14,
  T: false, VN: false, SVOK: false, E: false, ER: false, GSS: false, GS: false, SO: false, KS: false,
};
const start = '2026-01-01';

const seq: CustomPart = { id: 'c1', name: 'Geotyrimai', weeks: 4, parallel: false };
const par: CustomPart = { id: 'c2', name: 'Akustika', weeks: 2, parallel: true };

describe('calcTargetDate', () => {
  it('bazinis PP+SLD+TDP(SP,SA)', () => {
    expect(calcTargetDate(start, base)).toBe('2026-05-13');
  });
  it('DP 12 sav. telpa į SR+PP langą — termino nekeičia', () => {
    expect(calcTargetDate(start, { ...base, DP: true, DP_days: 84 })).toBe('2026-05-13');
  });
  it('DP 16 sav. ilgesnis už SR+PP — pastumia SLD/TDP (+21 d.)', () => {
    expect(calcTargetDate(start, { ...base, DP: true, DP_days: 112 })).toBe('2026-06-03');
  });
  it('nuosekli papildoma dalis 4 sav. prideda +28 d.', () => {
    expect(calcTargetDate(start, base, [seq])).toBe('2026-06-10');
  });
  it('lygiagreti papildoma dalis 2 sav. telpa TDP bloke — termino nekeičia', () => {
    expect(calcTargetDate(start, base, [par])).toBe('2026-05-13');
  });
  it('KITA prideda savo dienas', () => {
    expect(calcTargetDate(start, { ...base, KITA: true, KITA_days: 21 })).toBe('2026-06-03');
  });
  it('pilna grandinė (viešinimas, IP, pakartotinis, ekspertizė, visos TDP dalys)', () => {
    // 2026-07-16 fazės: SA 14 + SP 7 + max(SK 42, LVN 28) + BD 7 = 70 d. TDP blokas
    expect(calcTargetDate(start, { ...base, VIESIMAS: true, IP: true, PAKARTOTINIS: true, EKSPERTIZE: true, SK: true, LVN: true, BD: true })).toBe('2026-10-07');
  });
});

describe('calcStageDates', () => {
  it('bazinės etapų datos', () => {
    expect(calcStageDates(start, base)).toEqual({
      SR: { startDate: '2026-01-01', endDate: '2026-02-05' },
      PP: { startDate: '2026-02-05', endDate: '2026-04-01' },
      SLD: { startDate: '2026-04-01', endDate: '2026-05-13' },
      TDP: { startDate: '2026-04-01', endDate: '2026-04-22' }, // SA 14 + SP 7 = 21 d.
    });
  });
  it('ilgas DP pastumia SLD/TDP pradžią iki DP pabaigos', () => {
    expect(calcStageDates(start, { ...base, DP: true, DP_days: 112 })).toEqual({
      DP: { startDate: '2026-01-01', endDate: '2026-04-22' },
      SR: { startDate: '2026-01-01', endDate: '2026-02-05' },
      PP: { startDate: '2026-02-05', endDate: '2026-04-01' },
      SLD: { startDate: '2026-04-22', endDate: '2026-06-03' },
      TDP: { startDate: '2026-04-22', endDate: '2026-05-13' },
    });
  });
});

describe('calcCustomPartDates', () => {
  it('nuosekli — grandinės gale; lygiagreti — TDP bloke po SP/SA', () => {
    expect(calcCustomPartDates(start, base, [seq, par])).toEqual({
      c1: { startDate: '2026-05-13', endDate: '2026-06-10' },
      c2: { startDate: '2026-04-22', endDate: '2026-05-06' },
    });
  });
});

describe('TDP fazės: SA → SP → ∥(SK,LVN,E) → ŠVOK → ∥(kitos) → BD', () => {
  const full: SelectedParts = { ...base, SK: true, LVN: true, E: true, SVOK: true, VN: true, BD: true };
  it('bloko trukmė — fazių suma', () => {
    // SA 14 + SP 7 + max(SK 42, LVN 28, E 28) + ŠVOK 28 + max(VN 28) + BD 7 = 126
    expect(tdpBlockDays(full)).toBe(126);
    expect(tdpBlockDays(base)).toBe(21); // SA 14 + SP 7
    expect(tdpBlockDays({ ...base, SA: false, SP: false })).toBe(14); // bazė be dalių
  });
  it('dalių poslinkiai pagal fazes', () => {
    expect(tdpPartOffsetDays(full, 'SA')).toBe(0);
    expect(tdpPartOffsetDays(full, 'SP')).toBe(14);
    expect(tdpPartOffsetDays(full, 'SK')).toBe(21);  // po SA+SP
    expect(tdpPartOffsetDays(full, 'E')).toBe(21);   // lygiagrečiai su SK
    expect(tdpPartOffsetDays(full, 'SVOK')).toBe(63); // po max(SK 42)
    expect(tdpPartOffsetDays(full, 'VN')).toBe(91);  // po ŠVOK
    expect(tdpPartOffsetDays(full, 'BD')).toBe(119); // pačioje pabaigoje
  });
});

describe('validStageIds', () => {
  it('įtraukia DP kai pasirinktas (apsauga nuo DP išmetimo migracijoje)', () => {
    expect(validStageIds({ ...base, DP: true })).toContain('DP');
    expect(validStageIds(base)).not.toContain('DP');
  });
  it('bazinis rinkinys atitinka pasirinktas dalis', () => {
    expect(validStageIds(base).sort()).toEqual(['PP', 'SLD', 'SR', 'TDP']);
  });
});

describe('calcEffectiveStageDates', () => {
  it('vėluojanti SR faktinė pabaiga stumia visus tolesnius etapus', () => {
    expect(calcEffectiveStageDates(start, base, {
      SR: { startDate: '2026-01-01', endDate: '2026-03-01', completed: true, notes: '' },
    })).toEqual({
      SR: { startDate: '2026-01-01', endDate: '2026-03-01' },
      PP: { startDate: '2026-03-01', endDate: '2026-04-25', isShifted: true },
      SLD: { startDate: '2026-04-25', endDate: '2026-06-06', isShifted: true },
      TDP: { startDate: '2026-04-25', endDate: '2026-05-16', isShifted: true },
    });
  });
  it('faktinė TDP pabaiga: lygiagreti papildoma dalis bloko nebepratęsia', () => {
    expect(calcEffectiveStageDates(start, base, {
      TDP: { startDate: '2026-04-01', endDate: '2026-04-20', completed: true, notes: '' },
    }, [par])).toEqual({
      SR: { startDate: '2026-01-01', endDate: '2026-02-05' },
      PP: { startDate: '2026-02-05', endDate: '2026-04-01', isShifted: false },
      SLD: { startDate: '2026-04-01', endDate: '2026-05-13', isShifted: false },
      TDP: { startDate: '2026-04-01', endDate: '2026-04-20', isShifted: false },
    });
  });
  it('vykstančio etapo faktinė pradžia (be pabaigos) peranchoruoja jo langą ir tolesnius', () => {
    // PP faktiškai pradėtas 2026-03-01 (planas buvo 02-05) — langas 03-01 + 56 d.
    expect(calcEffectiveStageDates(start, base, {
      PP: { startDate: '2026-03-01', endDate: '', completed: false, notes: '' },
    })).toEqual({
      SR: { startDate: '2026-01-01', endDate: '2026-02-05' },
      PP: { startDate: '2026-03-01', endDate: '2026-04-25', isShifted: true },
      SLD: { startDate: '2026-04-25', endDate: '2026-06-06', isShifted: true },
      TDP: { startDate: '2026-04-25', endDate: '2026-05-16', isShifted: true },
    });
  });
});

describe('calcEffectiveTargetDate', () => {
  it('be faktų sutampa su planiniu', () => {
    expect(calcEffectiveTargetDate(start, base, {})).toBe(calcTargetDate(start, base));
  });
  it('faktinė vykstančio etapo pradžia stumia statybos pradžią', () => {
    // PP nuo 2026-03-01: +56 d. → 04-25; SLD ∥ TDP nuo ten (max 42 d.) → 06-06
    expect(calcEffectiveTargetDate(start, base, {
      PP: { startDate: '2026-03-01', endDate: '', completed: false, notes: '' },
    })).toBe('2026-06-06');
  });
});
