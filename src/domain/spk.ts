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
