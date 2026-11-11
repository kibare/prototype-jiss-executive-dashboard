// Perbandingan SPK dengan FPK untuk layar verifikasi Finance.
import type { Fpk, Spk } from './types';
import { latest } from './selectors';
import { diffDays } from './time';

/**
 * Periode mulai SPK dibanding mulai jaga (atau periode FPK bila belum mulai jaga).
 * SPK yang mulai lebih lambat tetap cocok: selisih harinya dicatat sebagai hari tidak tertagih (PRD SPK no. 3).
 * Yang dianggap beda hanya SPK yang mulai lebih awal dari acuan.
 */
const periodStartRow = (s: Spk, startedAt: string | undefined, fpkStart: string, date: (d: string) => string): FieldDiff => {
  const base = startedAt ?? fpkStart;
  const gap = diffDays(base, s.periodStart);
  const ref = startedAt ? `mulai jaga ${date(startedAt)}` : date(fpkStart);
  return {
    field: 'Periode mulai',
    spk: date(s.periodStart),
    fpk: gap > 0 && startedAt ? `${ref} · ${gap} hari tidak tertagih` : gap > 0 ? `${ref} · SPK mulai lebih lambat` : ref,
    same: gap >= 0,
  };
};

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
  /** Jumlah orang per baris FPK yang sudah tertutup SPK aktif lain (tanpa SPK ini dan SPK induk bila ini addendum). */
  coveredByOthers: Map<string, number>,
  names: { site: (id: string) => string; position: (id: string) => string; date: (d: string) => string; rp: (n: number) => string },
): FieldDiff[] => {
  const v = latest(f);
  const fpkHead = v.lines.reduce((n, l) => n + l.qty, 0);
  const spkHead = s.lines.reduce((n, l) => n + l.qty, 0);
  // SPK sebagian: nilai yang diharapkan proporsional terhadap jumlah orang yang ditutup.
  const expected = fpkHead ? (v.monthlyValue * spkHead) / fpkHead : v.monthlyValue;
  const rows: FieldDiff[] = [
    { field: 'Site', spk: names.site(s.siteId), fpk: names.site(v.siteId), same: s.siteId === v.siteId },
    periodStartRow(s, f.startedAt, v.periodStart, names.date),
    { field: 'Periode selesai', spk: names.date(s.periodEnd), fpk: names.date(v.periodEnd), same: s.periodEnd === v.periodEnd },
    spkHead < fpkHead
      ? {
        // SPK sebagian: harga per jabatan bisa berbeda, jadi angka FPK hanya perkiraan; Finance cek manual ke BOQ.
        field: `Nilai per bulan (SPK sebagian ${spkHead}/${fpkHead} orang, cek manual ke BOQ)`,
        spk: names.rp(s.monthlyValue), fpk: `± ${names.rp(expected)}`, same: true, money: true,
      }
      : { field: 'Nilai per bulan (sebelum PPN)', spk: names.rp(s.monthlyValue), fpk: names.rp(v.monthlyValue), same: s.monthlyValue === v.monthlyValue, money: true },
  ];
  s.lines.forEach(l => {
    const fl = v.lines.find(x => x.id === l.fpkLineId);
    const left = fl ? fl.qty - (coveredByOthers.get(fl.id) ?? 0) : 0;
    rows.push({
      field: `Baris: ${names.position(l.positionId)} · ${l.shift}`,
      spk: `${l.qty} orang`,
      fpk: fl ? `${names.position(fl.positionId)} · ${fl.shift} · sisa ${left} dari ${fl.qty} orang` : 'tidak ada baris FPK yang cocok',
      same: !!fl && fl.positionId === l.positionId && fl.shift === l.shift && l.qty <= left,
    });
  });
  return rows;
};

/** Perpanjangan tanpa FPK induk (SPK induk data awal): bandingkan dengan SPK induk dan memo yang disetujui klien. */
export const compareSpkParent = (
  s: Spk,
  parent: Spk,
  expected: { periodStart: string; periodEnd: string; value: number } | undefined,
  names: { site: (id: string) => string; position: (id: string) => string; date: (d: string) => string; rp: (n: number) => string },
): FieldDiff[] => {
  const rows: FieldDiff[] = [
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
