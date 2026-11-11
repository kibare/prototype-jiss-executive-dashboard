// Hitungan turunan yang dipakai beberapa layar.
import type { Fpk, Personnel, Spk, Site } from './types';
import { TODAY, diffDays, heldValue } from './time';

export const latest = (f: Fpk) => f.versions[f.versions.length - 1];

/** SPK yang berlaku hari ini (aktif dan dalam periode). Addendum menggantikan isi induknya sejak tanggal berlaku. */
export const effectiveSpks = (spks: Spk[], today = TODAY) => {
  const active = spks.filter(s => s.status === 'aktif' && diffDays(s.periodStart, today) >= 0 && diffDays(today, s.periodEnd) >= 0);
  const superseded = new Set<string>();
  active.forEach(s => {
    if (s.type === 'addendum' && s.parentSpkId && diffDays(s.effectiveDate ?? s.periodStart, today) >= 0) superseded.add(s.parentSpkId);
  });
  return active.filter(s => !superseded.has(s.id));
};

export const spkHeadcount = (s: Spk) => s.lines.reduce((n, l) => n + l.qty, 0);
export const fpkHeadcount = (f: Fpk) => latest(f).lines.reduce((n, l) => n + l.qty, 0);

/** Kuota per jabatan dari SPK yang berlaku di sekumpulan site. */
export const quotaByPosition = (spks: Spk[], siteIds: Set<string>) => {
  const q = new Map<string, number>();
  effectiveSpks(spks).filter(s => siteIds.has(s.siteId)).forEach(s =>
    s.lines.forEach(l => q.set(l.positionId, (q.get(l.positionId) ?? 0) + l.qty)),
  );
  return q;
};

export const currentPlacement = (p: Personnel) => p.placements.find(x => !x.end);

/** Security aktif per jabatan di area (dan site bila diisi). */
export const activeByPosition = (personnel: Personnel[], areaId: string, siteId?: string) => {
  const m = new Map<string, number>();
  personnel.forEach(p => {
    const pl = currentPlacement(p);
    if (p.status !== 'aktif' || !pl || pl.areaId !== areaId) return;
    if (siteId && pl.siteId !== siteId) return;
    m.set(p.positionId, (m.get(p.positionId) ?? 0) + 1);
  });
  return m;
};

/** Jumlah orang per baris FPK yang sudah tertutup SPK aktif. */
export const fpkCoverage = (f: Fpk, spks: Spk[]) => {
  const v = latest(f);
  const covered = new Map<string, number>();
  spks.filter(s => s.fpkId === f.id && s.status === 'aktif').forEach(s =>
    s.lines.forEach(l => l.fpkLineId && covered.set(l.fpkLineId, (covered.get(l.fpkLineId) ?? 0) + l.qty)),
  );
  const lines = v.lines.map(l => ({ line: l, covered: Math.min(covered.get(l.id) ?? 0, l.qty) }));
  const total = lines.reduce((n, x) => n + x.line.qty, 0);
  const done = lines.reduce((n, x) => n + x.covered, 0);
  return { lines, total, done };
};

export interface WithoutSpk {
  fpk: Fpk;
  site?: Site;
  from: string;
  days: number;
  /** Nilai per bulan bagian yang belum tertutup SPK aktif (proporsional jumlah orang). */
  openMonthly: number;
  held: number;
  pendingSpk?: Spk;
}

/** Jalan tanpa SPK: FPK yang sudah mulai jaga tapi kuotanya belum seluruhnya tertutup SPK aktif. */
export const withoutSpkList = (fpks: Fpk[], spks: Spk[], sites: Site[], today = TODAY): WithoutSpk[] =>
  fpks
    .filter(f => (f.status === 'berjalan' || f.status === 'tertutup_sebagian') && f.startedAt)
    .map(f => {
      const cov = fpkCoverage(f, spks);
      const openShare = cov.total ? (cov.total - cov.done) / cov.total : 0;
      const v = latest(f);
      const openMonthly = v.monthlyValue * openShare;
      const from = f.startedAt!;
      return {
        fpk: f,
        site: sites.find(s => s.id === v.siteId),
        from,
        days: diffDays(from, today) + 1,
        openMonthly,
        held: heldValue(openMonthly, from, today),
        pendingSpk: spks.find(s => s.fpkId === f.id && (s.status === 'diinput' || s.status === 'perlu_revisi')),
      };
    })
    .filter(x => x.openMonthly > 0);
