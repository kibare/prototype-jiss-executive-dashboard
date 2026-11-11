// Penyelesaian tugas manual, pengalihan tugas, status personel, dan pencatatan akses lampiran.
import type { Result, Tx } from './store';
import { fail, ok } from './store';
import type { PersonnelStatus, Task } from '../domain/types';
import { NOW, TODAY, diffDays, fmtDate } from '../domain/time';
import { taskReason, escalationHeadRole, type TaskCtx } from '../domain/tasks';
import { has } from '../domain/rbac';

/** Jenis tugas yang ditutup langsung dari kartunya (tanpa layar dokumen khusus). */
export const MANUAL_KINDS: Task['kind'][] = ['penyesuaian_fpk', 'cari_pengganti', 'demobilisasi', 'margin_spk'];

const siteOfTask = (tx: Tx, t: Task) => {
  if (t.refType === 'fpk') return tx.s.fpks.find(f => f.id === t.refId)?.versions.at(-1)?.siteId;
  if (t.refType === 'spk') return tx.s.spks.find(s => s.id === t.refId)?.siteId;
  if (t.refType === 'memo') {
    const m = tx.s.memos.find(x => x.id === t.refId);
    return tx.s.spks.find(s => s.id === m?.spkId)?.siteId;
  }
  return undefined;
};

export function buildTaskActions(exec: (fn: (tx: Tx) => Result) => Result, ctx: () => TaskCtx) {
  const completeTask = (taskId: string, note: string, choice?: 'terima' | 'nego') => exec(tx => {
    const t = tx.s.tasks.find(x => x.id === taskId);
    if (!t || t.status !== 'terbuka') return fail('Tugas sudah tidak terbuka.');
    if (!MANUAL_KINDS.includes(t.kind)) return fail('Tugas ini diselesaikan lewat aksi di dokumennya.');
    if (!taskReason(tx.me, t, ctx())) return fail('Tugas ini bukan untuk Anda.');
    if ((t.kind === 'cari_pengganti' || t.kind === 'demobilisasi') && !note.trim()) return fail('Tulis catatan penyelesaian.');
    if (t.kind === 'margin_spk' && !choice) return fail('Pilih terima atau nego ulang.');
    if (t.kind === 'demobilisasi' && t.assigneeRole === 'HR') {
      // HR mengakhiri penempatan personel di site itu; personel kembali standby.
      const siteId = siteOfTask(tx, t);
      let n = 0;
      tx.s.personnel.forEach(p => {
        const pl = p.placements.find(x => !x.end && x.siteId === siteId);
        if (pl && ['aktif', 'terdaftar', 'calon'].includes(p.status)) { pl.end = TODAY; p.status = 'standby'; n++; }
      });
      note = `${note} (${n} penempatan diakhiri, personel jadi standby)`;
    }
    if (t.kind === 'margin_spk' && choice === 'nego') {
      const s = tx.s.spks.find(x => x.id === t.refId);
      const owner = tx.s.clients.find(c => c.id === s?.clientId)?.accountOwnerId;
      tx.notify(`BOD minta nego ulang ${s?.number} lewat addendum: ${note}`, [owner], { refType: 'spk', refId: t.refId });
    }
    t.status = 'selesai';
    t.doneBy = tx.me.id;
    t.doneAt = NOW;
    tx.audit({ entity: 'tugas', entityId: t.id, action: `Tugas selesai: ${t.title}`, after: [choice && (choice === 'terima' ? 'Terima' : 'Nego ulang lewat addendum'), note].filter(Boolean).join(' · ') || undefined });
    return ok();
  });

  /** Penerima eskalasi (kepala divisi / BOD / wakil) boleh mengalihkan tugas ke orang lain dengan peran yang sama. */
  const reassignTask = (taskId: string, userId: string) => exec(tx => {
    const t = tx.s.tasks.find(x => x.id === taskId);
    if (!t || t.status !== 'terbuka') return fail('Tugas sudah tidak terbuka.');
    const reason = taskReason(tx.me, t, ctx());
    if (!reason || reason === 'milik' || reason === 'peran') {
      if (!(has(tx.me, 'BOD') || tx.me.headOf.includes(escalationHeadRole(t.assigneeRole)))) return fail('Hanya kepala divisi atau BOD yang bisa mengalihkan.');
    }
    const target = tx.s.users.find(u => u.id === userId);
    if (!target || !target.roles.includes(t.assigneeRole)) return fail(`Pilih user dengan peran ${t.assigneeRole}.`);
    const before = tx.s.users.find(u => u.id === t.assigneeUserId)?.name ?? `semua ${t.assigneeRole}`;
    t.assigneeUserId = userId;
    tx.audit({ entity: 'tugas', entityId: t.id, action: `Tugas dialihkan: ${t.title}`, before, after: target.name });
    tx.notify(`Tugas dialihkan ke Anda oleh ${tx.me.name}: ${t.title}`, [userId], { refType: t.refType, refId: t.refId });
    return ok();
  });

  /** Penerima eskalasi turun tangan: catat tindakan + target tanggal baru. Tugas tetap milik pemilik awal; hitungan eskalasi mulai lagi dari target baru. */
  const interveneTask = (taskId: string, note: string, newDue: string) => exec(tx => {
    const t = tx.s.tasks.find(x => x.id === taskId);
    if (!t || t.status !== 'terbuka') return fail('Tugas sudah tidak terbuka.');
    const reason = taskReason(tx.me, t, ctx());
    if (reason !== 'eskalasi-kepala' && reason !== 'eskalasi-bod') return fail('Turun tangan hanya untuk tugas yang dieskalasi ke Anda.');
    if (!note.trim()) return fail('Tulis tindakan yang Anda ambil.');
    if (!newDue || diffDays(TODAY, newDue) < 0) return fail('Target tanggal baru tidak boleh sebelum hari ini.');
    t.interventions = [...(t.interventions ?? []), { by: tx.me.id, note: note.trim(), newDue, at: NOW }];
    const before = t.dueAt;
    t.dueAt = newDue;
    tx.audit({ entity: 'tugas', entityId: t.id, action: `Turun tangan: ${t.title}`, before: `Batas ${fmtDate(before)}`, after: `${note.trim()} · target baru ${fmtDate(newDue)}` });
    const owners = t.assigneeUserId ? [t.assigneeUserId] : tx.s.users.filter(u => u.active && u.roles.includes(t.assigneeRole)).map(u => u.id);
    tx.notify(`${tx.me.name} turun tangan: ${note.trim()}. Target baru ${fmtDate(newDue)} untuk "${t.title}".`, owners, { refType: t.refType, refId: t.refId });
    return ok();
  });

  const setPersonnelStatus = (personnelId: string, status: PersonnelStatus, reason: string) => exec(tx => {
    if (!has(tx.me, 'HR')) return fail('Hanya HR.');
    const p = tx.s.personnel.find(x => x.id === personnelId);
    if (!p) return fail('Personel tidak ditemukan.');
    if (p.status === 'dalam_mutasi') return fail('Personel sedang dalam mutasi dan dikunci.');
    if (!reason.trim()) return fail('Alasan wajib diisi.');
    const allowed: Record<PersonnelStatus, PersonnelStatus[]> = {
      calon: ['keluar'], terdaftar: ['standby', 'keluar'], standby: ['nonaktif_sementara', 'keluar'],
      aktif: ['nonaktif_sementara', 'standby', 'keluar'], nonaktif_sementara: ['aktif', 'standby', 'keluar'], dalam_mutasi: [], keluar: [],
    };
    if (!allowed[p.status].includes(status)) return fail('Perubahan status ini tidak diizinkan.');
    const before = p.status;
    if (status === 'keluar' || status === 'standby') p.placements.forEach(pl => { if (!pl.end && (status === 'keluar' || pl.siteId)) pl.end = TODAY; });
    if (status === 'standby') {
      const last = p.placements[p.placements.length - 1];
      if (last && last.end) p.placements.push({ areaId: last.areaId, start: TODAY });
    }
    p.status = status;
    tx.audit({ entity: 'personel', entityId: p.id, action: `Status ${p.name}: ${before.replace('_', ' ')} → ${status.replace('_', ' ')}`, after: reason });
    return ok();
  });

  /** HR menindaklanjuti mutasi yang dibatalkan setelah personel dilepas. */
  const restoreMutation = (fpkId: string, key: string, mode: 'kembali' | 'standby') => exec(tx => {
    if (!has(tx.me, 'HR')) return fail('Hanya HR.');
    const f = tx.s.fpks.find(x => x.id === fpkId);
    const m = f?.mutations?.[key];
    if (!f || !m?.cancelled || m.restored) return fail('Tidak ada mutasi batal yang menunggu.');
    m.releasedIds.forEach(id => {
      const p = tx.s.personnel.find(x => x.id === id)!;
      if (mode === 'kembali') p.status = 'aktif';
      else {
        const pl = p.placements.find(x => !x.end);
        if (pl) { pl.end = TODAY; p.placements.push({ areaId: pl.areaId, start: TODAY }); }
        p.status = 'standby';
      }
    });
    m.restored = true;
    tx.closeTasks(t => t.refId === f.id && t.kind === 'ubah_penempatan' && t.subKey === key && t.title.startsWith('Mutasi dibatalkan'));
    tx.audit({ entity: 'mutasi', entityId: f.id, action: mode === 'kembali' ? 'Personel dikembalikan ke penempatan asal' : 'Personel dijadikan standby' });
    return ok();
  });

  /** Setiap akses lampiran berisi harga dicatat di audit log. */
  const openAttachment = (fileName: string, entity: string, entityId: string) => exec(tx => {
    tx.audit({ entity, entityId, action: 'Membuka lampiran berisi harga', after: fileName });
    return ok();
  });

  return { completeTask, reassignTask, interveneTask, setPersonnelStatus, restoreMutation, openAttachment };
}
