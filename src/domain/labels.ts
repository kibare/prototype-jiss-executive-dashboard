import type { FpkStatus, MemoStatus, PersonnelStatus, SpkStatus, SourceKind, FpkType, SpkType, MemoType } from './types';

export type Tone = 'slate' | 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'teal';

export const FPK_STATUS: Record<FpkStatus, { label: string; tone: Tone }> = {
  draf: { label: 'Draf', tone: 'slate' },
  cek_divisi: { label: 'Cek divisi', tone: 'blue' },
  cek_margin: { label: 'Cek margin', tone: 'blue' },
  menunggu_bod: { label: 'Menunggu BOD', tone: 'violet' },
  disetujui: { label: 'Disetujui', tone: 'teal' },
  berjalan: { label: 'Jalan, belum ada SPK', tone: 'green' },
  tertutup_sebagian: { label: 'Sebagian sudah SPK', tone: 'green' },
  selesai: { label: 'Selesai (SPK lengkap)', tone: 'slate' },
  dikembalikan: { label: 'Dikembalikan', tone: 'amber' },
  ditolak: { label: 'Ditolak', tone: 'red' },
  batal: { label: 'Batal', tone: 'red' },
};

export const SPK_STATUS: Record<SpkStatus, { label: string; tone: Tone }> = {
  diinput: { label: 'Menunggu verifikasi', tone: 'blue' },
  aktif: { label: 'Aktif', tone: 'green' },
  perlu_revisi: { label: 'Perlu revisi', tone: 'amber' },
  berakhir: { label: 'Berakhir', tone: 'slate' },
};

export const MEMO_STATUS: Record<MemoStatus, { label: string; tone: Tone }> = {
  draf: { label: 'Draf', tone: 'slate' },
  cek_margin: { label: 'Cek margin', tone: 'blue' },
  menunggu_bod: { label: 'Menunggu BOD', tone: 'violet' },
  disetujui: { label: 'Disetujui', tone: 'teal' },
  terkirim: { label: 'Terkirim', tone: 'blue' },
  dijawab: { label: 'Dijawab', tone: 'green' },
};

export const PERSONNEL_STATUS: Record<PersonnelStatus, { label: string; tone: Tone }> = {
  calon: { label: 'Calon', tone: 'slate' },
  terdaftar: { label: 'Terdaftar', tone: 'blue' },
  standby: { label: 'Standby', tone: 'amber' },
  aktif: { label: 'Aktif', tone: 'green' },
  nonaktif_sementara: { label: 'Nonaktif sementara', tone: 'violet' },
  dalam_mutasi: { label: 'Dalam mutasi', tone: 'teal' },
  keluar: { label: 'Keluar', tone: 'red' },
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  standby: 'Standby',
  takeover: 'Takeover',
  rekrut: 'Rekrut baru',
  mutasi: 'Mutasi',
};

export const FPK_TYPE: Record<FpkType, string> = { baru: 'Baru', perubahan: 'Perubahan', perpanjangan: 'Perpanjangan' };
export const SPK_TYPE: Record<SpkType, string> = { baru: 'Baru', addendum: 'Addendum', perpanjangan: 'Perpanjangan' };
export const MEMO_TYPE: Record<MemoType, string> = {
  perpanjangan_sama: 'Perpanjangan harga sama',
  perpanjangan_ump: 'Perpanjangan penyesuaian UMP/UMK',
  pengakhiran_perusahaan: 'Pengakhiran oleh perusahaan',
  pengakhiran_klien: 'Pengakhiran dari klien',
};
