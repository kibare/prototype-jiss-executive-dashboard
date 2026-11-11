import type { Setting } from './types';

// Semua kunci pengaturan PRD v1.2 dengan nilai default.
export const DEFAULT_SETTINGS: Setting[] = [
  { key: 'client.payment_terms_days', value: '30', usedIn: 'Data klien', description: 'Termin bayar default (hari kalender)' },
  { key: 'margin.minimum_pct', value: '10', usedIn: 'FPK, memo', description: 'Margin minimum (%)' },
  { key: 'fpk.review_due_workdays', value: '1', usedIn: 'FPK', description: 'Batas cek Ops, Recruitment, Pengadaan (hari kerja)' },
  { key: 'fpk.margin_check_due_workdays', value: '1', usedIn: 'FPK, memo', description: 'Batas cek margin Finance (hari kerja)' },
  { key: 'fpk.returned_fix_due_workdays', value: '2', usedIn: 'FPK', description: 'Batas Marketing memperbaiki FPK dikembalikan (hari kerja)' },
  { key: 'fpk.survey_due_workdays', value: '2', usedIn: 'FPK', description: 'Batas survei Operasional (hari kerja)' },
  { key: 'fpk.bod_due_workdays', value: '3', usedIn: 'FPK', description: 'Batas persetujuan BOD (hari kerja)' },
  { key: 'escalation.bod_after_workdays', value: '2', usedIn: 'Semua tugas', description: 'Dari kepala divisi naik ke BOD (hari kerja)' },
  { key: 'personnel.register_due', value: 'H-1', usedIn: 'People in Act', description: 'HR tandai terdaftar' },
  { key: 'mutation.replacement_due_workdays', value: '5', usedIn: 'People in Act', description: 'Cari pengganti (hari kerja)' },
  { key: 'spk.verify_due_workdays', value: '1', usedIn: 'SPK', description: 'Verifikasi SPK Finance (hari kerja)' },
  { key: 'spk.wrong_escalate_days', value: '14', usedIn: 'SPK', description: 'SPK salah naik ke BOD (hari)' },
  { key: 'spk.without_spk_escalate_days', value: '30', usedIn: 'SPK', description: 'Jalan tanpa SPK naik ke BOD (hari)' },
  { key: 'spk.chase_reminder_days', value: '7, 14, 21', usedIn: 'SPK', description: 'Pengingat kejar SPK ke Marketing (hari)' },
  { key: 'memo.start_days_before_end', value: '75', usedIn: 'Memo', description: 'Tugas memo dibuat (H-n akhir SPK)' },
  { key: 'memo.send_deadline_days_before_end', value: '60', usedIn: 'Memo', description: 'Memo terkirim paling lambat (H-n)' },
  { key: 'memo.answer_deadline_days_before_end', value: '30', usedIn: 'Memo', description: 'Jawaban klien paling lambat (H-n)' },
  { key: 'memo.approval_due_workdays', value: '2', usedIn: 'Memo', description: 'Persetujuan memo BOD (hari kerja)' },
  { key: 'memo.initial_data_due_workdays', value: '5', usedIn: 'Memo', description: 'Tugas memo untuk SPK data awal (hari kerja)' },
  { key: 'notif.daily_digest_time', value: '07:00 WIB', usedIn: 'Notifikasi', description: 'Jam ringkasan pagi' },
  { key: 'session.idle_timeout_hours', value: '8', usedIn: 'Login', description: 'Sesi berakhir bila tidak aktif (jam)' },
  { key: 'doc.number_format', value: 'URUT/JISS-MKT/BULAN/TAHUN', usedIn: 'Memo eksternal', description: 'Format nomor surat keluar. URUT = nomor urut 3 digit per tahun, BULAN = bulan romawi, TAHUN = 4 digit' },
  { key: 'audit.retention_years', value: '5', usedIn: 'Audit log', description: 'Masa simpan audit log (usulan)' },
];

export const settingNum = (settings: Setting[], key: string, fallback: number) => {
  const s = settings.find(x => x.key === key);
  const n = s ? parseInt(s.value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** Validasi nilai pengaturan per kunci. Mengembalikan pesan galat atau null bila valid. */
export const validateSetting = (key: string, raw: string): string | null => {
  const v = raw.trim();
  if (!v) return 'Nilai tidak boleh kosong.';
  const int = (min: number, max: number) => {
    if (!/^\d+$/.test(v)) return 'Isi dengan bilangan bulat.';
    const n = parseInt(v, 10);
    return n < min || n > max ? `Isi antara ${min} dan ${max}.` : null;
  };
  switch (key) {
    case 'spk.chase_reminder_days': {
      const parts = v.split(',').map(x => x.trim());
      if (parts.some(x => !/^\d+$/.test(x))) return 'Isi daftar hari dipisah koma, mis. 7, 14, 21.';
      const ns = parts.map(Number);
      if (ns.some((n, i) => n < 1 || (i > 0 && n <= ns[i - 1]))) return 'Hari harus lebih dari 0 dan berurutan naik.';
      return null;
    }
    case 'personnel.register_due':
      return /^H-\d+$/.test(v) ? null : 'Format H-n, mis. H-1.';
    case 'notif.daily_digest_time': {
      const m = v.match(/^(\d{2}):(\d{2}) WIB$/);
      return m && +m[1] < 24 && +m[2] < 60 ? null : 'Format HH:MM WIB, mis. 07:00 WIB.';
    }
    case 'doc.number_format':
      return v.includes('URUT') && v.includes('TAHUN') ? null : 'Format nomor wajib memuat URUT dan TAHUN, mis. URUT/JISS-MKT/BULAN/TAHUN.';
    case 'margin.minimum_pct':
      return int(0, 100);
    case 'memo.start_days_before_end':
    case 'memo.send_deadline_days_before_end':
    case 'memo.answer_deadline_days_before_end':
    case 'client.payment_terms_days':
    case 'spk.wrong_escalate_days':
    case 'spk.without_spk_escalate_days':
      return int(1, 365);
    case 'audit.retention_years':
      return int(1, 30);
    case 'session.idle_timeout_hours':
      return int(1, 72);
    default:
      // Sisanya batas hari kerja.
      return int(1, 60);
  }
};

/** Urutan H-n memo harus masuk akal: mulai > kirim > jawab. */
export const validateMemoOrder = (settings: Setting[]): string | null => {
  const g = (k: string, fb: number) => settingNum(settings, k, fb);
  const start = g('memo.start_days_before_end', 75), send = g('memo.send_deadline_days_before_end', 60), answer = g('memo.answer_deadline_days_before_end', 30);
  return start > send && send > answer ? null : 'Urutan memo harus: tugas memo (H-75) > batas kirim (H-60) > batas jawaban (H-30).';
};
