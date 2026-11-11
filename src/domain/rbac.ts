// Aturan akses mengikuti matriks RBAC PRD v1.2.
// Di sistem asli semua ini ditegakkan di server; di prototipe dipakai untuk menyaring tampilan.
import type { Attachment, Client, Delegation, Role, User } from './types';
import { TODAY, diffDays } from './time';

export const has = (u: User, r: Role) => u.roles.includes(r);
export const hasAny = (u: User, rs: Role[]) => rs.some(r => u.roles.includes(r));

export const isDelegationActive = (d: Delegation, today = TODAY) =>
  d.mode === 'tetap' ||
  (!!d.startDate && !!d.endDate && diffDays(d.startDate, today) >= 0 && diffDays(today, d.endDate) >= 0);

/** User yang ditunjuk sebagai wakil BOD. */
export const isDeputy = (u: User, delegations: Delegation[]) => delegations.some(d => d.deputyUserId === u.id);

/** BOD atau wakil (untuk hak lihat dan keputusan). */
export const isBodLike = (u: User, delegations: Delegation[]) => has(u, 'BOD') || isDeputy(u, delegations);

/** Field uang: Finance, BOD/wakil, dan Marketing pemegang klien (account owner / co-owner). */
export const canSeeMoney = (u: User, clientId: string | undefined, clients: Client[], delegations: Delegation[]) => {
  if (hasAny(u, ['Finance', 'BOD']) || isDeputy(u, delegations)) return true;
  if (!has(u, 'Marketing') || !clientId) return false;
  const c = clients.find(x => x.id === clientId);
  return !!c && (c.accountOwnerId === u.id || c.coOwnerIds.includes(u.id));
};

/** Lampiran berisi harga: Marketing pemegang klien, Finance, BOD; Pengadaan hanya BOQ. */
export const canOpenAttachment = (u: User, a: Attachment, clientId: string | undefined, clients: Client[], delegations: Delegation[]) => {
  if (!a.priced) return true;
  if (canSeeMoney(u, clientId, clients, delegations)) return true;
  return has(u, 'Pengadaan') && a.kind === 'BOQ';
};

const UNSCOPED: Role[] = ['Marketing', 'Recruitment', 'HR', 'Pengadaan', 'Finance', 'BOD', 'Admin sistem'];

/** Lingkup area: PIC Area dan Operasional hanya melihat area yang dipegang (kecuali punya peran lain yang tidak dibatasi). */
export const canSeeArea = (u: User, areaId: string, delegations: Delegation[]) =>
  // Kepala Operasional (tujuan eskalasi tugas Ops dan PIC area) melihat semua area.
  hasAny(u, UNSCOPED) || isDeputy(u, delegations) || u.headOf.includes('Operasional') || u.areaIds.includes(areaId);

export type Perm =
  | 'tasks.view'
  | 'decisions.view'
  | 'master.view'
  | 'master.edit'
  | 'security.view'
  | 'fpk.view'
  | 'fpk.create'
  | 'spk.view'
  | 'spk.input'
  | 'memo.view'
  | 'admin.view'
  | 'admin.edit'
  | 'audit.view'
  | 'delegation.edit'
  | 'dashboard.view';

const PERMS: Record<Perm, Role[]> = {
  'tasks.view': ['Marketing', 'Operasional', 'Recruitment', 'HR', 'PIC Area', 'Pengadaan', 'Finance', 'BOD'],
  'decisions.view': ['BOD'],
  'master.view': ['Marketing', 'Operasional', 'Recruitment', 'HR', 'PIC Area', 'Pengadaan', 'Finance', 'BOD', 'Admin sistem'],
  'master.edit': ['Admin sistem'],
  'security.view': ['Operasional', 'Recruitment', 'HR', 'PIC Area', 'Pengadaan', 'BOD', 'Admin sistem'],
  'fpk.view': ['Marketing', 'Operasional', 'Recruitment', 'HR', 'PIC Area', 'Pengadaan', 'Finance', 'BOD'],
  'fpk.create': ['Marketing'],
  'spk.view': ['Marketing', 'Operasional', 'HR', 'PIC Area', 'Finance', 'BOD', 'Admin sistem'],
  'spk.input': ['Marketing'],
  'memo.view': ['Marketing', 'Operasional', 'HR', 'Finance', 'BOD'],
  'admin.view': ['BOD', 'Admin sistem'],
  'admin.edit': ['Admin sistem'],
  'audit.view': ['BOD', 'Admin sistem'],
  'delegation.edit': ['BOD', 'Admin sistem'],
  'dashboard.view': ['BOD'],
};

/** Wakil BOD mendapat hak lihat BOD untuk keputusan dan dokumen. */
const DEPUTY_PERMS: Perm[] = ['decisions.view', 'fpk.view', 'spk.view', 'memo.view', 'tasks.view'];

export const can = (u: User, p: Perm, delegations: Delegation[]) =>
  hasAny(u, PERMS[p]) || (isDeputy(u, delegations) && DEPUTY_PERMS.includes(p));
