// Perbandingan SPK dengan FPK untuk layar verifikasi Finance.
import type { Fpk, Spk } from './types';
import { latest } from './selectors';

export interface FieldDiff {
  field: string;
  spk: string;
  fpk: string;
  same: boolean;
  money?: boolean;
}

export const compareSpkFpk = (
  s: Spk,
  f: Fpk,
  names: { company: (id: string) => string; site: (id: string) => string; position: (id: string) => string; date: (d: string) => string; rp: (n: number) => string },
): FieldDiff[] => {
  const v = latest(f);
  const fpkHead = v.lines.reduce((n, l) => n + l.qty, 0);
  const spkHead = s.lines.reduce((n, l) => n + l.qty, 0);
  // SPK sebagian: nilai yang diharapkan proporsional terhadap jumlah orang yang ditutup.
  const expected = fpkHead ? (v.monthlyValue * spkHead) / fpkHead : v.monthlyValue;
  const rows: FieldDiff[] = [
    { field: 'PT', spk: names.company(s.companyId), fpk: names.company(v.companyId), same: s.companyId === v.companyId },
    { field: 'Site', spk: names.site(s.siteId), fpk: names.site(v.siteId), same: s.siteId === v.siteId },
    { field: 'Periode mulai', spk: names.date(s.periodStart), fpk: names.date(f.startedAt ?? v.periodStart), same: s.periodStart === (f.startedAt ?? v.periodStart) },
    { field: 'Periode selesai', spk: names.date(s.periodEnd), fpk: names.date(v.periodEnd), same: s.periodEnd === v.periodEnd },
    spkHead < fpkHead
      ? {
        // SPK sebagian: harga per jabatan bisa berbeda, jadi angka FPK hanya perkiraan; Finance cek manual ke BOQ.
        field: `Nilai per bulan (SPK sebagian ${spkHead}/${fpkHead} orang, cek manual ke BOQ)`,
        spk: names.rp(s.monthlyValue), fpk: `± ${names.rp(expected)}`, same: true, money: true,
      }
      : { field: 'Nilai per bulan', spk: names.rp(s.monthlyValue), fpk: names.rp(v.monthlyValue), same: s.monthlyValue === v.monthlyValue, money: true },
  ];
  s.lines.forEach(l => {
    const fl = v.lines.find(x => x.id === l.fpkLineId);
    rows.push({
      field: `Baris: ${names.position(l.positionId)} · ${l.shift}`,
      spk: `${l.qty} orang`,
      fpk: fl ? `${names.position(fl.positionId)} · ${fl.shift} · ${fl.qty} orang` : 'tidak ada baris FPK yang cocok',
      same: !!fl && fl.positionId === l.positionId && fl.shift === l.shift && l.qty <= fl.qty,
    });
  });
  return rows;
};

/** Perpanjangan tanpa FPK induk (SPK induk data awal): bandingkan dengan SPK induk dan memo yang disetujui klien. */
export const compareSpkParent = (
  s: Spk,
  parent: Spk,
  expected: { periodStart: string; periodEnd: string; value: number } | undefined,
  names: { company: (id: string) => string; site: (id: string) => string; position: (id: string) => string; date: (d: string) => string; rp: (n: number) => string },
): FieldDiff[] => {
  const rows: FieldDiff[] = [
    { field: 'PT', spk: names.company(s.companyId), fpk: names.company(parent.companyId), same: s.companyId === parent.companyId },
    { field: 'Site', spk: names.site(s.siteId), fpk: names.site(parent.siteId), same: s.siteId === parent.siteId },
  ];
  if (expected) {
    rows.push(
      { field: 'Periode mulai (memo)', spk: names.date(s.periodStart), fpk: names.date(expected.periodStart), same: s.periodStart === expected.periodStart },
      { field: 'Periode selesai (memo)', spk: names.date(s.periodEnd), fpk: names.date(expected.periodEnd), same: s.periodEnd === expected.periodEnd },
      { field: 'Nilai per bulan (memo)', spk: names.rp(s.monthlyValue), fpk: names.rp(expected.value), same: s.monthlyValue === expected.value, money: true },
    );
  }
  s.lines.forEach(l => {
    const pl = parent.lines.find(x => x.positionId === l.positionId && x.shift === l.shift);
    rows.push({
      field: `Baris: ${names.position(l.positionId)} · ${l.shift}`, spk: `${l.qty} orang`,
      fpk: pl ? `${pl.qty} orang (SPK induk)` : 'tidak ada di SPK induk', same: !!pl && pl.qty === l.qty,
    });
  });
  return rows;
};
