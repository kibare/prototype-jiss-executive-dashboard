// Aturan FPK: perbandingan versi dan siapa yang mereview ulang (tabel "Review ulang" PRD v1.2).
import type { Division, Fpk, FpkReview, FpkVersion } from './types';
import { diffDays } from './time';

export const CHECK_DIVISIONS: Division[] = ['Operasional', 'Recruitment', 'Pengadaan'];
const DONE: FpkReview['result'][] = ['cocok', 'ada_perubahan', 'selesai', 'tidak_layak'];

export interface VersionDiff {
  lines: boolean;
  site: boolean;
  value: boolean;
  period: boolean;
  startEarlier: boolean;
  startLater: boolean;
  attachments: boolean;
}

const linesKey = (v: FpkVersion) => v.lines.map(l => `${l.positionId}|${l.qty}|${l.shift}`).sort().join(';');

export const diffVersions = (a: FpkVersion, b: FpkVersion): VersionDiff => ({
  lines: linesKey(a) !== linesKey(b),
  site: a.siteId !== b.siteId,
  value: a.monthlyValue !== b.monthlyValue,
  period: a.periodStart !== b.periodStart || a.periodEnd !== b.periodEnd,
  startEarlier: diffDays(a.plannedStart, b.plannedStart) < 0,
  startLater: diffDays(a.plannedStart, b.plannedStart) > 0,
  attachments: a.attachments.map(x => x.fileName).join() !== b.attachments.map(x => x.fileName).join(),
});

export const DIFF_LABEL: Record<keyof VersionDiff, string> = {
  lines: 'Jumlah, jabatan, atau shift',
  site: 'Site',
  value: 'Nilai',
  period: 'Periode',
  startEarlier: 'Tanggal mulai dimajukan',
  startLater: 'Tanggal mulai dimundurkan',
  attachments: 'Kelengkapan dokumen',
};

export interface ReviewPlan {
  divisions: Division[];
  finance: boolean;
  /** Langsung ke BOD (tidak ada yang perlu dicek ulang). */
  toBod: boolean;
  reasons: string[];
  notifyOnly: boolean;
}

const completed = (f: Fpk, d: Division, versionNo: number) =>
  f.reviews.some(r => r.versionNo === versionNo && r.division === d && DONE.includes(r.result));

/** Tentukan siapa yang mereview versi baru setelah FPK dikembalikan. */
export const rereviewPlan = (f: Fpk, prev: FpkVersion, next: FpkVersion): ReviewPlan => {
  const d = diffVersions(prev, next);
  const divs = new Set<Division>();
  let finance = false;
  const reasons: string[] = [];
  if (d.lines || d.site) {
    CHECK_DIVISIONS.forEach(x => divs.add(x));
    finance = true;
    reasons.push(`${d.lines ? DIFF_LABEL.lines : DIFF_LABEL.site} berubah → Ops, Recruitment, Pengadaan, lalu Finance`);
  }
  if (d.value || d.period) {
    finance = true;
    reasons.push(`${[d.value && 'Nilai', d.period && 'Periode'].filter(Boolean).join(', ')} berubah → Finance`);
  }
  if (d.startEarlier) {
    CHECK_DIVISIONS.forEach(x => divs.add(x));
    reasons.push('Tanggal mulai dimajukan → Ops, Recruitment, Pengadaan');
  }
  // Review yang belum selesai di versi sebelumnya tetap harus dikerjakan.
  CHECK_DIVISIONS.forEach(x => {
    if (!completed(f, x, prev.no)) {
      divs.add(x);
      if (!reasons.some(r => r.includes('belum selesai'))) reasons.push('Review yang belum selesai di versi sebelumnya dilanjutkan');
    }
  });
  if (!completed(f, 'Finance', prev.no) && (f.returned?.fromDivision === 'Finance' || divs.size > 0)) finance = true;

  const nothingMaterial = !d.lines && !d.site && !d.value && !d.period && !d.startEarlier;
  if (nothingMaterial && divs.size === 0 && !finance) {
    const from = f.returned?.fromDivision;
    if (from && from !== 'BOD') {
      if (from === 'Finance') finance = true; else divs.add(from);
      reasons.push(d.startLater ? 'Hanya tanggal mulai dimundurkan: divisi diberi notifikasi' : 'Hanya kelengkapan dokumen → pemeriksa yang mengembalikan');
    } else {
      reasons.push(d.startLater ? 'Hanya tanggal mulai dimundurkan: tidak perlu review, divisi diberi notifikasi' : 'Hanya kelengkapan dokumen → kembali ke BOD');
    }
  }
  const divisions = CHECK_DIVISIONS.filter(x => divs.has(x));
  return { divisions, finance, toBod: divisions.length === 0 && !finance, reasons, notifyOnly: d.startLater && nothingMaterial };
};

export const SHIFTS = ['Pagi', 'Siang', 'Malam', 'Non-shift'] as const;
