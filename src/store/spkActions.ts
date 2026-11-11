// Aksi SPK: input, verifikasi Finance, cakupan kuota FPK (PRD bagian SPK).
import type { Result, Tx } from './store';
import { fail, ok } from './store';
import type { Fpk, Shift, Spk, SpkType } from '../domain/types';
import { NOW, TODAY, addDays, addWorkdays, diffDays, fmtDate, fmtRp } from '../domain/time';
import { settingNum } from '../domain/settings';
import { resolveAssignee } from '../domain/tasks';
import { fpkCoverage, latest } from '../domain/selectors';
import { has } from '../domain/rbac';

export interface SpkInput {
  number: string;
  type: SpkType;
  parentSpkId?: string;
  fpkId?: string;
  siteId: string;
  periodStart: string;
  periodEnd: string;
  effectiveDate?: string;
  monthlyValue: number;
  lines: { positionId: string; qty: number; shift: Shift; fpkLineId?: string }[];
  pdfName: string;
}

const num = (tx: Tx, key: string, fb: number) => settingNum(tx.s.settings, key, fb);

/** Setelah SPK aktif: perbarui status FPK (tertutup sebagian / selesai) dan tutup tugas kejar SPK bila penuh. */
const refreshFpk = (tx: Tx, f: Fpk) => {
  if (!['berjalan', 'tertutup_sebagian', 'disetujui'].includes(f.status)) return;
  const cov = fpkCoverage(f, tx.s.spks);
  if (f.status === 'disetujui') {
    // Belum mulai jaga: status FPK tetap "disetujui" supaya PIC area masih bisa konfirmasi mulai jaga.
    tx.audit({ entity: 'fpk', entityId: f.id, action: 'SPK aktif sebelum mulai jaga', after: `${cov.done}/${cov.total} orang tertutup SPK` });
    return;
  }
  const before = f.status;
  if (cov.done >= cov.total && cov.total > 0) {
    f.status = 'selesai';
    tx.closeTasks(t => t.refId === f.id && t.kind === 'kejar_spk');
  } else if (cov.done > 0) f.status = 'tertutup_sebagian';
  if (before !== f.status) tx.audit({ entity: 'fpk', entityId: f.id, action: `Status FPK: ${before.replace('_', ' ')} → ${f.status.replace('_', ' ')} (otomatis dari SPK aktif)`, after: `${cov.done}/${cov.total} orang tertutup SPK` });
};

const financeVerifier = (tx: Tx, s: Spk) => {
  const preferred = resolveAssignee('Finance', s.clientId, s.siteId, tx.s.assignments, tx.s.users, tx.s.sites);
  if (preferred && preferred !== s.inputBy) return preferred;
  return tx.s.users.find(u => u.active && u.roles.includes('Finance') && u.id !== s.inputBy)?.id;
};

export function buildSpkActions(exec: (fn: (tx: Tx) => Result) => Result) {
  const inputSpk = (input: SpkInput, reviseId?: string) => exec(tx => {
    if (!has(tx.me, 'Marketing')) return fail('Hanya Marketing yang menginput SPK.');
    const parent = input.parentSpkId ? tx.s.spks.find(x => x.id === input.parentSpkId) : undefined;
    // Perpanjangan mengikuti FPK SPK induknya (bila ada); isi dibandingkan dengan SPK induk dan memo yang disetujui klien.
    const renewal = input.type === 'perpanjangan' && !!parent;
    const fpkId = renewal ? parent!.fpkId : input.fpkId;
    const f = fpkId ? tx.s.fpks.find(x => x.id === fpkId) : undefined;
    // Perpanjangan SPK data awal tidak punya FPK induk: klien diambil dari SPK induk.
    if (!f && !(input.type === 'perpanjangan' && parent)) return fail('Pilih FPK induk (atau SPK induk untuk perpanjangan SPK data awal).');
    const clientId = f ? latest(f).clientId : parent!.clientId;
    const client = tx.s.clients.find(c => c.id === clientId);
    if (!client || !(client.accountOwnerId === tx.me.id || client.coOwnerIds.includes(tx.me.id))) return fail('Hanya Marketing pemegang klien.');
    if (!input.number.trim()) return fail('Nomor SPK wajib diisi.');
    if (!input.siteId) return fail('Site wajib diisi.');
    if (!input.periodStart || !input.periodEnd || diffDays(input.periodStart, input.periodEnd) <= 0) return fail('Periode SPK tidak valid.');
    if (input.type === 'addendum' && (!input.parentSpkId || !input.effectiveDate)) return fail('Addendum wajib memilih SPK induk dan tanggal berlaku.');
    if (input.type === 'perpanjangan' && !input.parentSpkId) return fail('Perpanjangan wajib memilih SPK induk.');
    if (!(input.monthlyValue > 0)) return fail('Nilai per bulan wajib diisi.');
    if (!input.lines.length || input.lines.some(l => !l.positionId || !(l.qty > 0))) return fail('Isi baris jabatan dengan jumlah lebih dari 0.');
    if (f && !renewal && input.lines.some(l => !l.fpkLineId)) return fail('Setiap baris SPK harus menunjuk baris FPK yang ditutup.');
    if (renewal && parent!.status !== 'aktif' && parent!.status !== 'berakhir') return fail('SPK induk perpanjangan harus aktif atau sudah berakhir.');
    const lines = renewal
      ? input.lines.map(l => ({ ...l, fpkLineId: parent!.lines.find(x => x.positionId === l.positionId && x.shift === l.shift)?.fpkLineId }))
      : input.lines;
    if (!input.pdfName) return fail('Lampirkan PDF SPK.');
    if (tx.s.spks.some(x => x.id !== reviseId && x.clientId === clientId && x.number.trim().toLowerCase() === input.number.trim().toLowerCase())) return fail('Nomor SPK sudah dipakai untuk klien ini.');

    const base = {
      number: input.number.trim(), type: input.type, parentSpkId: input.parentSpkId, fpkId: f?.id, clientId,
      siteId: input.siteId, periodStart: input.periodStart, periodEnd: input.periodEnd, effectiveDate: input.effectiveDate, monthlyValue: input.monthlyValue,
      lines: lines.map(l => ({ id: tx.id('sl'), ...l })),
      pdf: { id: tx.id('at'), kind: 'PDF SPK' as const, fileName: input.pdfName, priced: true, uploadedBy: tx.me.id, uploadedAt: NOW },
      status: 'diinput' as const, inputBy: tx.me.id, inputAt: TODAY,
    };
    let s: Spk;
    if (reviseId) {
      const old = tx.s.spks.find(x => x.id === reviseId);
      if (!old || old.status !== 'perlu_revisi') return fail('Hanya SPK berstatus perlu revisi yang bisa diinput ulang.');
      Object.assign(old, base, { verdict: undefined, verifiedBy: undefined, verifiedAt: undefined });
      s = old;
      tx.closeTasks(t => t.refId === s.id && t.kind === 'urus_spk_salah');
      tx.audit({ entity: 'spk', entityId: s.id, action: 'SPK revisi diinput (perlu revisi → menunggu verifikasi)' });
    } else {
      s = { id: tx.id('sp'), ...base };
      tx.s.spks.unshift(s);
      tx.audit({ entity: 'spk', entityId: s.id, action: 'SPK diinput', after: s.number });
    }
    if (input.type === 'perpanjangan' && input.parentSpkId) tx.closeTasks(t => t.refId === input.parentSpkId && (t.kind === 'input_spk_perpanjangan' || t.kind === 'spk_berakhir_jaga'));
    tx.addTask({
      kind: 'verifikasi_spk', title: `Verifikasi ${s.number} — ${tx.s.clients.find(c => c.id === s.clientId)?.name}`, refType: 'spk', refId: s.id,
      assigneeRole: 'Finance', assigneeUserId: financeVerifier(tx, s), division: 'Finance',
      dueAt: addWorkdays(TODAY, num(tx, 'spk.verify_due_workdays', 1), tx.s.holidays),
    });
    return ok(s.id);
  });

  const verifySpk = (spkId: string, verdict: 'cocok' | 'salah' | 'benar', reason: string, hasDiff: boolean) => exec(tx => {
    const s = tx.s.spks.find(x => x.id === spkId);
    if (!s || s.status !== 'diinput') return fail('SPK tidak sedang menunggu verifikasi.');
    if (!has(tx.me, 'Finance')) return fail('Hanya Finance.');
    if (s.inputBy === tx.me.id) return fail('Anda ikut menginput SPK ini; verifikasi oleh user Finance lain.');
    if (verdict === 'cocok' && hasDiff) return fail('Ada field yang beda dari FPK. Pilih "SPK salah" atau "SPK benar".');
    if (verdict !== 'cocok' && !reason.trim()) return fail('Alasan wajib diisi.');
    const f = tx.s.fpks.find(x => x.id === s.fpkId);
    s.verdict = verdict;
    s.verifiedBy = tx.me.id;
    s.verifiedAt = TODAY;
    tx.closeTasks(t => t.refId === s.id && t.kind === 'verifikasi_spk');
    const client = tx.s.clients.find(c => c.id === s.clientId);

    if (verdict === 'salah') {
      s.status = 'perlu_revisi';
      s.invoiceHeld = true;
      s.revisionReason = reason;
      tx.addTask({
        kind: 'urus_spk_salah', title: `Urus revisi ${s.number} ke klien (invoice ditahan)`, refType: 'spk', refId: s.id,
        assigneeRole: 'Marketing', assigneeUserId: client?.accountOwnerId, dueAt: addDays(TODAY, num(tx, 'spk.wrong_escalate_days', 14)),
        customEscalation: 'BOD di hari ke-14',
      });
      tx.audit({ entity: 'spk', entityId: s.id, action: 'Verifikasi SPK: salah → perlu revisi (invoice ditahan)', after: reason });
      tx.notify(`${s.number} perlu revisi: ${reason}`, [client?.accountOwnerId], { refType: 'spk', refId: s.id });
      return ok();
    }

    s.status = 'aktif';
    s.invoiceHeld = false;
    s.revisionReason = undefined;
    // Perpanjangan: SPK lama otomatis berakhir di tanggal selesainya (ditandai di sini bila sudah lewat).
    if (s.type === 'perpanjangan' && s.parentSpkId) {
      const old = tx.s.spks.find(x => x.id === s.parentSpkId);
      if (old && diffDays(old.periodEnd, TODAY) > 0) old.status = 'berakhir';
      if (old?.lapsedFrom) {
        // Jeda antara SPK lama berakhir dan perpanjangan aktif: hari di luar periode SPK baru tidak tertagih.
        const gap = Math.max(0, diffDays(old.lapsedFrom, s.periodStart));
        tx.audit({ entity: 'spk', entityId: old.id, action: 'Keluar dari daftar jalan tanpa SPK (perpanjangan aktif)', after: gap ? `${gap} hari sebelum periode ${s.number} dicatat tidak tertagih` : undefined });
        old.lapsedFrom = undefined;
        tx.closeTasks(t => t.refId === old.id && t.kind === 'spk_berakhir_jaga');
      }
    }
    let kpi = '';
    if (f?.startedAt && s.type !== 'perpanjangan') {
      const waited = diffDays(f.startedAt, TODAY);
      const unbilled = Math.max(0, diffDays(f.startedAt, s.periodStart));
      kpi = `Menunggu SPK ${waited} hari sejak mulai jaga${unbilled ? `; ${unbilled} hari sebelum periode SPK dicatat tidak tertagih` : '; seluruh hari tercakup periode SPK'}`;
    }
    tx.audit({ entity: 'spk', entityId: s.id, action: `Verifikasi SPK: ${verdict} → aktif`, after: [reason, kpi].filter(Boolean).join('. ') || undefined });

    if (verdict === 'benar' && f && s.type !== 'perpanjangan') {
      // SPK jadi acuan: buat FPK perubahan dari isi SPK sebagai tugas penyesuaian.
      const v = latest(f);
      const nf: Fpk = {
        id: tx.id('f'),
        number: `${f.number}-P`,
        type: 'perubahan', parentFpkId: f.id, status: 'selesai', pendingDivisions: [], createdBy: tx.me.id, createdAt: TODAY, startedAt: f.startedAt,
        reviews: [],
        versions: [{
          ...v, no: 1, siteId: s.siteId, periodStart: s.periodStart, periodEnd: s.periodEnd, monthlyValue: s.monthlyValue,
          lines: s.lines.map(l => ({ id: tx.id('fl'), positionId: l.positionId, qty: l.qty, shift: l.shift, sources: v.lines.find(x => x.id === l.fpkLineId)?.sources ?? [] })),
          estMarginPct: v.estCost ? Math.round(((s.monthlyValue - v.estCost) / s.monthlyValue) * 1000) / 10 : undefined,
          createdBy: tx.me.id, createdAt: NOW,
        }],
      };
      tx.s.fpks.unshift(nf);
      // Baris SPK sekarang menunjuk ke FPK perubahan.
      s.fpkId = nf.id;
      s.lines.forEach((l, i) => { l.fpkLineId = nf.versions[0].lines[i].id; });
      tx.closeTasks(t => t.refId === f.id && t.kind === 'kejar_spk');
      if (['berjalan', 'tertutup_sebagian'].includes(f.status)) f.status = 'selesai';
      const due = addWorkdays(TODAY, 2, tx.s.holidays);
      (['Operasional', 'Recruitment', 'Pengadaan'] as const).forEach(d => tx.addTask({
        kind: 'penyesuaian_fpk', title: `Sesuaikan dengan ${nf.number} (SPK benar tapi beda dari FPK)`, refType: 'fpk', refId: nf.id,
        assigneeRole: d, assigneeUserId: resolveAssignee(d, s.clientId, s.siteId, tx.s.assignments, tx.s.users, tx.s.sites), division: d, dueAt: due,
      }));
      tx.audit({ entity: 'fpk', entityId: nf.id, action: `FPK perubahan dibuat dari isi ${s.number}`, after: reason });
      const min = num(tx, 'margin.minimum_pct', 10);
      const m = nf.versions[0].estMarginPct;
      if (m !== undefined && m < min) {
        tx.addTask({ kind: 'margin_spk', title: `Margin ${s.number} ${m.toLocaleString('id-ID')}% di bawah minimum: terima atau nego ulang lewat addendum`, refType: 'spk', refId: s.id, assigneeRole: 'BOD', dueAt: addWorkdays(TODAY, 2, tx.s.holidays) });
      }
    } else if (f) refreshFpk(tx, f);

    tx.notify(`${s.number} terverifikasi dan aktif.`, [client?.accountOwnerId, s.inputBy], { refType: 'spk', refId: s.id });
    return ok();
  });

  /** BOD boleh memutuskan "tagih sesuai SPK dulu" untuk SPK salah yang lewat 14 hari. */
  const billAsIs = (spkId: string, note: string) => exec(tx => {
    const s = tx.s.spks.find(x => x.id === spkId);
    if (!s || s.status !== 'perlu_revisi') return fail('SPK tidak dalam status perlu revisi.');
    if (!has(tx.me, 'BOD')) return fail('Hanya BOD.');
    s.invoiceHeld = false;
    tx.audit({ entity: 'spk', entityId: s.id, action: 'BOD: tagih sesuai SPK dulu (invoice tidak ditahan)', after: note || undefined });
    tx.notify(`BOD memutuskan ${s.number} ditagih sesuai SPK dulu.`, [s.inputBy, ...tx.s.users.filter(u => u.roles.includes('Finance')).map(u => u.id)], { refType: 'spk', refId: s.id });
    return ok();
  });

  return { inputSpk, verifySpk, billAsIs };
}

export const spkSummary = (s: Spk) => `${s.number} · ${fmtDate(s.periodStart)}–${fmtDate(s.periodEnd)} · ${fmtRp(s.monthlyValue)}`;
