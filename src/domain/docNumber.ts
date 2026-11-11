// Nomor surat keluar mengikuti format JISS, mis. 018/JISS-MKT/X/2026 (urut 3 digit / kode divisi / bulan romawi / tahun).
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const DEFAULT_DOC_FORMAT = 'URUT/JISS-MKT/BULAN/TAHUN';

/** Isi format dengan nomor urut dan tanggal (YYYY-MM-DD). */
export const formatDocNumber = (fmt: string, urut: number, date: string) =>
  fmt
    .replace('URUT', String(urut).padStart(3, '0'))
    .replace('BULAN', ROMAN[parseInt(date.slice(5, 7), 10) - 1])
    .replace('TAHUN', date.slice(0, 4));

/** Nomor urut dari nomor yang sudah ada pada tahun yang sama (null bila tidak cocok format). */
export const urutOf = (fmt: string, number: string, year: string): number | null => {
  const esc = fmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + esc.replace('URUT', '(\\d+)').replace('BULAN', '(?:[IVX]+)').replace('TAHUN', year) + '$');
  const m = number.match(re);
  return m ? parseInt(m[1], 10) : null;
};

/** Nomor berikutnya: urut lanjut per tahun. */
export const nextDocNumber = (fmt: string, existing: (string | undefined)[], date: string) => {
  const year = date.slice(0, 4);
  const max = existing.reduce((n, x) => Math.max(n, x ? urutOf(fmt, x, year) ?? 0 : 0), 0);
  return formatDocNumber(fmt, max + 1, date);
};
