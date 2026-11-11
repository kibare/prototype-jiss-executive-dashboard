// Data contoh prototipe. SEMUA FIKTIF: nama orang, klien, site, nomor dokumen, dan nilai uang dibuat-buat.
import type {
  Area, AuditEntry, Client, Delegation, Fpk, Holiday, Memo, Notification, Personnel,
  PersonnelStatus, Position, Site, SiteAssignment, Spk, Task, User, Attachment,
} from './types';
import { DEFAULT_SETTINGS } from './settings';

export const SEED_USERS: User[] = [
  { id: 'u-bod', name: 'Hartono Wibisono', email: 'hartono@contoh.id', roles: ['BOD'], headOf: [], areaIds: [], active: true, title: 'Direktur Utama' },
  { id: 'u-wakil', name: 'Yudha Pratama', email: 'yudha@contoh.id', roles: ['Marketing'], headOf: ['Marketing'], areaIds: [], active: true, title: 'Kepala Marketing, wakil BOD' },
  { id: 'u-mkt1', name: 'Sari Melati', email: 'sari@contoh.id', roles: ['Marketing'], headOf: [], areaIds: [], active: true, title: 'Account Manager' },
  { id: 'u-ops1', name: 'Bagas Wirawan', email: 'bagas@contoh.id', roles: ['Operasional'], headOf: ['Operasional'], areaIds: ['a-bks', 'a-krw', 'a-bgr'], active: true, title: 'Kepala Operasional' },
  { id: 'u-ops2', name: 'Dewi Anggraini', email: 'dewi@contoh.id', roles: ['Operasional'], headOf: [], areaIds: ['a-jkp', 'a-jks', 'a-tgr'], active: true, title: 'Koordinator Operasional' },
  { id: 'u-rec', name: 'Fajar Ramadhan', email: 'fajar@contoh.id', roles: ['Recruitment'], headOf: ['Recruitment'], areaIds: [], active: true, title: 'Kepala Recruitment' },
  { id: 'u-hr', name: 'Lina Marlina', email: 'lina@contoh.id', roles: ['HR'], headOf: ['HR'], areaIds: [], active: true, title: 'Kepala HR' },
  { id: 'u-pic1', name: 'Rudi Hartanto', email: 'rudi@contoh.id', roles: ['PIC Area'], headOf: [], areaIds: ['a-bks', 'a-krw', 'a-jks'], active: true, title: 'Admin Area Bekasi' },
  { id: 'u-pic2', name: 'Agus Setiono', email: 'agus@contoh.id', roles: ['PIC Area'], headOf: [], areaIds: ['a-jkp', 'a-jks'], active: true, title: 'Admin Area Jakarta' },
  { id: 'u-pic3', name: 'Maya Lestari', email: 'maya@contoh.id', roles: ['PIC Area'], headOf: [], areaIds: ['a-tgr', 'a-bgr', 'a-krw'], active: true, title: 'Admin Area Tangerang' },
  { id: 'u-peng', name: 'Nanda Putri', email: 'nanda@contoh.id', roles: ['Pengadaan'], headOf: ['Pengadaan'], areaIds: [], active: true, title: 'Kepala Pengadaan' },
  { id: 'u-fin1', name: 'Wulan Sari', email: 'wulan@contoh.id', roles: ['Finance'], headOf: ['Finance'], areaIds: [], active: true, title: 'Kepala Finance' },
  { id: 'u-fin2', name: 'Teguh Santoso', email: 'teguh@contoh.id', roles: ['Finance'], headOf: [], areaIds: [], active: true, title: 'Staf Finance' },
  { id: 'u-admin', name: 'Kevin Halim', email: 'kevin@contoh.id', roles: ['Admin sistem'], headOf: [], areaIds: [], active: true, title: 'Admin Sistem' },
];

export const SEED_AREAS: Area[] = [
  { id: 'a-bks', code: 'AR-BKS', name: 'Bekasi', picUserId: 'u-pic1', active: true },
  { id: 'a-krw', code: 'AR-KRW', name: 'Karawang', picUserId: 'u-pic1', backupPicUserId: 'u-pic3', active: true },
  { id: 'a-bgr', code: 'AR-BGR', name: 'Bogor', picUserId: 'u-pic3', active: true },
  { id: 'a-jkp', code: 'AR-JKP', name: 'Jakarta Pusat', picUserId: 'u-pic2', active: true },
  { id: 'a-jks', code: 'AR-JKS', name: 'Jakarta Selatan', picUserId: 'u-pic2', backupPicUserId: 'u-pic1', active: true },
  { id: 'a-tgr', code: 'AR-TGR', name: 'Tangerang', picUserId: 'u-pic3', active: true },
  { id: 'a-sby', code: 'AR-SBY', name: 'Surabaya', note: 'Area baru, PIC belum ditunjuk', active: true },
  { id: 'a-smg', code: 'AR-SMG', name: 'Semarang', note: 'Ditutup sejak 2025', active: false },
];

export const SEED_POSITIONS: Position[] = [
  { id: 'p-sat', code: 'SATPAM', name: 'Anggota Satpam', active: true },
  { id: 'p-dan', code: 'DANRU', name: 'Danru (Komandan Regu)', active: true },
  { id: 'p-chf', code: 'CHIEF', name: 'Chief Security', active: true },
  { id: 'p-cctv', code: 'CCTV', name: 'Operator CCTV', active: true },
  { id: 'p-pat', code: 'PATROLI', name: 'Petugas Patroli', active: true },
  { id: 'p-jgm', code: 'JAGAMLM', name: 'Penjaga Malam', description: 'Tidak dipakai di kontrak baru', active: false },
];

export const SEED_CLIENTS: Client[] = [
  { id: 'c-cla', code: 'CLA', name: 'PT Cahaya Logam Abadi', accountOwnerId: 'u-mkt1', coOwnerIds: [], billingAddress: 'Jl. Fiktif Industri No. 10, Cikarang', npwp: '00.000.000.1-000.000', termDays: 30, picContact: 'Bp. Andri (GA)', active: true },
  { id: 'c-spl', code: 'SPL', name: 'PT Sinar Pangan Lestari', accountOwnerId: 'u-mkt1', coOwnerIds: ['u-wakil'], billingAddress: 'Jl. Fiktif Pangan No. 3, Bekasi', npwp: '00.000.000.2-000.000', termDays: 30, picContact: 'Ibu Rina (HRGA)', active: true },
  { id: 'c-gdn', code: 'GDN', name: 'PT Graha Data Nusantara', accountOwnerId: 'u-wakil', coOwnerIds: [], billingAddress: 'Jl. Fiktif Digital No. 8, Jakarta', npwp: '00.000.000.3-000.000', termDays: 45, active: true },
  { id: 'c-ktm', code: 'KTM', name: 'PT Kencana Tekstil Mandiri', accountOwnerId: 'u-wakil', coOwnerIds: [], billingAddress: 'Jl. Fiktif Tenun No. 21, Karawang', npwp: '00.000.000.4-000.000', termDays: 30, active: true },
  { id: 'c-bkp', code: 'BKP', name: 'PT Bumi Kemas Plastindo', accountOwnerId: 'u-mkt1', coOwnerIds: [], billingAddress: 'Jl. Fiktif Kemasan No. 5, Tangerang', npwp: '00.000.000.5-000.000', termDays: 30, active: true },
  { id: 'c-arp', code: 'ARP', name: 'PT Arunika Properti', accountOwnerId: 'u-wakil', coOwnerIds: ['u-mkt1'], billingAddress: 'Jl. Fiktif Hunian No. 12, Jakarta', npwp: '00.000.000.6-000.000', termDays: 30, active: true },
  { id: 'c-thl', code: 'THL', name: 'PT Tirta Hijau Lestari', accountOwnerId: 'u-mkt1', coOwnerIds: [], billingAddress: 'Jl. Fiktif Mata Air No. 7, Bogor', npwp: '00.000.000.7-000.000', termDays: 30, active: true },
  { id: 'c-dgp', code: 'DGP', name: 'PT Delta Gudang Prima', accountOwnerId: 'u-mkt1', coOwnerIds: [], billingAddress: 'Jl. Fiktif Logistik No. 4, Jakarta', npwp: '00.000.000.8-000.000', termDays: 30, note: 'Dibuat Marketing dari form FPK', active: true },
];

export const SEED_SITES: Site[] = [
  { id: 's-cla-ckr', code: 'CLA-CKR', name: 'Pabrik Cikarang', address: 'Kawasan Industri Fiktif Blok A, Cikarang', clientId: 'c-cla', areaId: 'a-bks', active: true },
  { id: 's-cla-kwg', code: 'CLA-KWG', name: 'Gudang Karawang Timur', address: 'Jl. Fiktif Gudang No. 2, Karawang', clientId: 'c-cla', areaId: 'a-krw', active: true },
  { id: 's-cla-hq', code: 'CLA-HQ', name: 'Kantor Pusat Kuningan', address: 'Gedung Fiktif Lt. 5, Jakarta Selatan', clientId: 'c-cla', areaId: 'a-jks', active: true },
  { id: 's-spl-tmb', code: 'SPL-TMB', name: 'Pabrik Tambun', address: 'Jl. Fiktif Pangan No. 3, Tambun', clientId: 'c-spl', areaId: 'a-bks', active: true },
  { id: 's-spl-ctr', code: 'SPL-CTR', name: 'Gudang Citeureup', address: 'Jl. Fiktif Gudang No. 9, Citeureup', clientId: 'c-spl', areaId: 'a-bgr', active: true },
  { id: 's-spl-pgd', code: 'SPL-PGD', name: 'Gudang Pulogadung', address: 'Jl. Fiktif Gudang No. 15, Jakarta', clientId: 'c-spl', areaId: 'a-jkp', active: true },
  { id: 's-gdn-dc1', code: 'GDN-DC1', name: 'Data Center Cibitung', address: 'Kawasan Fiktif Data No. 1, Cibitung', clientId: 'c-gdn', areaId: 'a-bks', active: true },
  { id: 's-gdn-hq', code: 'GDN-HQ', name: 'Kantor Thamrin', address: 'Menara Fiktif Lt. 12, Jakarta Pusat', clientId: 'c-gdn', areaId: 'a-jkp', active: true },
  { id: 's-ktm-krb', code: 'KTM-KRB', name: 'Pabrik Karawang Barat', address: 'Jl. Fiktif Tenun No. 21, Karawang', clientId: 'c-ktm', areaId: 'a-krw', active: true },
  { id: 's-bkp-blj', code: 'BKP-BLJ', name: 'Pabrik Balaraja', address: 'Jl. Fiktif Kemasan No. 5, Balaraja', clientId: 'c-bkp', areaId: 'a-tgr', active: true },
  { id: 's-arp-kby', code: 'ARP-KBY', name: 'Apartemen Kebayoran', address: 'Jl. Fiktif Hunian No. 12, Jakarta Selatan', clientId: 'c-arp', areaId: 'a-jks', active: true },
  { id: 's-arp-cdn', code: 'ARP-CDN', name: 'Klaster Cendana', address: 'Jl. Fiktif Cendana No. 1, Tangerang', clientId: 'c-arp', areaId: 'a-tgr', active: true },
  { id: 's-thl-caw', code: 'THL-CAW', name: 'Pabrik Air Ciawi', address: 'Jl. Fiktif Mata Air No. 7, Ciawi', clientId: 'c-thl', areaId: 'a-bgr', active: true },
  { id: 's-thl-rkt', code: 'THL-RKT', name: 'Depo Rungkut', address: 'Jl. Fiktif Depo No. 3, Surabaya', clientId: 'c-thl', areaId: 'a-sby', active: true },
  { id: 's-dgp-ckg', code: 'DGP-CKG', name: 'Gudang Cakung', address: 'Jl. Fiktif Logistik No. 4, Jakarta', clientId: 'c-dgp', areaId: 'a-jkp', note: 'Dibuat Marketing dari form FPK', active: true },
];

export const SEED_ASSIGNMENTS: SiteAssignment[] = [
  { id: 'sa-1', clientId: 'c-cla', division: 'Operasional', userId: 'u-ops1' },
  { id: 'sa-2', clientId: 'c-cla', division: 'Recruitment', userId: 'u-rec' },
  { id: 'sa-3', clientId: 'c-cla', division: 'Pengadaan', userId: 'u-peng' },
  { id: 'sa-4', clientId: 'c-cla', division: 'Finance', userId: 'u-fin1' },
  { id: 'sa-5', clientId: 'c-cla', siteId: 's-cla-hq', division: 'Operasional', userId: 'u-ops2' },
  { id: 'sa-6', clientId: 'c-spl', division: 'Operasional', userId: 'u-ops1' },
  { id: 'sa-7', clientId: 'c-spl', division: 'Finance', userId: 'u-fin2' },
  { id: 'sa-8', clientId: 'c-gdn', division: 'Operasional', userId: 'u-ops2' },
  { id: 'sa-9', clientId: 'c-gdn', siteId: 's-gdn-dc1', division: 'Operasional', userId: 'u-ops1' },
  { id: 'sa-10', clientId: 'c-gdn', division: 'Finance', userId: 'u-fin1' },
  { id: 'sa-11', clientId: 'c-arp', division: 'Operasional', userId: 'u-ops2' },
  { id: 'sa-12', clientId: 'c-arp', division: 'Finance', userId: 'u-fin2' },
];

export const SEED_HOLIDAYS: Holiday[] = [
  { date: '2026-12-24', description: 'Cuti bersama Natal' },
  { date: '2026-12-25', description: 'Hari Raya Natal' },
  { date: '2027-01-01', description: 'Tahun Baru' },
];

export const SEED_DELEGATIONS: Delegation[] = [
  { id: 'd-1', bodUserId: 'u-bod', deputyUserId: 'u-wakil', mode: 'tetap' },
];

export { DEFAULT_SETTINGS };

// ---------- helper lampiran ----------
export const isPricedKind = (kind: Attachment['kind']) =>
  kind === 'BOQ' || kind === 'Bukti deal' || kind === 'PDF SPK' || kind === 'PDF memo';

const att = (id: string, kind: Attachment['kind'], fileName: string, by: string, at: string): Attachment => ({
  id, kind, fileName, uploadedBy: by, uploadedAt: at, priced: isPricedKind(kind),
});

// ---------- FPK ----------
export const SEED_FPKS: Fpk[] = [
  {
    id: 'f-0005', number: 'FPK/2026/0005', type: 'baru', status: 'selesai', pendingDivisions: [],
    createdBy: 'u-wakil', createdAt: '2026-05-12', startedAt: '2026-06-01',
    versions: [{
      no: 1, clientId: 'c-gdn', siteId: 's-gdn-dc1', periodStart: '2026-06-01', periodEnd: '2027-05-31', plannedStart: '2026-06-01',
      monthlyValue: 92_000_000, estCost: 78_000_000, estMarginPct: 15.2, createdBy: 'u-wakil', createdAt: '2026-05-12',
      lines: [
        { id: 'fl-5a', positionId: 'p-sat', qty: 4, shift: 'Pagi', sources: [{ kind: 'rekrut', qty: 4 }] },
        { id: 'fl-5b', positionId: 'p-sat', qty: 4, shift: 'Malam', sources: [{ kind: 'rekrut', qty: 4 }] },
        { id: 'fl-5c', positionId: 'p-dan', qty: 2, shift: 'Non-shift', sources: [{ kind: 'standby', qty: 2 }] },
      ],
      attachments: [att('at-5a', 'BOQ', 'BOQ_GDN_DC1_v1.pdf', 'u-wakil', '2026-05-12'), att('at-5b', 'Bukti deal', 'Email_persetujuan_GDN.pdf', 'u-wakil', '2026-05-12')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops1', at: '2026-05-13 10:00' },
      { versionNo: 1, division: 'Recruitment', result: 'selesai', readyDate: '2026-05-28', actorId: 'u-rec', at: '2026-05-13 11:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', note: 'Seragam tersedia', actorId: 'u-peng', at: '2026-05-13 14:00' },
      { versionNo: 1, division: 'Finance', result: 'selesai', actorId: 'u-fin1', at: '2026-05-14 09:00' },
    ],
    bodDecision: { decision: 'setujui', by: 'u-bod', at: '2026-05-15 10:00' },
  },
  {
    id: 'f-0008', number: 'FPK/2026/0008', type: 'baru', status: 'tertutup_sebagian', pendingDivisions: [],
    createdBy: 'u-mkt1', createdAt: '2026-08-10', startedAt: '2026-09-01',
    versions: [{
      no: 1, clientId: 'c-spl', siteId: 's-spl-tmb', periodStart: '2026-09-01', periodEnd: '2027-08-31', plannedStart: '2026-09-01',
      monthlyValue: 120_000_000, estCost: 101_000_000, estMarginPct: 15.8, createdBy: 'u-mkt1', createdAt: '2026-08-10',
      lines: [
        { id: 'fl-8a', positionId: 'p-sat', qty: 6, shift: 'Pagi', sources: [{ kind: 'rekrut', qty: 6 }] },
        { id: 'fl-8b', positionId: 'p-sat', qty: 6, shift: 'Malam', sources: [{ kind: 'rekrut', qty: 6 }] },
        { id: 'fl-8c', positionId: 'p-dan', qty: 2, shift: 'Non-shift', sources: [{ kind: 'standby', qty: 2 }] },
      ],
      attachments: [att('at-8a', 'BOQ', 'BOQ_SPL_Tambun.pdf', 'u-mkt1', '2026-08-10'), att('at-8b', 'Bukti deal', 'Surat_minat_SPL.pdf', 'u-mkt1', '2026-08-10')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops1', at: '2026-08-11 09:00' },
      { versionNo: 1, division: 'Recruitment', result: 'selesai', actorId: 'u-rec', at: '2026-08-11 10:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', actorId: 'u-peng', at: '2026-08-11 13:00' },
      { versionNo: 1, division: 'Finance', result: 'selesai', actorId: 'u-fin2', at: '2026-08-12 09:00' },
    ],
    bodDecision: { decision: 'setujui', by: 'u-bod', at: '2026-08-13 10:00' },
  },
  {
    id: 'f-0010', number: 'FPK/2026/0010', type: 'baru', status: 'berjalan', pendingDivisions: [],
    createdBy: 'u-mkt1', createdAt: '2026-10-01', startedAt: '2026-10-20',
    versions: [{
      no: 1, clientId: 'c-cla', siteId: 's-cla-ckr', periodStart: '2026-10-20', periodEnd: '2027-10-19', plannedStart: '2026-10-20',
      monthlyValue: 165_000_000, estCost: 139_000_000, estMarginPct: 15.8, createdBy: 'u-mkt1', createdAt: '2026-10-01',
      lines: [
        { id: 'fl-10a', positionId: 'p-sat', qty: 5, shift: 'Pagi', sources: [{ kind: 'rekrut', qty: 5 }] },
        { id: 'fl-10b', positionId: 'p-sat', qty: 5, shift: 'Malam', sources: [{ kind: 'rekrut', qty: 3 }, { kind: 'standby', qty: 2 }] },
        { id: 'fl-10c', positionId: 'p-dan', qty: 2, shift: 'Non-shift', sources: [{ kind: 'standby', qty: 2 }] },
      ],
      attachments: [att('at-10a', 'BOQ', 'BOQ_CLA_Cikarang.pdf', 'u-mkt1', '2026-10-01'), att('at-10b', 'Bukti deal', 'Email_deal_CLA.pdf', 'u-mkt1', '2026-10-01')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops1', at: '2026-10-02 09:30' },
      { versionNo: 1, division: 'Recruitment', result: 'selesai', readyDate: '2026-10-16', actorId: 'u-rec', at: '2026-10-02 10:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', actorId: 'u-peng', at: '2026-10-02 15:00' },
      { versionNo: 1, division: 'Finance', result: 'selesai', actorId: 'u-fin1', at: '2026-10-05 09:00' },
    ],
    bodDecision: { decision: 'setujui', by: 'u-bod', at: '2026-10-06 11:00' },
  },
  {
    id: 'f-0009', number: 'FPK/2026/0009', type: 'baru', status: 'disetujui', pendingDivisions: [],
    createdBy: 'u-wakil', createdAt: '2026-10-28',
    versions: [{
      no: 1, clientId: 'c-arp', siteId: 's-arp-kby', periodStart: '2026-11-16', periodEnd: '2027-11-15', plannedStart: '2026-11-16',
      monthlyValue: 78_000_000, estCost: 66_500_000, estMarginPct: 14.7, createdBy: 'u-wakil', createdAt: '2026-10-28',
      lines: [
        { id: 'fl-9a', positionId: 'p-sat', qty: 6, shift: 'Non-shift', sources: [{ kind: 'rekrut', qty: 4 }, { kind: 'mutasi', qty: 2, fromAreaId: 'a-tgr', fromSiteId: 's-arp-cdn' }] },
        { id: 'fl-9b', positionId: 'p-chf', qty: 1, shift: 'Non-shift', sources: [{ kind: 'standby', qty: 1 }] },
      ],
      attachments: [att('at-9a', 'BOQ', 'BOQ_ARP_Kebayoran.pdf', 'u-wakil', '2026-10-28'), att('at-9b', 'Bukti deal', 'Surat_penunjukan_ARP.pdf', 'u-wakil', '2026-10-28')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops2', at: '2026-10-29 09:00' },
      { versionNo: 1, division: 'Recruitment', result: 'selesai', readyDate: '2026-11-13', actorId: 'u-rec', at: '2026-10-29 11:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', note: 'Seragam Chief perlu dipesan, siap 7 hari', actorId: 'u-peng', at: '2026-10-29 14:00' },
      { versionNo: 1, division: 'Finance', result: 'selesai', actorId: 'u-fin2', at: '2026-10-30 10:00' },
    ],
    bodDecision: { decision: 'setujui', by: 'u-bod', at: '2026-11-02 09:00' },
  },
  {
    id: 'f-0007', number: 'FPK/2026/0007', type: 'baru', status: 'disetujui', pendingDivisions: [], handedToHr: true, registered: true,
    createdBy: 'u-mkt1', createdAt: '2026-11-03',
    versions: [{
      no: 1, clientId: 'c-spl', siteId: 's-spl-pgd', periodStart: '2026-11-12', periodEnd: '2027-11-11', plannedStart: '2026-11-12',
      monthlyValue: 39_000_000, estCost: 33_200_000, estMarginPct: 14.9, createdBy: 'u-mkt1', createdAt: '2026-11-03',
      lines: [{ id: 'fl-7a', positionId: 'p-sat', qty: 3, shift: 'Non-shift', sources: [{ kind: 'standby', qty: 3 }] }],
      attachments: [att('at-7a', 'BOQ', 'BOQ_SPL_Pulogadung.pdf', 'u-mkt1', '2026-11-03'), att('at-7b', 'Bukti deal', 'Email_SPL_Pulogadung.pdf', 'u-mkt1', '2026-11-03')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops2', at: '2026-11-04 09:00' },
      { versionNo: 1, division: 'Recruitment', result: 'selesai', readyDate: '2026-11-10', actorId: 'u-rec', at: '2026-11-04 10:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', actorId: 'u-peng', at: '2026-11-04 13:00' },
      { versionNo: 1, division: 'Finance', result: 'selesai', actorId: 'u-fin2', at: '2026-11-04 16:00' },
    ],
    bodDecision: { decision: 'setujui', by: 'u-bod', at: '2026-11-05 10:00' },
  },
  {
    id: 'f-0012', number: 'FPK/2026/0012', type: 'baru', status: 'menunggu_bod', pendingDivisions: [],
    createdBy: 'u-wakil', createdAt: '2026-11-02',
    notFeasible: { by: 'u-rec', division: 'Recruitment', reason: 'Rekrut 12 orang dalam 2 minggu sulit tercapai; butuh minimal 4 minggu.' },
    versions: [{
      no: 1, clientId: 'c-ktm', siteId: 's-ktm-krb', periodStart: '2026-12-01', periodEnd: '2027-11-30', plannedStart: '2026-12-01',
      monthlyValue: 140_000_000, estCost: 128_100_000, estMarginPct: 8.5, createdBy: 'u-wakil', createdAt: '2026-11-02',
      lines: [
        { id: 'fl-12a', positionId: 'p-sat', qty: 6, shift: 'Pagi', sources: [{ kind: 'rekrut', qty: 6 }] },
        { id: 'fl-12b', positionId: 'p-sat', qty: 6, shift: 'Malam', sources: [{ kind: 'rekrut', qty: 6 }] },
        { id: 'fl-12c', positionId: 'p-pat', qty: 2, shift: 'Malam', sources: [{ kind: 'standby', qty: 2 }] },
      ],
      attachments: [att('at-12a', 'BOQ', 'BOQ_KTM_Ekspansi.pdf', 'u-wakil', '2026-11-02'), att('at-12b', 'Bukti deal', 'Email_KTM_setuju_harga.pdf', 'u-wakil', '2026-11-02')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops1', at: '2026-11-03 10:00' },
      { versionNo: 1, division: 'Recruitment', result: 'tidak_layak', note: 'Rekrut 12 orang dalam 2 minggu sulit tercapai; butuh minimal 4 minggu.', actorId: 'u-rec', at: '2026-11-03 11:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', actorId: 'u-peng', at: '2026-11-03 15:00' },
      { versionNo: 1, division: 'Finance', result: 'selesai', note: 'Margin di bawah minimum karena harga mengikuti tender.', actorId: 'u-fin1', at: '2026-11-05 16:00' },
    ],
  },
  {
    id: 'f-0013', number: 'FPK/2026/0013', type: 'baru', status: 'cek_divisi', pendingDivisions: ['Recruitment', 'Pengadaan'], needsFinance: true,
    createdBy: 'u-mkt1', createdAt: '2026-11-11',
    versions: [{
      no: 1, clientId: 'c-bkp', siteId: 's-bkp-blj', periodStart: '2026-12-01', periodEnd: '2027-11-30', plannedStart: '2026-12-01',
      monthlyValue: 64_000_000, createdBy: 'u-mkt1', createdAt: '2026-11-11',
      lines: [
        { id: 'fl-13a', positionId: 'p-sat', qty: 4, shift: 'Pagi', sources: [] },
        { id: 'fl-13b', positionId: 'p-sat', qty: 3, shift: 'Malam', sources: [] },
      ],
      attachments: [att('at-13a', 'BOQ', 'BOQ_BKP_Balaraja.pdf', 'u-mkt1', '2026-11-11'), att('at-13b', 'Bukti deal', 'Email_BKP.pdf', 'u-mkt1', '2026-11-11')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'cocok', actorId: 'u-ops2', at: '2026-11-11 15:00' },
    ],
  },
  {
    id: 'f-0006', number: 'FPK/2026/0006', type: 'baru', status: 'cek_margin', pendingDivisions: [], needsFinance: true,
    createdBy: 'u-mkt1', createdAt: '2026-11-03',
    versions: [
      {
        no: 1, clientId: 'c-cla', siteId: 's-cla-kwg', periodStart: '2026-12-01', periodEnd: '2027-11-30', plannedStart: '2026-12-01',
        monthlyValue: 52_000_000, createdBy: 'u-mkt1', createdAt: '2026-11-03',
        lines: [{ id: 'fl-6a', positionId: 'p-sat', qty: 4, shift: 'Pagi', sources: [{ kind: 'rekrut', qty: 4 }] }],
        attachments: [att('at-6a', 'BOQ', 'BOQ_CLA_Karawang_v1.pdf', 'u-mkt1', '2026-11-03'), att('at-6b', 'Bukti deal', 'Email_CLA_Karawang.pdf', 'u-mkt1', '2026-11-03')],
      },
      {
        no: 2, clientId: 'c-cla', siteId: 's-cla-kwg', periodStart: '2026-12-01', periodEnd: '2027-11-30', plannedStart: '2026-12-01',
        monthlyValue: 68_000_000, createdBy: 'u-mkt1', createdAt: '2026-11-05',
        lines: [
          { id: 'fl-6b', positionId: 'p-sat', qty: 4, shift: 'Pagi', sources: [{ kind: 'rekrut', qty: 4 }] },
          { id: 'fl-6c', positionId: 'p-sat', qty: 2, shift: 'Malam', sources: [{ kind: 'rekrut', qty: 2 }] },
        ],
        attachments: [att('at-6c', 'BOQ', 'BOQ_CLA_Karawang_v2.pdf', 'u-mkt1', '2026-11-05'), att('at-6b2', 'Bukti deal', 'Email_CLA_Karawang.pdf', 'u-mkt1', '2026-11-03')],
      },
    ],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'kembalikan', note: 'Gudang beroperasi 24 jam, shift malam belum ada.', actorId: 'u-ops1', at: '2026-11-04 10:00' },
      { versionNo: 1, division: 'Recruitment', result: 'selesai', actorId: 'u-rec', at: '2026-11-04 09:00' },
      { versionNo: 2, division: 'Operasional', result: 'cocok', actorId: 'u-ops1', at: '2026-11-10 09:00' },
      { versionNo: 2, division: 'Recruitment', result: 'selesai', readyDate: '2026-11-25', actorId: 'u-rec', at: '2026-11-10 11:00' },
      { versionNo: 2, division: 'Pengadaan', result: 'selesai', actorId: 'u-peng', at: '2026-11-11 10:00' },
    ],
    returned: { by: 'u-ops1', reason: 'Gudang beroperasi 24 jam, shift malam belum ada.', at: '2026-11-04 10:00', fromDivision: 'Operasional' },
  },
  {
    id: 'f-0011', number: 'FPK/2026/0011', type: 'baru', status: 'dikembalikan', pendingDivisions: [],
    createdBy: 'u-mkt1', createdAt: '2026-11-06',
    returned: { by: 'u-ops1', reason: 'Area pabrik luas, patroli malam perlu minimal 2 orang.', at: '2026-11-10 14:00', fromDivision: 'Operasional' },
    versions: [{
      no: 1, clientId: 'c-thl', siteId: 's-thl-caw', periodStart: '2027-01-01', periodEnd: '2027-12-31', plannedStart: '2027-01-01',
      monthlyValue: 58_000_000, createdBy: 'u-mkt1', createdAt: '2026-11-06',
      lines: [
        { id: 'fl-11a', positionId: 'p-sat', qty: 4, shift: 'Pagi', sources: [] },
        { id: 'fl-11b', positionId: 'p-pat', qty: 1, shift: 'Malam', sources: [] },
      ],
      attachments: [att('at-11a', 'BOQ', 'BOQ_THL_Ciawi.pdf', 'u-mkt1', '2026-11-06'), att('at-11b', 'Bukti deal', 'Email_THL.pdf', 'u-mkt1', '2026-11-06')],
    }],
    reviews: [
      { versionNo: 1, division: 'Operasional', result: 'kembalikan', note: 'Area pabrik luas, patroli malam perlu minimal 2 orang.', actorId: 'u-ops1', at: '2026-11-10 14:00' },
      { versionNo: 1, division: 'Pengadaan', result: 'selesai', actorId: 'u-peng', at: '2026-11-10 11:00' },
    ],
  },
  {
    id: 'f-0014', number: 'FPK/2026/0014', type: 'baru', status: 'draf', pendingDivisions: [],
    createdBy: 'u-mkt1', createdAt: '2026-11-12',
    versions: [{
      no: 1, clientId: 'c-dgp', siteId: 's-dgp-ckg', periodStart: '2027-01-01', periodEnd: '2027-12-31', plannedStart: '2027-01-02',
      monthlyValue: 45_000_000, createdBy: 'u-mkt1', createdAt: '2026-11-12',
      lines: [{ id: 'fl-14a', positionId: 'p-sat', qty: 3, shift: 'Non-shift', sources: [] }],
      attachments: [att('at-14a', 'BOQ', 'BOQ_DGP_Cakung.pdf', 'u-mkt1', '2026-11-12')],
    }],
    reviews: [],
  },
];

// ---------- SPK ----------
export const SEED_SPKS: Spk[] = [
  {
    id: 'sp-1', number: 'SPK/GDN/2026/014', type: 'baru', fpkId: 'f-0005', clientId: 'c-gdn', siteId: 's-gdn-dc1',
    periodStart: '2026-06-01', periodEnd: '2027-05-31', monthlyValue: 92_000_000, status: 'aktif', verdict: 'cocok',
    lines: [
      { id: 'sl-1a', positionId: 'p-sat', qty: 4, shift: 'Pagi', fpkLineId: 'fl-5a' },
      { id: 'sl-1b', positionId: 'p-sat', qty: 4, shift: 'Malam', fpkLineId: 'fl-5b' },
      { id: 'sl-1c', positionId: 'p-dan', qty: 2, shift: 'Non-shift', fpkLineId: 'fl-5c' },
    ],
    pdf: att('at-s1', 'PDF SPK', 'SPK_GDN_2026_014.pdf', 'u-wakil', '2026-06-10'),
    inputBy: 'u-wakil', inputAt: '2026-06-10', verifiedBy: 'u-fin1', verifiedAt: '2026-06-11',
  },
  {
    id: 'sp-2', number: 'SPK/SPL/2026/022', type: 'baru', fpkId: 'f-0008', clientId: 'c-spl', siteId: 's-spl-tmb',
    periodStart: '2026-09-01', periodEnd: '2027-08-31', monthlyValue: 70_000_000, status: 'aktif', verdict: 'cocok',
    lines: [
      { id: 'sl-2a', positionId: 'p-sat', qty: 6, shift: 'Pagi', fpkLineId: 'fl-8a' },
      { id: 'sl-2b', positionId: 'p-dan', qty: 2, shift: 'Non-shift', fpkLineId: 'fl-8c' },
    ],
    pdf: att('at-s2', 'PDF SPK', 'SPK_SPL_2026_022.pdf', 'u-mkt1', '2026-09-20'),
    inputBy: 'u-mkt1', inputAt: '2026-09-20', verifiedBy: 'u-fin2', verifiedAt: '2026-09-21',
  },
  {
    id: 'sp-6', number: 'SPK/SPL/2026/027', type: 'baru', fpkId: 'f-0008', clientId: 'c-spl', siteId: 's-spl-tmb',
    periodStart: '2026-09-01', periodEnd: '2027-08-31', monthlyValue: 38_000_000, status: 'perlu_revisi', verdict: 'salah', invoiceHeld: true,
    revisionReason: 'Nilai per bulan di SPK Rp 38 juta, seharusnya Rp 50 juta sesuai BOQ.',
    lines: [{ id: 'sl-6a', positionId: 'p-sat', qty: 6, shift: 'Malam', fpkLineId: 'fl-8b' }],
    pdf: att('at-s6', 'PDF SPK', 'SPK_SPL_2026_027.pdf', 'u-mkt1', '2026-10-29'),
    inputBy: 'u-mkt1', inputAt: '2026-10-29', verifiedBy: 'u-fin2', verifiedAt: '2026-10-30',
  },
  {
    id: 'sp-3', number: 'SPK/CLA/2026/031', type: 'baru', fpkId: 'f-0010', clientId: 'c-cla', siteId: 's-cla-ckr',
    periodStart: '2026-11-01', periodEnd: '2027-10-19', monthlyValue: 160_000_000, status: 'diinput',
    lines: [
      { id: 'sl-3a', positionId: 'p-sat', qty: 5, shift: 'Pagi', fpkLineId: 'fl-10a' },
      { id: 'sl-3b', positionId: 'p-sat', qty: 5, shift: 'Malam', fpkLineId: 'fl-10b' },
      { id: 'sl-3c', positionId: 'p-dan', qty: 2, shift: 'Non-shift', fpkLineId: 'fl-10c' },
    ],
    pdf: att('at-s3', 'PDF SPK', 'SPK_CLA_2026_031.pdf', 'u-mkt1', '2026-11-11'),
    inputBy: 'u-mkt1', inputAt: '2026-11-11',
  },
  {
    id: 'sp-4', number: 'SPK/KTM/2025/007', type: 'baru', clientId: 'c-ktm', siteId: 's-ktm-krb',
    periodStart: '2025-01-16', periodEnd: '2027-01-15', monthlyValue: 112_000_000, status: 'aktif', isInitialData: true,
    lines: [
      { id: 'sl-4a', positionId: 'p-sat', qty: 10, shift: 'Non-shift' },
      { id: 'sl-4b', positionId: 'p-dan', qty: 2, shift: 'Non-shift' },
    ],
    pdf: att('at-s4', 'PDF SPK', 'SPK_KTM_2025_007.pdf', 'u-admin', '2026-11-02'),
    inputBy: 'u-admin', inputAt: '2026-11-02',
  },
  {
    id: 'sp-5', number: 'SPK/ARP/2026/003', type: 'baru', clientId: 'c-arp', siteId: 's-arp-cdn',
    periodStart: '2026-03-01', periodEnd: '2027-02-28', monthlyValue: 70_000_000, status: 'aktif', isInitialData: true,
    lines: [
      { id: 'sl-5a', positionId: 'p-sat', qty: 8, shift: 'Non-shift' },
      { id: 'sl-5b', positionId: 'p-dan', qty: 1, shift: 'Non-shift' },
    ],
    pdf: att('at-s5', 'PDF SPK', 'SPK_ARP_2026_003.pdf', 'u-admin', '2026-11-02'),
    inputBy: 'u-admin', inputAt: '2026-11-02',
  },
  {
    id: 'sp-7', number: 'SPK/CLA/2026/004', type: 'baru', clientId: 'c-cla', siteId: 's-cla-hq',
    periodStart: '2026-02-01', periodEnd: '2027-01-31', monthlyValue: 46_000_000, status: 'aktif', isInitialData: true,
    lines: [
      { id: 'sl-7a', positionId: 'p-sat', qty: 4, shift: 'Non-shift' },
      { id: 'sl-7b', positionId: 'p-cctv', qty: 1, shift: 'Non-shift' },
    ],
    pdf: att('at-s7', 'PDF SPK', 'SPK_CLA_2026_004.pdf', 'u-admin', '2026-11-02'),
    inputBy: 'u-admin', inputAt: '2026-11-02',
  },
  {
    id: 'sp-8', number: 'SPK/GDN/2026/001', type: 'baru', clientId: 'c-gdn', siteId: 's-gdn-hq',
    periodStart: '2026-01-01', periodEnd: '2026-12-31', monthlyValue: 55_000_000, status: 'aktif', isInitialData: true,
    lines: [{ id: 'sl-8a', positionId: 'p-sat', qty: 6, shift: 'Non-shift' }],
    pdf: att('at-s8', 'PDF SPK', 'SPK_GDN_2026_001.pdf', 'u-admin', '2026-11-02'),
    inputBy: 'u-admin', inputAt: '2026-11-02',
  },
  {
    id: 'sp-9', number: 'SPK/SPL/2026/009', type: 'baru', clientId: 'c-spl', siteId: 's-spl-ctr',
    periodStart: '2026-04-01', periodEnd: '2027-03-31', monthlyValue: 60_000_000, status: 'aktif', isInitialData: true,
    lines: [
      { id: 'sl-9a', positionId: 'p-sat', qty: 6, shift: 'Non-shift' },
      { id: 'sl-9b', positionId: 'p-dan', qty: 1, shift: 'Non-shift' },
    ],
    pdf: att('at-s9', 'PDF SPK', 'SPK_SPL_2026_009.pdf', 'u-admin', '2026-11-02'),
    inputBy: 'u-admin', inputAt: '2026-11-02',
  },
];

export const SEED_MEMOS: Memo[] = [
  {
    id: 'm-1', spkId: 'sp-8', type: 'perpanjangan_ump', number: '018/JISS-MKT/X/2026', status: 'terkirim', sentAt: '2026-10-28', createdBy: 'u-wakil', createdAt: '2026-10-18',
    versions: [{
      no: 1, newValue: 58_500_000, periodStart: '2027-01-01', periodEnd: '2027-12-31', estCost: 50_800_000, marginPct: 13.2, createdBy: 'u-wakil', createdAt: '2026-10-18',
      boq: att('at-m1b', 'BOQ', 'BOQ_GDN_HQ_2027.pdf', 'u-wakil', '2026-10-18'),
      bodDecision: { decision: 'setujui', by: 'u-bod', at: '2026-10-22 10:00' },
    }],
    draftPdf: att('at-m1d', 'PDF memo', '018_JISS-MKT_X_2026_draf.pdf', 'u-bod', '2026-10-22'),
    signedPdf: att('at-m1s', 'PDF memo', '018_JISS-MKT_X_2026_ttd.pdf', 'u-wakil', '2026-10-27'),
    proof: att('at-m1p', 'Bukti kirim', 'Tanda_terima_GDN.jpg', 'u-wakil', '2026-10-28'),
  },
];

// ---------- Personel (dibangkitkan dari daftar nama fiktif) ----------
const FIRST = ['Adi', 'Bayu', 'Candra', 'Dimas', 'Eko', 'Fikri', 'Galih', 'Hendra', 'Irfan', 'Joko', 'Kurnia', 'Lukman', 'Made', 'Nur', 'Oki', 'Putra', 'Rizal', 'Slamet', 'Taufik', 'Udin', 'Wahyu', 'Yanto', 'Zainal', 'Arif', 'Bowo', 'Deni', 'Edi', 'Feri'];
const LAST = ['Saputra', 'Hidayat', 'Kurniawan', 'Setiawan', 'Gunawan', 'Prasetyo', 'Wibowo', 'Santoso', 'Nugroho', 'Firmansyah', 'Ramdani', 'Susanto', 'Maulana', 'Syahputra'];
const SIZES: Personnel['uniformSize'][] = ['M', 'L', 'L', 'XL', 'M', 'XXL'];

let seq = 0;
const mk = (positionId: string, status: PersonnelStatus, areaId?: string, siteId?: string, start = '2026-01-05', ids?: { fpkId?: string; spkId?: string }): Personnel => {
  seq++;
  const name = `${FIRST[(seq * 7) % FIRST.length]} ${LAST[(seq * 5) % LAST.length]}`;
  return {
    id: `ps-${seq}`,
    employeeNo: `SEC-${String(1000 + seq)}`,
    name,
    positionId,
    status,
    uniformSize: SIZES[seq % SIZES.length],
    shoeSize: 39 + (seq % 6),
    placements: areaId ? [{ areaId, siteId, start, ...ids }] : [],
  };
};
const many = (n: number, f: () => Personnel) => Array.from({ length: n }, f);

export const SEED_PERSONNEL: Personnel[] = [
  // Bekasi — Data Center Cibitung (SPK sp-1)
  ...many(8, () => mk('p-sat', 'aktif', 'a-bks', 's-gdn-dc1', '2026-06-01', { fpkId: 'f-0005', spkId: 'sp-1' })),
  ...many(2, () => mk('p-dan', 'aktif', 'a-bks', 's-gdn-dc1', '2026-06-01', { fpkId: 'f-0005', spkId: 'sp-1' })),
  // Bekasi — Pabrik Tambun (FPK f-0008, sebagian tertutup sp-2)
  ...many(12, () => mk('p-sat', 'aktif', 'a-bks', 's-spl-tmb', '2026-09-01', { fpkId: 'f-0008' })),
  ...many(2, () => mk('p-dan', 'aktif', 'a-bks', 's-spl-tmb', '2026-09-01', { fpkId: 'f-0008' })),
  // Bekasi — Pabrik Cikarang (jalan tanpa SPK, f-0010)
  ...many(10, () => mk('p-sat', 'aktif', 'a-bks', 's-cla-ckr', '2026-10-20', { fpkId: 'f-0010' })),
  ...many(2, () => mk('p-dan', 'aktif', 'a-bks', 's-cla-ckr', '2026-10-20', { fpkId: 'f-0010' })),
  // Bekasi — standby
  ...many(3, () => mk('p-sat', 'standby', 'a-bks')),
  // Karawang — KTM (sp-4, kuota 12, aktif 11)
  ...many(9, () => mk('p-sat', 'aktif', 'a-krw', 's-ktm-krb', '2025-01-16', { spkId: 'sp-4' })),
  ...many(2, () => mk('p-dan', 'aktif', 'a-krw', 's-ktm-krb', '2025-01-16', { spkId: 'sp-4' })),
  mk('p-sat', 'nonaktif_sementara', 'a-krw', 's-ktm-krb', '2025-01-16', { spkId: 'sp-4' }),
  // Jakarta Pusat — GDN HQ (sp-8, kuota 6)
  ...many(6, () => mk('p-sat', 'aktif', 'a-jkp', 's-gdn-hq', '2026-01-01', { spkId: 'sp-8' })),
  // Jakarta Selatan — CLA HQ (sp-7, kuota 5)
  ...many(4, () => mk('p-sat', 'aktif', 'a-jks', 's-cla-hq', '2026-02-01', { spkId: 'sp-7' })),
  mk('p-cctv', 'aktif', 'a-jks', 's-cla-hq', '2026-02-01', { spkId: 'sp-7' }),
  mk('p-chf', 'standby', 'a-jks'),
  // Tangerang — ARP Cendana (sp-5, kuota 9) — 2 orang sumber mutasi FPK 0009
  ...many(8, () => mk('p-sat', 'aktif', 'a-tgr', 's-arp-cdn', '2026-03-01', { spkId: 'sp-5' })),
  mk('p-dan', 'aktif', 'a-tgr', 's-arp-cdn', '2026-03-01', { spkId: 'sp-5' }),
  // Bogor — SPL Citeureup (sp-9, kuota 7, aktif 6)
  ...many(5, () => mk('p-sat', 'aktif', 'a-bgr', 's-spl-ctr', '2026-04-01', { spkId: 'sp-9' })),
  mk('p-dan', 'aktif', 'a-bgr', 's-spl-ctr', '2026-04-01', { spkId: 'sp-9' }),
  // Jakarta Pusat — Gudang Pulogadung (FPK 0007 disetujui, mulai jaga hari ini)
  ...many(3, () => mk('p-sat', 'terdaftar', 'a-jkp', 's-spl-pgd', '2026-11-12', { fpkId: 'f-0007' })),
  // Surabaya — standby
  ...many(2, () => mk('p-sat', 'standby', 'a-sby')),
  // Keluar
  mk('p-sat', 'keluar', 'a-bgr', undefined, '2025-06-01'),
];

// ---------- Tugas ----------
export const SEED_TASKS: Task[] = [
  { id: 't-1', kind: 'setujui_fpk', title: 'Setujui FPK/2026/0012 — PT Kencana Tekstil Mandiri', refType: 'fpk', refId: 'f-0012', assigneeRole: 'BOD', createdAt: '2026-11-06', dueAt: '2026-11-11', status: 'terbuka' },
  { id: 't-2', kind: 'cek_fpk', title: 'Cek FPK/2026/0013 (Recruitment) — PT Bumi Kemas Plastindo', refType: 'fpk', refId: 'f-0013', assigneeRole: 'Recruitment', assigneeUserId: 'u-rec', division: 'Recruitment', createdAt: '2026-11-11', dueAt: '2026-11-12', status: 'terbuka' },
  { id: 't-3', kind: 'cek_fpk', title: 'Cek FPK/2026/0013 (Pengadaan) — PT Bumi Kemas Plastindo', refType: 'fpk', refId: 'f-0013', assigneeRole: 'Pengadaan', assigneeUserId: 'u-peng', division: 'Pengadaan', createdAt: '2026-11-11', dueAt: '2026-11-12', status: 'terbuka' },
  { id: 't-3b', kind: 'cek_fpk', title: 'Cek FPK/2026/0013 (Operasional) — PT Bumi Kemas Plastindo', refType: 'fpk', refId: 'f-0013', assigneeRole: 'Operasional', assigneeUserId: 'u-ops2', division: 'Operasional', createdAt: '2026-11-11', dueAt: '2026-11-12', status: 'selesai', doneBy: 'u-ops2', doneAt: '2026-11-11 15:00' },
  { id: 't-4', kind: 'cek_margin', title: 'Cek margin FPK/2026/0006 — PT Cahaya Logam Abadi', refType: 'fpk', refId: 'f-0006', assigneeRole: 'Finance', assigneeUserId: 'u-fin1', division: 'Finance', createdAt: '2026-11-11', dueAt: '2026-11-12', status: 'terbuka' },
  { id: 't-5', kind: 'perbaiki_fpk', title: 'Perbaiki FPK/2026/0011 yang dikembalikan — PT Tirta Hijau Lestari', refType: 'fpk', refId: 'f-0011', assigneeRole: 'Marketing', assigneeUserId: 'u-mkt1', createdAt: '2026-11-10', dueAt: '2026-11-12', status: 'terbuka' },
  { id: 't-6', kind: 'serah_hr', title: 'Serahkan 4 calon personel ke HR — FPK/2026/0009', refType: 'fpk', refId: 'f-0009', assigneeRole: 'Recruitment', assigneeUserId: 'u-rec', createdAt: '2026-11-02', dueAt: '2026-11-13', status: 'terbuka' },
  { id: 't-7', kind: 'lepas_mutasi', title: 'Lepas 2 personel dari Klaster Cendana untuk mutasi — FPK/2026/0009', refType: 'fpk', refId: 'f-0009', subKey: 'fl-9a:1', assigneeRole: 'Operasional', assigneeUserId: 'u-ops2', division: 'Operasional', createdAt: '2026-11-02', dueAt: '2026-11-13', status: 'terbuka' },
  { id: 't-15', kind: 'catat_jawaban', title: 'Catat jawaban klien untuk 018/JISS-MKT/X/2026 — PT Graha Data Nusantara', refType: 'memo', refId: 'm-1', assigneeRole: 'Marketing', assigneeUserId: 'u-wakil', createdAt: '2026-10-28', dueAt: '2026-12-01', status: 'terbuka', customEscalation: 'BOD di H-30 bila belum dijawab' },
  { id: 't-14', kind: 'ubah_penempatan', title: 'Tempatkan 1 personel standby — FPK/2026/0009', refType: 'fpk', refId: 'f-0009', assigneeRole: 'HR', assigneeUserId: 'u-hr', createdAt: '2026-11-02', dueAt: '2026-11-13', status: 'terbuka' },
  { id: 't-8', kind: 'mulai_jaga', title: 'Konfirmasi mulai jaga di Apartemen Kebayoran — FPK/2026/0009', refType: 'fpk', refId: 'f-0009', assigneeRole: 'PIC Area', assigneeUserId: 'u-pic2', createdAt: '2026-11-02', dueAt: '2026-11-16', status: 'terbuka' },
  { id: 't-13', kind: 'mulai_jaga', title: 'Konfirmasi mulai jaga di Gudang Pulogadung — FPK/2026/0007', refType: 'fpk', refId: 'f-0007', assigneeRole: 'PIC Area', assigneeUserId: 'u-pic2', createdAt: '2026-11-05', dueAt: '2026-11-12', status: 'terbuka' },
  { id: 't-9', kind: 'verifikasi_spk', title: 'Verifikasi SPK/CLA/2026/031 — PT Cahaya Logam Abadi', refType: 'spk', refId: 'sp-3', assigneeRole: 'Finance', assigneeUserId: 'u-fin1', division: 'Finance', createdAt: '2026-11-11', dueAt: '2026-11-12', status: 'terbuka' },
  { id: 't-10', kind: 'kejar_spk', title: 'Kejar SPK Pabrik Cikarang (jalan tanpa SPK sejak 20 Okt 2026)', refType: 'fpk', refId: 'f-0010', assigneeRole: 'Marketing', assigneeUserId: 'u-mkt1', createdAt: '2026-10-20', dueAt: '2026-11-19', status: 'terbuka', customEscalation: 'Pengingat hari ke-7, 14, 21; BOD di hari ke-30', remindersSent: [7, 14, 21] },
  { id: 't-11', kind: 'urus_spk_salah', title: 'Urus revisi SPK/SPL/2026/027 ke klien (invoice ditahan)', refType: 'spk', refId: 'sp-6', assigneeRole: 'Marketing', assigneeUserId: 'u-mkt1', createdAt: '2026-10-30', dueAt: '2026-11-13', status: 'terbuka', customEscalation: 'BOD di hari ke-14' },
  { id: 't-12', kind: 'memo', title: 'Pilih jenis memo SPK/KTM/2025/007 (data awal, berakhir 15 Jan 2027)', refType: 'spk', refId: 'sp-4', assigneeRole: 'Marketing', assigneeUserId: 'u-wakil', createdAt: '2026-11-02', dueAt: '2026-11-09', status: 'terbuka' },
];

export const SEED_NOTIFICATIONS: Notification[] = [
  { id: 'n-1', at: '2026-11-02 09:00', text: 'FPK/2026/0009 disetujui BOD. Mulai jaga 16 Nov 2026 di Apartemen Kebayoran.', toUserIds: ['u-ops2', 'u-rec', 'u-peng', 'u-fin2', 'u-pic2', 'u-wakil', 'u-mkt1'], refType: 'fpk', refId: 'f-0009', readBy: [] },
  { id: 'n-2', at: '2026-11-11 10:05', text: 'SPK/CLA/2026/031 diinput dan menunggu verifikasi Finance.', toUserIds: ['u-fin1', 'u-mkt1'], refType: 'spk', refId: 'sp-3', readBy: [] },
  { id: 'n-3', at: '2026-11-03 11:00', text: 'FPK/2026/0012 ditandai tidak layak oleh Recruitment. Tanda tampil di layar persetujuan BOD.', toUserIds: ['u-bod', 'u-wakil'], refType: 'fpk', refId: 'f-0012', readBy: [] },
];

export const SEED_AUDIT: AuditEntry[] = [
  { id: 'au-1', at: '2026-11-02 08:30', actorId: 'u-admin', entity: 'import', entityId: 'imp-1', action: 'Import SPK aktif (data awal)', after: '5 baris disimpan, 0 gagal' },
  { id: 'au-2', at: '2026-11-02 09:00', actorId: 'u-bod', entity: 'fpk', entityId: 'f-0009', action: 'Status FPK: menunggu BOD → disetujui' },
  { id: 'au-3', at: '2026-11-05 16:00', actorId: 'u-fin1', entity: 'fpk', entityId: 'f-0012', action: 'Cek margin selesai', after: 'Estimasi biaya Rp 128.100.000, margin 8,5%', hasMoney: true },
  { id: 'au-4', at: '2026-11-11 10:05', actorId: 'u-mkt1', entity: 'spk', entityId: 'sp-3', action: 'SPK diinput' },
  { id: 'au-5', at: '2026-11-11 15:00', actorId: 'u-ops2', entity: 'fpk', entityId: 'f-0013', action: 'Cek Operasional: cocok' },
];
