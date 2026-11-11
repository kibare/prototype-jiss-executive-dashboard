// Job harian (PRD: pengecekan otomatis tiap pagi). Di prototipe dijalankan lewat kontrol tanggal simulasi.
import type { Result, Tx } from './store';
import { ok } from './store';
import type { Spk } from '../domain/types';
import { TODAY, addDays, addWorkdays, diffDays, fmtDate, hMinus, setToday } from '../domain/time';
import { settingNum } from '../domain/settings';
import { effectiveSpks } from '../domain/selectors';

const SYSTEM = 'sistem';
const num = (tx: Tx, key: string, fb: number) => settingNum(tx.s.settings, key, fb);
const chaseDays = (tx: Tx) =>
  (tx.s.settings.find(s => s.key === 'spk.chase_reminder_days')?.value ?? '7, 14, 21')
    .split(',').map(x => parseInt(x, 10)).filter(Number.isFinite);

const label = (tx: Tx, s: Spk) => `${s.number} — ${tx.s.clients.find(c => c.id === s.clientId)?.name}`;
const ownerOf = (tx: Tx, s: Spk) => tx.s.clients.find(c => c.id === s.clientId)?.accountOwnerId;
const activeAtSite = (tx: Tx, siteId: string) =>
  tx.s.personnel.filter(p => p.status === 'aktif' && p.placements.some(pl => !pl.end && pl.siteId === siteId)).length;

/** Satu putaran pengecekan untuk tanggal TODAY. Mengembalikan ringkasan untuk toast. */
const runChecks = (tx: Tx) => {
  const log: string[] = [];
  const audit = (entity: string, entityId: string, action: string, after?: string) => tx.audit({ entity, entityId, action, after, actorId: SYSTEM });

  // 1) SPK aktif yang periodenya sudah lewat → berakhir. Bila site masih dijaga tanpa SPK pengganti → tugas Marketing.
  tx.s.spks.filter(s => s.status === 'aktif' && diffDays(s.periodEnd, TODAY) > 0).forEach(s => {
    s.status = 'berakhir';
    audit('spk', s.id, 'Status SPK: aktif → berakhir (job harian)', `Periode selesai ${fmtDate(s.periodEnd)}`);
    log.push(`${s.number} berakhir`);
  });
  const effective = effectiveSpks(tx.s.spks);
  tx.s.spks.filter(s => s.status === 'berakhir' && !s.lapsedFrom && diffDays(s.periodEnd, TODAY) > 0).forEach(s => {
    // Addendum berbagi akhir kontrak dengan induknya: cukup dicatat di SPK induk.
    if (s.type === 'addendum') return;
    if (tx.s.spks.some(x => x.lapsedFrom && x.siteId === s.siteId)) return;
    if (effective.some(e => e.siteId === s.siteId)) return;
    if (!activeAtSite(tx, s.siteId)) return;
    const alreadyHandled = tx.s.spks.some(x => x.type === 'perpanjangan' && x.parentSpkId === s.id && x.status === 'aktif');
    if (alreadyHandled) return;
    s.lapsedFrom = addDays(s.periodEnd, 1);
    const site = tx.s.sites.find(x => x.id === s.siteId);
    tx.addTask({
      kind: 'spk_berakhir_jaga', title: `${label(tx, s)} berakhir ${fmtDate(s.periodEnd)}, personel ${site?.name} masih jaga`,
      refType: 'spk', refId: s.id, assigneeRole: 'Marketing', assigneeUserId: ownerOf(tx, s),
      dueAt: addWorkdays(TODAY, 1, tx.s.holidays), customEscalation: 'Eskalasi BOD bila lewat 1 hari kerja',
    });
    audit('spk', s.id, 'SPK berakhir tapi personel masih jaga: masuk daftar jalan tanpa SPK', `Sejak ${fmtDate(s.lapsedFrom)}`);
    tx.notify(`${label(tx, s)} sudah berakhir tapi ${site?.name} masih dijaga. Masuk daftar jalan tanpa SPK.`, [ownerOf(tx, s)], { refType: 'spk', refId: s.id });
    log.push(`${s.number}: jalan tanpa SPK`);
  });
  // Site yang sudah tidak dijaga lagi keluar dari daftar.
  tx.s.spks.filter(s => s.lapsedFrom && !activeAtSite(tx, s.siteId)).forEach(s => {
    audit('spk', s.id, 'Site tidak dijaga lagi: keluar dari daftar jalan tanpa SPK');
    s.lapsedFrom = undefined;
    tx.closeTasks(t => t.refId === s.id && t.kind === 'spk_berakhir_jaga');
  });

  // 2) Tugas memo H-75 untuk SPK yang berlaku dan belum punya memo/tugas memo/perpanjangan.
  const h = num(tx, 'memo.start_days_before_end', 75);
  const sendBy = num(tx, 'memo.send_deadline_days_before_end', 60);
  effectiveSpks(tx.s.spks).forEach(s => {
    if (diffDays(TODAY, s.periodEnd) > h) return;
    const root = s.type === 'addendum' && s.parentSpkId ? s.parentSpkId : s.id;
    const ids = new Set([s.id, root]);
    if (tx.s.memos.some(m => ids.has(m.spkId))) return;
    if (tx.s.tasks.some(t => t.kind === 'memo' && ids.has(t.refId))) return;
    if (tx.s.spks.some(x => x.type === 'perpanjangan' && x.parentSpkId && ids.has(x.parentSpkId) && x.status !== 'berakhir')) return;
    const due = hMinus(s.periodEnd, sendBy);
    const late = diffDays(TODAY, due) < 0;
    tx.addTask({
      kind: 'memo', title: `Pilih jenis memo ${s.number} (berakhir ${fmtDate(s.periodEnd)})`, refType: 'spk', refId: s.id,
      assigneeRole: 'Marketing', assigneeUserId: ownerOf(tx, s),
      dueAt: late ? addWorkdays(TODAY, num(tx, 'memo.initial_data_due_workdays', 5), tx.s.holidays) : due,
    });
    audit('spk', s.id, `Tugas memo dibuat (H-${diffDays(TODAY, s.periodEnd)})`);
    log.push(`tugas memo ${s.number}`);
  });

  // 3) Pengingat kejar SPK di hari ke-7, 14, 21 sejak mulai jaga.
  const days = chaseDays(tx);
  tx.s.tasks.filter(t => t.kind === 'kejar_spk' && t.status === 'terbuka').forEach(t => {
    const f = tx.s.fpks.find(x => x.id === t.refId);
    if (!f?.startedAt) return;
    const n = diffDays(f.startedAt, TODAY);
    const sent = t.remindersSent ?? [];
    days.filter(d => n >= d && !sent.includes(d)).forEach(d => {
      sent.push(d);
      tx.notify(`Pengingat hari ke-${d}: ${f.number} sudah ${n} hari jalan tanpa SPK. Kejar SPK ke klien.`, [t.assigneeUserId], { refType: 'fpk', refId: f.id });
      log.push(`pengingat hari ke-${d} ${f.number}`);
    });
    t.remindersSent = sent;
  });
  return log;
};

export function buildDailyActions(exec: (fn: (tx: Tx) => Result) => Result) {
  /** Majukan tanggal simulasi n hari; job harian jalan untuk setiap hari yang dilewati. n = 0 menjalankan job untuk hari ini saja. */
  const advanceDays = (n: number) => {
    let summary: string[] = [];
    const start = TODAY;
    const r = exec(tx => {
      const steps = Math.max(n, 0);
      if (steps === 0) summary = runChecks(tx);
      for (let i = 0; i < steps; i++) {
        setToday(addDays(TODAY, 1));
        summary = summary.concat(runChecks(tx));
      }
      tx.s.today = TODAY;
      return ok();
    });
    if (!r.ok) setToday(start);
    return { ...r, summary };
  };
  return { advanceDays };
}
