// Fungsi tanggal bersama (PRD: satu fungsi hari kerja untuk semua modul, zona WIB).
import type { Holiday } from './types';

/** Tanggal simulasi prototipe. Bisa dimajukan lewat kontrol simulasi (live binding ES module). */
export const SEED_TODAY = '2026-11-12';
export let TODAY = SEED_TODAY;
export let NOW = '2026-11-12 09:00';
export const setToday = (d: string) => {
  TODAY = d;
  NOW = `${d} 09:00`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const toDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};

export const diffDays = (fromIso: string, toIso_: string) =>
  Math.round((toDate(toIso_).getTime() - toDate(fromIso).getTime()) / 86400000);

export const isWorkday = (iso: string, holidays: Holiday[]) => {
  const dow = toDate(iso).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays.some(h => h.date === iso);
};

/** n hari kerja setelah tanggal X. */
export const addWorkdays = (iso: string, n: number, holidays: Holiday[]) => {
  let d = iso.slice(0, 10);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkday(d, holidays)) left--;
  }
  return d;
};

/** H-n dari tanggal X (hari kalender). */
export const hMinus = (iso: string, n: number) => addDays(iso, -n);

export const fmtDate = (iso?: string) => {
  if (!iso) return '–';
  const d = toDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const fmtDateTime = (s?: string) => {
  if (!s) return '–';
  const time = s.length > 10 ? s.slice(11, 16) : '';
  return `${fmtDate(s)}${time ? `, ${time}` : ''}`;
};

export const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * Nilai tertahan jalan tanpa SPK: nilai per bulan ÷ hari kalender bulan itu × jumlah hari,
 * dihitung per bulan lalu dijumlah. Rentang inklusif [start, end].
 */
export const heldValue = (monthlyValue: number, start: string, end: string) => {
  if (diffDays(start, end) < 0) return 0;
  let total = 0;
  let cursor = start;
  while (diffDays(cursor, end) >= 0) {
    const d = toDate(cursor);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const dim = daysInMonth(y, m);
    const monthEnd = toIso(new Date(Date.UTC(y, m, dim)));
    const segEnd = diffDays(monthEnd, end) < 0 ? end : monthEnd;
    const days = diffDays(cursor, segEnd) + 1;
    total += (monthlyValue / dim) * days;
    cursor = addDays(segEnd, 1);
  }
  return total;
};
