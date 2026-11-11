// Aksi memo eksternal (PRD bagian Memo eksternal).
import type { Result, Tx } from './store';
import { fail, ok } from './store';
import type { Memo, MemoType, MemoVersion, Spk } from '../domain/types';
import { NOW, TODAY, addDays, addWorkdays, diffDays, fmtDate, hMinus } from '../domain/time';
import { settingNum } from '../domain/settings';
import { resolveAssignee } from '../domain/tasks';
import { has, isDeputy } from '../domain/rbac';
import { MEMO_TYPE } from '../domain/labels';
import { DEFAULT_DOC_FORMAT, nextDocNumber } from '../domain/docNumber';
import { deputyBlocked, DEPUTY_WAIT } from './fpkActions';

const num = (tx: Tx, key: string, fb: number) => settingNum(tx.s.settings, key, fb);
const wd = (tx: Tx, n: number) => addWorkdays(TODAY, n, tx.s.holidays);
const spkOf = (tx: Tx, id: string) => tx.s.spks.find(s => s.id === id);
const memoOf = (tx: Tx, id: string) => tx.s.memos.find(m => m.id === id);
const latestV = (m: Memo) => m.versions[m.versions.length - 1];
const clientOf = (tx: Tx, s: Spk) => tx.s.clients.find(c => c.id === s.clientId);
const isOwner = (tx: Tx, s: Spk) => { const c = clientOf(tx, s); return !!c && (c.accountOwnerId === tx.me.id || c.coOwnerIds.includes(tx.me.id)); };
/** Batas di H-n akhir SPK; bila sudah lewat (mis. SPK data awal), pakai n hari kerja dari sekarang. */
const dueBefore = (tx: Tx, s: Spk, daysBefore: number) => {
  const d = hMinus(s.periodEnd, daysBefore);
  return diffDays(TODAY, d) < 0 ? wd(tx, num(tx, 'memo.initial_data_due_workdays', 5)) : d;
};
const headOf = (tx: Tx, role: 'Operasional' | 'HR' | 'Finance' | 'Marketing') => tx.s.users.find(u => u.active && u.headOf.includes(role))?.id;
const opsForArea = (tx: Tx, areaId: string) => tx.s.users.find(u => u.active && u.roles.includes('Operasional') && u.areaIds.includes(areaId))?.id ?? headOf(tx, 'Operasional');

const nextMemoNumber = (tx: Tx) =>
  nextDocNumber(tx.s.settings.find(s => s.key === 'doc.number_format')?.value ?? DEFAULT_DOC_FORMAT, tx.s.memos.map(m => m.number), TODAY);

const label = (tx: Tx, s: Spk) => `${s.number} — ${clientOf(tx, s)?.name}`;

/** Klien tidak lanjut: demobilisasi Ops (tarik personel) + HR (akhiri penempatan), info Finance untuk invoice terakhir. */
const notContinuing = (tx: Tx, m: Memo, s: Spk) => {
  const site = tx.s.sites.find(x => x.id === s.siteId);
  tx.addTask({ kind: 'demobilisasi', title: `Demobilisasi ${site?.name}: tarik personel sebelum ${fmtDate(s.periodEnd)}`, refType: 'memo', refId: m.id, assigneeRole: 'Operasional', assigneeUserId: opsForArea(tx, site?.areaId ?? ''), division: 'Operasional', dueAt: s.periodEnd });
  tx.addTask({ kind: 'demobilisasi', title: `Demobilisasi ${site?.name}: akhiri penempatan per ${fmtDate(s.periodEnd)}`, refType: 'memo', refId: m.id, assigneeRole: 'HR', assigneeUserId: headOf(tx, 'HR'), dueAt: s.periodEnd });
  const fin = resolveAssignee('Finance', s.clientId, s.siteId, tx.s.assignments, tx.s.users, tx.s.sites);
  tx.notify(`${label(tx, s)} tidak dilanjutkan. Siapkan invoice terakhir sampai ${fmtDate(s.periodEnd)}.`, [fin, headOf(tx, 'Finance')], { refType: 'memo', refId: m.id });
};

const stakeholders = (tx: Tx, s: Spk) => {
  const site = tx.s.sites.find(x => x.id === s.siteId);
  const area = tx.s.areas.find(a => a.id === site?.areaId);
  return [
    ...(['Operasional', 'Recruitment', 'Pengadaan', 'Finance'] as const).map(d => resolveAssignee(d, s.clientId, s.siteId, tx.s.assignments, tx.s.users, tx.s.sites)),
    area?.picUserId, clientOf(tx, s)?.accountOwnerId,
  ];
};

export function buildMemoActions(exec: (fn: (tx: Tx) => Result) => Result) {
  /** Marketing memilih jenis memo dari tugas H-75. */
  const startMemo = (spkId: string, type: MemoType) => exec(tx => {
    const s = spkOf(tx, spkId);
    if (!s || s.status !== 'aktif') return fail('Memo hanya untuk SPK aktif.');
    if (!has(tx.me, 'Marketing') || !isOwner(tx, s)) return fail('Hanya Marketing pemegang klien.');
    if (tx.s.memos.some(m => m.spkId === s.id && m.status !== 'dijawab')) return fail('SPK ini sudah punya memo yang berjalan.');
    const start = addDays(s.periodEnd, 1);
    const v: MemoVersion = {
      no: 1, newValue: type === 'perpanjangan_sama' ? s.monthlyValue : type === 'perpanjangan_ump' ? s.monthlyValue : 0,
      periodStart: start, periodEnd: addDays(addDays(start, 365), -1), createdBy: tx.me.id, createdAt: NOW,
    };
    const m: Memo = { id: tx.id('m'), spkId: s.id, type, status: 'draf', versions: [v], createdBy: tx.me.id, createdAt: TODAY };
    tx.s.memos.unshift(m);
    tx.closeTasks(t => t.refId === s.id && t.kind === 'memo');
    tx.audit({ entity: 'memo', entityId: m.id, action: `Draf memo dibuat: ${MEMO_TYPE[type]}`, after: s.number });
    if (type === 'pengakhiran_klien') {
      m.status = 'dijawab';
      m.clientAnswer = 'tidak_lanjut';
      m.answeredAt = TODAY;
      m.answerNote = 'Pengakhiran dari klien dicatat Marketing';
      tx.audit({ entity: 'memo', entityId: m.id, action: 'Pengakhiran dari klien dicatat: tidak lanjut' });
      notContinuing(tx, m, s);
      tx.notify(`${label(tx, s)}: klien mengakhiri kontrak per ${fmtDate(s.periodEnd)}.`, stakeholders(tx, s), { refType: 'memo', refId: m.id });
      return ok(m.id);
    }
    tx.addTask({
      kind: 'kirim_memo', title: `Kirim memo ${MEMO_TYPE[type].toLowerCase()} untuk ${label(tx, s)}`, refType: 'memo', refId: m.id,
      assigneeRole: 'Marketing', assigneeUserId: tx.me.id, dueAt: dueBefore(tx, s, num(tx, 'memo.send_deadline_days_before_end', 60)),
      customEscalation: 'Belum terkirim di H-60: eskalasi BOD',
    });
    return ok(m.id);
  });

  /** Kirim draf ke cek margin (harga berubah) atau langsung ke BOD. */
  const submitMemo = (memoId: string, newValue: number, boqName: string) => exec(tx => {
    const m = memoOf(tx, memoId);
    if (!m || m.status !== 'draf') return fail('Memo tidak dalam status draf.');
    const s = spkOf(tx, m.spkId)!;
    if (!isOwner(tx, s)) return fail('Hanya Marketing pemegang klien.');
    const priceChange = m.type === 'perpanjangan_ump';
    if (m.type.startsWith('perpanjangan') && !(newValue > 0)) return fail('Isi nilai per bulan periode baru.');
    if (priceChange && !boqName) return fail('Harga berubah: lampirkan BOQ baru.');
    let v = latestV(m);
    if (v.bodDecision?.decision === 'kembalikan') {
      v = { ...v, no: v.no + 1, bodDecision: undefined, estCost: undefined, marginPct: undefined, createdBy: tx.me.id, createdAt: NOW };
      m.versions.push(v);
    }
    v.newValue = m.type.startsWith('perpanjangan') ? newValue : 0;
    if (boqName) v.boq = { id: tx.id('at'), kind: 'BOQ', fileName: boqName, priced: true, uploadedBy: tx.me.id, uploadedAt: NOW };
    if (priceChange) {
      m.status = 'cek_margin';
      tx.addTask({ kind: 'cek_margin_memo', title: `Cek margin memo ${label(tx, s)}`, refType: 'memo', refId: m.id, assigneeRole: 'Finance', assigneeUserId: resolveAssignee('Finance', s.clientId, s.siteId, tx.s.assignments, tx.s.users, tx.s.sites), division: 'Finance', dueAt: wd(tx, num(tx, 'fpk.margin_check_due_workdays', 1)) });
      tx.audit({ entity: 'memo', entityId: m.id, action: `Versi ${v.no}: draf → cek margin`, after: `Nilai baru Rp ${newValue.toLocaleString('id-ID')}`, hasMoney: true });
    } else {
      m.status = 'menunggu_bod';
      tx.addTask({ kind: 'setujui_memo', title: `Setujui memo ${MEMO_TYPE[m.type].toLowerCase()} — ${label(tx, s)}`, refType: 'memo', refId: m.id, assigneeRole: 'BOD', dueAt: wd(tx, num(tx, 'memo.approval_due_workdays', 2)) });
      tx.audit({ entity: 'memo', entityId: m.id, action: `Versi ${v.no}: draf → menunggu BOD` });
    }
    return ok();
  });

  const memoMargin = (memoId: string, estCost: number) => exec(tx => {
    const m = memoOf(tx, memoId);
    if (!m || m.status !== 'cek_margin') return fail('Memo tidak menunggu cek margin.');
    if (!has(tx.me, 'Finance')) return fail('Hanya Finance.');
    if (!(estCost > 0)) return fail('Isi estimasi biaya per bulan.');
    const s = spkOf(tx, m.spkId)!;
    const v = latestV(m);
    v.estCost = estCost;
    v.marginPct = Math.round(((v.newValue - estCost) / v.newValue) * 1000) / 10;
    const low = v.marginPct < num(tx, 'margin.minimum_pct', 10);
    m.status = 'menunggu_bod';
    tx.closeTasks(t => t.refId === m.id && t.kind === 'cek_margin_memo');
    tx.addTask({ kind: 'setujui_memo', title: `${low ? '[Margin rendah] ' : ''}Setujui memo ${MEMO_TYPE[m.type].toLowerCase()} — ${label(tx, s)}`, refType: 'memo', refId: m.id, assigneeRole: 'BOD', dueAt: wd(tx, num(tx, 'memo.approval_due_workdays', 2)) });
    tx.audit({ entity: 'memo', entityId: m.id, action: 'Cek margin memo selesai', after: `Margin ${v.marginPct.toLocaleString('id-ID')}%`, hasMoney: true });
    return ok();
  });

  const memoBodDecide = (memoId: string, decision: 'setujui' | 'kembalikan', note: string) => exec(tx => {
    const m = memoOf(tx, memoId);
    if (!m || m.status !== 'menunggu_bod') return fail('Memo tidak menunggu BOD.');
    const deputy = !has(tx.me, 'BOD') && isDeputy(tx.me, tx.s.delegations);
    if (!has(tx.me, 'BOD') && !deputy) return fail('Hanya BOD atau wakil.');
    if (deputy && deputyBlocked(tx, m.id, 'setujui_memo')) return fail(DEPUTY_WAIT);
    if (m.createdBy === tx.me.id) return fail('Pembuat memo tidak bisa menyetujui memonya sendiri. Persetujuan pindah ke BOD.');
    if (decision === 'kembalikan' && !note.trim()) return fail('Alasan wajib diisi.');
    const s = spkOf(tx, m.spkId)!;
    const onBehalfOf = deputy ? tx.s.delegations.find(d => d.deputyUserId === tx.me.id)?.bodUserId : undefined;
    latestV(m).bodDecision = { decision, by: tx.me.id, onBehalfOf, note: note || undefined, at: NOW };
    tx.closeTasks(t => t.refId === m.id && t.kind === 'setujui_memo');
    if (decision === 'kembalikan') {
      m.status = 'draf';
      tx.audit({ entity: 'memo', entityId: m.id, action: 'Memo dikembalikan BOD', after: note, onBehalfOfId: onBehalfOf });
      tx.notify(`Memo ${label(tx, s)} dikembalikan BOD: ${note}`, [m.createdBy], { refType: 'memo', refId: m.id });
      return ok();
    }
    m.status = 'disetujui';
    m.number = nextMemoNumber(tx);
    m.draftPdf = { id: tx.id('at'), kind: 'PDF memo', fileName: `${m.number.replace(/\//g, '_')}_draf_kop_surat.pdf`, priced: true, uploadedBy: tx.me.id, uploadedAt: NOW };
    tx.audit({ entity: 'memo', entityId: m.id, action: `Memo disetujui, nomor ${m.number}; draf PDF dibuat dari template kop surat`, after: note || undefined, onBehalfOfId: onBehalfOf });
    tx.notify(`Memo ${m.number} disetujui. Unduh draf PDF, tandatangani, lalu kirim ke klien.`, [m.createdBy], { refType: 'memo', refId: m.id });
    return ok();
  });

  const sendMemo = (memoId: string, signedName: string, proofName: string, sentDate: string) => exec(tx => {
    const m = memoOf(tx, memoId);
    if (!m || m.status !== 'disetujui') return fail('Memo belum disetujui BOD.');
    const s = spkOf(tx, m.spkId)!;
    if (!isOwner(tx, s)) return fail('Hanya Marketing pemegang klien.');
    if (!signedName) return fail('Unggah memo versi yang sudah ditandatangani.');
    if (!proofName) return fail('Unggah bukti kirim.');
    if (!sentDate) return fail('Isi tanggal kirim.');
    m.signedPdf = { id: tx.id('at'), kind: 'PDF memo', fileName: signedName, priced: true, uploadedBy: tx.me.id, uploadedAt: NOW };
    m.proof = { id: tx.id('at'), kind: 'Bukti kirim', fileName: proofName, priced: false, uploadedBy: tx.me.id, uploadedAt: NOW };
    m.sentAt = sentDate;
    m.status = 'terkirim';
    tx.closeTasks(t => t.refId === m.id && t.kind === 'kirim_memo');
    tx.addTask({
      kind: 'catat_jawaban', title: `Catat jawaban klien untuk ${m.number} — ${clientOf(tx, s)?.name}`, refType: 'memo', refId: m.id,
      assigneeRole: 'Marketing', assigneeUserId: m.createdBy, dueAt: dueBefore(tx, s, num(tx, 'memo.answer_deadline_days_before_end', 30)),
      customEscalation: 'BOD di H-30 bila belum dijawab',
    });
    tx.audit({ entity: 'memo', entityId: m.id, action: 'Status memo: disetujui → terkirim', after: `Dikirim ${fmtDate(sentDate)}` });
    return ok();
  });

  const recordAnswer = (memoId: string, answer: 'setuju' | 'nego' | 'tidak_lanjut', note: string) => exec(tx => {
    const m = memoOf(tx, memoId);
    if (!m || m.status !== 'terkirim') return fail('Memo belum terkirim.');
    const s = spkOf(tx, m.spkId)!;
    if (!isOwner(tx, s)) return fail('Hanya Marketing pemegang klien.');
    // Pengakhiran oleh perusahaan bukan penawaran: klien hanya menerima pemberitahuan, tidak ada setuju/nego.
    const notice = m.type === 'pengakhiran_perusahaan';
    if (notice && answer !== 'tidak_lanjut') return fail('Memo pengakhiran oleh perusahaan hanya dicatat sebagai sudah diterima klien.');
    if (answer !== 'setuju' && !notice && !note.trim()) return fail('Tulis catatan jawaban klien.');
    m.status = 'dijawab';
    m.clientAnswer = answer;
    m.answerNote = note || undefined;
    m.answeredAt = TODAY;
    tx.closeTasks(t => t.refId === m.id && t.kind === 'catat_jawaban');
    tx.audit({ entity: 'memo', entityId: m.id, action: notice ? 'Klien sudah menerima pemberitahuan pengakhiran' : `Jawaban klien: ${answer.replace('_', ' ')}`, after: note || undefined });
    if (answer === 'setuju') {
      tx.addTask({ kind: 'input_spk_perpanjangan', title: `Input SPK perpanjangan ${label(tx, s)} (FPK periode berjalan sebagai induk)`, refType: 'spk', refId: s.id, assigneeRole: 'Marketing', assigneeUserId: m.createdBy, dueAt: s.periodEnd });
      tx.notify(`Klien setuju perpanjangan ${label(tx, s)}.`, stakeholders(tx, s), { refType: 'memo', refId: m.id });
    } else if (answer === 'nego') {
      // Memo terkirim tidak diubah: nego menghasilkan memo baru yang merujuk memo sebelumnya.
      const v = latestV(m);
      const nm: Memo = {
        id: tx.id('m'), spkId: s.id, parentMemoId: m.id, type: m.type, status: 'draf', createdBy: m.createdBy, createdAt: TODAY,
        versions: [{ no: 1, newValue: v.newValue, periodStart: v.periodStart, periodEnd: v.periodEnd, createdBy: tx.me.id, createdAt: NOW }],
      };
      tx.s.memos.unshift(nm);
      tx.addTask({ kind: 'kirim_memo', title: `Revisi BOQ hasil nego dan kirim memo baru — ${label(tx, s)}`, refType: 'memo', refId: nm.id, assigneeRole: 'Marketing', assigneeUserId: m.createdBy, dueAt: wd(tx, 5), customEscalation: 'Eskalasi BOD bila lewat batas' });
      tx.audit({ entity: 'memo', entityId: nm.id, action: `Memo baru dari nego atas ${m.number}` });
    } else {
      notContinuing(tx, m, s);
      tx.notify(notice ? `Pengakhiran ${label(tx, s)} sudah diterima klien. Kontrak berakhir ${fmtDate(s.periodEnd)}.` : `Klien tidak melanjutkan ${label(tx, s)} setelah ${fmtDate(s.periodEnd)}.`, stakeholders(tx, s), { refType: 'memo', refId: m.id });
    }
    return ok();
  });

  return { startMemo, submitMemo, memoMargin, memoBodDecide, sendMemo, recordAnswer };
}
