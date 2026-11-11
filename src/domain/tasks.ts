// Mesin tugas: penerima, batas waktu, dan eskalasi (PRD bagian Notifikasi).
import type { Delegation, Division, Holiday, Role, Setting, Site, SiteAssignment, Task, User } from './types';
import { TODAY, addWorkdays, diffDays } from './time';
import { settingNum } from './settings';
import { has, isDelegationActive } from './rbac';

export interface Escalation {
  overdue: boolean;
  daysLate: number;
  /** 0 = belum lewat, 1 = muncul di kepala divisi (atau wakil untuk tugas BOD), 2 = naik ke BOD. */
  level: 0 | 1 | 2;
  label?: string;
}

export const escalationOf = (t: Task, settings: Setting[], holidays: Holiday[], today = TODAY): Escalation => {
  if (t.status !== 'terbuka') return { overdue: false, daysLate: 0, level: 0 };
  const late = diffDays(t.dueAt, today);
  const overdue = late > 0;
  if (t.kind === 'kejar_spk') {
    // Hari ke-30 sejak mulai jaga = batas; pengingat di 7, 14, 21.
    return overdue
      ? { overdue, daysLate: late, level: 2, label: 'Lewat 30 hari: eskalasi BOD' }
      : { overdue, daysLate: 0, level: 0 };
  }
  if (t.kind === 'memo' || t.kind === 'kirim_memo') {
    return overdue ? { overdue, daysLate: late, level: 2, label: 'Memo belum terkirim di H-60: eskalasi BOD' } : { overdue, daysLate: 0, level: 0 };
  }
  if (t.kind === 'catat_jawaban') {
    return overdue ? { overdue, daysLate: late, level: 2, label: 'Belum dijawab di H-30: eskalasi BOD' } : { overdue, daysLate: 0, level: 0 };
  }
  if (t.kind === 'spk_berakhir_jaga') {
    return overdue ? { overdue, daysLate: late, level: 2, label: 'Lewat batas: eskalasi BOD' } : { overdue, daysLate: 0, level: 0 };
  }
  if (t.kind === 'urus_spk_salah') {
    return overdue ? { overdue, daysLate: late, level: 2, label: 'Lewat 14 hari: BOD turun tangan' } : { overdue, daysLate: 0, level: 0 };
  }
  if (!overdue) return { overdue, daysLate: 0, level: 0 };
  if (t.assigneeRole === 'BOD') return { overdue, daysLate: late, level: 1, label: 'Lewat batas: muncul juga di wakil BOD' };
  const bodAt = addWorkdays(t.dueAt, settingNum(settings, 'escalation.bod_after_workdays', 2), holidays);
  if (diffDays(bodAt, today) >= 0) return { overdue, daysLate: late, level: 2, label: 'Naik ke BOD' };
  return { overdue, daysLate: late, level: 1, label: t.assigneeRole === 'PIC Area' ? 'Muncul di kepala Operasional' : 'Muncul di kepala divisi' };
};

/** Peran kepala yang jadi tujuan eskalasi pertama. Tugas PIC area naik ke kepala Operasional (tabel notifikasi PRD). */
export const escalationHeadRole = (r: Role): Role => (r === 'PIC Area' ? 'Operasional' : r);

/**
 * Wakil BOD boleh memutuskan atas nama BOD bila delegasi periode aktif,
 * atau (mode tetap) bila tugas BOD-nya sudah lewat batas.
 */
export const deputyMayAct = (u: User, delegations: Delegation[], bodTask: Task | undefined, today = TODAY) => {
  const d = delegations.find(x => x.deputyUserId === u.id && isDelegationActive(x, today));
  if (!d) return false;
  if (d.mode === 'periode') return true;
  return !!bodTask && bodTask.status === 'terbuka' && diffDays(bodTask.dueAt, today) > 0;
};

export type TaskReason = 'milik' | 'peran' | 'eskalasi-kepala' | 'eskalasi-bod' | 'wakil';

export interface TaskCtx {
  delegations: Delegation[];
  settings: Setting[];
  holidays: Holiday[];
  /** Pembuat dokumen yang dirujuk tugas (untuk aturan pembuat ≠ penyetuju). */
  creatorOf: (t: Task) => string | undefined;
  /** Area dokumen yang dirujuk tugas (untuk lingkup PIC Area / Operasional). */
  areaOf: (t: Task) => string | undefined;
  users: User[];
}

/** Kenapa tugas ini muncul untuk user (atau null bila tidak). */
export const taskReason = (u: User, t: Task, ctx: TaskCtx): TaskReason | null => {
  if (t.status !== 'terbuka') return null;
  if (t.assigneeUserId === u.id) return 'milik';
  const esc = escalationOf(t, ctx.settings, ctx.holidays);

  if (t.assigneeRole === 'BOD') {
    if (has(u, 'BOD')) return 'peran';
    const deputyOf = ctx.delegations.find(d => d.deputyUserId === u.id && isDelegationActive(d));
    if (deputyOf && ctx.creatorOf(t) !== u.id) {
      if (deputyOf.mode === 'periode' || esc.level >= 1) return 'wakil';
    }
    return null;
  }

  if (!t.assigneeUserId && has(u, t.assigneeRole)) {
    const area = ctx.areaOf(t);
    if ((t.assigneeRole === 'PIC Area' || t.assigneeRole === 'Operasional') && area && !u.areaIds.includes(area)) {
      // di luar lingkup
    } else return 'peran';
  }
  const headRole = escalationHeadRole(t.assigneeRole);
  const hasHead = ctx.users.some(x => x.active && x.headOf.includes(headRole));
  if (esc.level >= 1 && u.headOf.includes(headRole)) return 'eskalasi-kepala';
  // Bila peran itu belum punya kepala divisi, eskalasi langsung ke BOD.
  if (esc.level >= 2 && has(u, 'BOD')) return 'eskalasi-bod';
  if (esc.level >= 1 && !hasHead && has(u, 'BOD')) return 'eskalasi-bod';
  return null;
};

/** Penerima tugas: divisi terkait site → default klien → kepala divisi → (kosong = BOD). */
export const resolveAssignee = (
  division: Division,
  clientId: string,
  siteId: string | undefined,
  assignments: SiteAssignment[],
  users: User[],
  sites: Site[] = [],
): string | undefined => {
  const bySite = siteId ? assignments.find(a => a.siteId === siteId && a.division === division) : undefined;
  if (bySite) return bySite.userId;
  const byClient = assignments.find(a => a.clientId === clientId && !a.siteId && a.division === division);
  if (byClient) return byClient.userId;
  // Operasional dibatasi lingkup area: pilih Ops yang memegang area site ini sebelum jatuh ke kepala divisi.
  if (division === 'Operasional' && siteId) {
    const areaId = sites.find(s => s.id === siteId)?.areaId;
    const ops = users.find(u => u.active && u.roles.includes('Operasional') && !!areaId && u.areaIds.includes(areaId));
    if (ops) return ops.id;
  }
  return users.find(u => u.active && u.headOf.includes(division as Role))?.id;
};

export const TASK_KIND_LABEL: Record<Task['kind'], string> = {
  cek_fpk: 'Cek FPK',
  survei: 'Survei lokasi',
  cek_margin: 'Cek margin',
  setujui_fpk: 'Persetujuan FPK',
  perbaiki_fpk: 'Perbaiki FPK',
  serah_hr: 'Serahkan ke HR',
  tandai_terdaftar: 'Tandai terdaftar',
  mulai_jaga: 'Mulai jaga',
  lepas_mutasi: 'Lepas personel (mutasi)',
  ubah_penempatan: 'Ubah penempatan',
  verifikasi_spk: 'Verifikasi SPK',
  urus_spk_salah: 'SPK perlu revisi',
  kejar_spk: 'Kejar SPK',
  penyesuaian_fpk: 'Penyesuaian FPK',
  margin_spk: 'Margin SPK di bawah minimum',
  memo: 'Memo eksternal',
  setujui_memo: 'Persetujuan memo',
  cek_margin_memo: 'Cek margin memo',
  kirim_memo: 'Kirim memo',
  catat_jawaban: 'Jawaban klien',
  input_spk_perpanjangan: 'Input SPK perpanjangan',
  info_invoice_akhir: 'Invoice terakhir',
  cari_pengganti: 'Cari pengganti',
  spk_berakhir_jaga: 'SPK berakhir, personel masih jaga',
  demobilisasi: 'Demobilisasi',
};
