// Model data prototipe, mengikuti bagian "Data model" PRD v1.2.
// Semua data di prototipe ini fiktif (sintetis).

export type Role =
  | 'Marketing'
  | 'Operasional'
  | 'Recruitment'
  | 'HR'
  | 'PIC Area'
  | 'Pengadaan'
  | 'Finance'
  | 'BOD'
  | 'Admin sistem';

export const ROLES: Role[] = [
  'Marketing', 'Operasional', 'Recruitment', 'HR', 'PIC Area', 'Pengadaan', 'Finance', 'BOD', 'Admin sistem',
];

/** Divisi yang ikut cek FPK / jadi "divisi terkait". */
export type Division = 'Operasional' | 'Recruitment' | 'Pengadaan' | 'Finance';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  /** Peran yang user ini jadi kepala divisinya (tujuan eskalasi pertama). */
  headOf: Role[];
  /** Lingkup area untuk PIC Area dan Operasional. */
  areaIds: string[];
  active: boolean;
  title: string;
}

export interface Area {
  id: string;
  code: string;
  name: string;
  note?: string;
  picUserId?: string;
  backupPicUserId?: string;
  active: boolean;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  accountOwnerId: string;
  coOwnerIds: string[];
  billingAddress: string;
  termDays: number;
  picContact?: string;
  note?: string;
  active: boolean;
}

export interface Site {
  id: string;
  code: string;
  name: string;
  address: string;
  clientId: string;
  areaId: string;
  note?: string;
  active: boolean;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  address?: string;
  active: boolean;
}

export interface Position {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
}

/** Divisi terkait: default per klien (siteId kosong), bisa ditimpa per site. */
export interface SiteAssignment {
  id: string;
  clientId: string;
  siteId?: string;
  division: Division;
  userId: string;
}

export interface Setting {
  key: string;
  value: string;
  usedIn: string;
  description: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  description: string;
}

export interface Delegation {
  id: string;
  bodUserId: string;
  deputyUserId: string;
  /** "tetap" = wakil menerima tugas BOD yang lewat batas; "periode" = semua tugas BOD selama periode. */
  mode: 'tetap' | 'periode';
  startDate?: string;
  endDate?: string;
}

export interface Attachment {
  id: string;
  kind: 'BOQ' | 'Bukti deal' | 'PDF SPK' | 'PDF memo' | 'Bukti kirim' | 'Foto survei';
  fileName: string;
  /** Lampiran berisi harga hanya bisa dibuka peran tertentu. */
  priced: boolean;
  uploadedBy: string;
  uploadedAt: string;
}

// ---------- FPK ----------

export type FpkType = 'baru' | 'perubahan' | 'perpanjangan';
export type FpkStatus =
  | 'draf'
  | 'cek_divisi'
  | 'cek_margin'
  | 'menunggu_bod'
  | 'disetujui'
  | 'berjalan'
  | 'tertutup_sebagian'
  | 'selesai'
  | 'dikembalikan'
  | 'ditolak'
  | 'batal';

export type Shift = 'Pagi' | 'Siang' | 'Malam' | 'Non-shift';
export type SourceKind = 'standby' | 'takeover' | 'rekrut' | 'mutasi';

export interface FpkLineSource {
  kind: SourceKind;
  qty: number;
  fromAreaId?: string;
  fromSiteId?: string;
}

export interface FpkLine {
  id: string;
  positionId: string;
  qty: number;
  shift: Shift;
  sources: FpkLineSource[];
}

/** Isi FPK per versi. Versi lama tidak pernah diubah. */
export interface FpkVersion {
  no: number;
  clientId: string;
  siteId: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  plannedStart: string;
  monthlyValue: number; // terbatas
  lines: FpkLine[];
  attachments: Attachment[];
  estCost?: number; // terbatas
  estMarginPct?: number; // terbatas
  createdBy: string;
  createdAt: string;
}

export type ReviewResult =
  | 'cocok'
  | 'ada_perubahan'
  | 'perlu_survei'
  | 'selesai'
  | 'kembalikan'
  | 'tidak_layak';

export interface FpkReview {
  versionNo: number;
  division: Division;
  result: ReviewResult;
  note?: string;
  readyDate?: string;
  actorId: string;
  at: string;
}

export interface Fpk {
  id: string;
  number: string;
  type: FpkType;
  parentFpkId?: string;
  status: FpkStatus;
  versions: FpkVersion[];
  reviews: FpkReview[];
  /** Divisi yang masih harus cek untuk versi sekarang. */
  pendingDivisions: Division[];
  /** Setelah cek divisi selesai: lanjut cek margin Finance (true) atau langsung BOD (false). */
  needsFinance?: boolean;
  surveyPending?: boolean;
  cancelled?: { by: string; reason: string; at: string };
  /** Status serah personel per FPK (People in Act). */
  handedToHr?: boolean;
  registered?: boolean;
  mutation?: { releasedIds: string[]; effectiveDate: string; placed: boolean; cancelled?: boolean };
  notFeasible?: { by: string; division: Division; reason: string };
  returned?: { by: string; reason: string; at: string; fromDivision?: Division | 'BOD' };
  bodDecision?: { decision: 'setujui' | 'kembalikan' | 'tolak'; by: string; onBehalfOf?: string; note?: string; at: string };
  startedAt?: string;
  createdBy: string;
  createdAt: string;
}

// ---------- SPK ----------

export type SpkType = 'baru' | 'addendum' | 'perpanjangan';
export type SpkStatus = 'diinput' | 'aktif' | 'perlu_revisi' | 'berakhir';

export interface SpkLine {
  id: string;
  positionId: string;
  qty: number;
  shift: Shift;
  /** Baris FPK yang ditutup oleh baris SPK ini. */
  fpkLineId?: string;
}

export interface Spk {
  id: string;
  number: string;
  type: SpkType;
  parentSpkId?: string;
  fpkId?: string;
  clientId: string;
  companyId: string;
  siteId: string;
  periodStart: string;
  periodEnd: string;
  effectiveDate?: string; // addendum
  monthlyValue: number; // terbatas
  lines: SpkLine[];
  pdf: Attachment;
  status: SpkStatus;
  inputBy: string;
  inputAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verdict?: 'cocok' | 'salah' | 'benar';
  revisionReason?: string;
  invoiceHeld?: boolean;
  isInitialData?: boolean;
}

// ---------- Memo ----------

export type MemoType = 'perpanjangan_sama' | 'perpanjangan_ump' | 'pengakhiran_perusahaan' | 'pengakhiran_klien';
export type MemoStatus = 'draf' | 'cek_margin' | 'menunggu_bod' | 'disetujui' | 'terkirim' | 'dijawab';

export interface MemoVersion {
  no: number;
  newValue: number; // terbatas
  marginPct?: number;
  bodDecision?: string;
  createdAt: string;
}

export interface Memo {
  id: string;
  spkId: string;
  parentMemoId?: string;
  type: MemoType;
  number?: string;
  status: MemoStatus;
  versions: MemoVersion[];
  sentAt?: string;
  clientAnswer?: 'setuju' | 'nego' | 'tidak_lanjut';
}

// ---------- People in Act ----------

export type PersonnelStatus =
  | 'calon'
  | 'terdaftar'
  | 'standby'
  | 'aktif'
  | 'nonaktif_sementara'
  | 'dalam_mutasi'
  | 'keluar';

export interface Placement {
  areaId: string;
  siteId?: string;
  fpkId?: string;
  spkId?: string;
  start: string;
  end?: string;
}

export interface Personnel {
  id: string;
  employeeNo: string;
  name: string;
  positionId: string;
  status: PersonnelStatus;
  uniformSize: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  shoeSize: number;
  placements: Placement[];
}

// ---------- Tugas, notifikasi, audit ----------

export type TaskKind =
  | 'cek_fpk'
  | 'survei'
  | 'cek_margin'
  | 'setujui_fpk'
  | 'perbaiki_fpk'
  | 'serah_hr'
  | 'tandai_terdaftar'
  | 'mulai_jaga'
  | 'lepas_mutasi'
  | 'ubah_penempatan'
  | 'verifikasi_spk'
  | 'urus_spk_salah'
  | 'kejar_spk'
  | 'penyesuaian_fpk'
  | 'margin_spk'
  | 'memo'
  | 'setujui_memo'
  | 'cari_pengganti'
  | 'demobilisasi';

export type RefType = 'fpk' | 'spk' | 'memo' | 'site' | 'personnel' | 'client';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  refType: RefType;
  refId: string;
  assigneeRole: Role;
  /** Kosong = semua user dengan peran ini (sesuai lingkup). */
  assigneeUserId?: string;
  division?: Division;
  createdAt: string;
  dueAt: string;
  status: 'terbuka' | 'selesai' | 'dibatalkan';
  doneBy?: string;
  doneAt?: string;
  /** Untuk pengingat kejar SPK: tidak pakai eskalasi standar. */
  customEscalation?: string;
}

export interface Notification {
  id: string;
  at: string;
  text: string;
  toUserIds: string[];
  refType?: RefType;
  refId?: string;
  readBy: string[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  onBehalfOfId?: string;
  entity: string;
  entityId: string;
  action: string;
  before?: string;
  after?: string;
  /** Diisi bila before/after memuat nilai uang (disamarkan untuk peran tanpa akses uang). */
  hasMoney?: boolean;
}
