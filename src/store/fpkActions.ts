// Aksi FPK, mulai jaga, dan persiapan personel (PRD: FPK dan mulai jaga + People in Act).
import type { Result, Tx } from './store';
import { fail, ok } from './store';
import type { Division, Fpk, FpkLine, FpkLineSource, FpkVersion, Personnel, Role, Shift, FpkType } from '../domain/types';
import { NOW, TODAY, addDays, addWorkdays, diffDays, fmtDate, hMinus } from '../domain/time';
import { settingNum } from '../domain/settings';
import { resolveAssignee } from '../domain/tasks';
import { CHECK_DIVISIONS, rereviewPlan } from '../domain/fpk';
import { isPricedKind } from '../domain/seed';
import { activeByPosition, quotaByPosition, latest, fpkCoverage } from '../domain/selectors';
import { has, isDeputy } from '../domain/rbac';
import { deputyMayAct } from '../domain/tasks';

/** Sumber mutasi per baris FPK, dengan kunci stabil (id baris + urutan sumber). */
export const mutationSources = (v: FpkVersion) =>
  v.lines.flatMap(l => l.sources.map((src, i) => ({ ...src, key: `${l.id}:${i}`, positionId: l.positionId }))).filter(x => x.kind === 'mutasi');

export interface FpkInput {
  type: FpkType;
  parentFpkId?: string;
  clientId?: string;
  newClient?: { code: string; name: string; billingAddress: string };
  siteId?: string;
  newSite?: { code: string; name: string; address: string; areaId: string };
  periodStart: string;
  periodEnd: string;
  plannedStart: string;
  monthlyValue: number;
  lines: { id?: string; positionId: string; qty: number; shift: Shift }[];
  attachments: { kind: 'BOQ' | 'Bukti deal'; fileName: string }[];
}

const num = (tx: Tx, key: string, fb: number) => settingNum(tx.s.settings, key, fb);
const wd = (tx: Tx, n: number, from = TODAY) => addWorkdays(from, n, tx.s.holidays);
const fpkOf = (tx: Tx, id: string) => tx.s.fpks.find(f => f.id === id);
const clientName = (tx: Tx, id: string) => tx.s.clients.find(c => c.id === id)?.name ?? '';
const siteOf = (tx: Tx, id: string) => tx.s.sites.find(s => s.id === id);
const userName = (tx: Tx, id?: string) => tx.s.users.find(u => u.id === id)?.name ?? '';

/** Batas H-1 tanggal mulai; bila sudah lewat, 1 hari kerja sejak tugas dibuat. */
const hMinus1Due = (tx: Tx, start: string) => {
  const due = hMinus(start, 1);
  return diffDays(TODAY, due) < 0 ? wd(tx, 1) : due;
};

const headOf = (tx: Tx, role: Role) => tx.s.users.find(u => u.active && u.headOf.includes(role))?.id;

const assigneeFor = (tx: Tx, f: Fpk, d: Division) => {
  const v = latest(f);
  return resolveAssignee(d, v.clientId, v.siteId, tx.s.assignments, tx.s.users, tx.s.sites);
};

/** Pihak yang diberi info hasil keputusan: divisi terkait + PIC area + Marketing pemegang klien. */
const stakeholders = (tx: Tx, f: Fpk) => {
  const v = latest(f);
  const site = siteOf(tx, v.siteId);
  const area = tx.s.areas.find(a => a.id === site?.areaId);
  const client = tx.s.clients.find(c => c.id === v.clientId);
  return [
    ...(['Operasional', 'Recruitment', 'Pengadaan', 'Finance'] as Division[]).map(d => assigneeFor(tx, f, d)),
    area?.picUserId, client?.accountOwnerId, ...(client?.coOwnerIds ?? []),
  ];
};

const opsForArea = (tx: Tx, areaId: string) =>
  tx.s.users.find(u => u.active && u.roles.includes('Operasional') && u.areaIds.includes(areaId))?.id ?? headOf(tx, 'Operasional');

const createCheckTasks = (tx: Tx, f: Fpk, divisions: Division[]) => {
  const due = wd(tx, num(tx, 'fpk.review_due_workdays', 1));
  const v = latest(f);
  divisions.forEach(d => tx.addTask({
    kind: 'cek_fpk', title: `Cek ${f.number} (${d}) — ${clientName(tx, v.clientId)}`, refType: 'fpk', refId: f.id,
    assigneeRole: d, assigneeUserId: assigneeFor(tx, f, d), division: d, dueAt: due,
  }));
};

const toMargin = (tx: Tx, f: Fpk) => {
  f.status = 'cek_margin';
  tx.addTask({
    kind: 'cek_margin', title: `Cek margin ${f.number} — ${clientName(tx, latest(f).clientId)}`, refType: 'fpk', refId: f.id,
    assigneeRole: 'Finance', assigneeUserId: assigneeFor(tx, f, 'Finance'), division: 'Finance',
    dueAt: wd(tx, num(tx, 'fpk.margin_check_due_workdays', 1)),
  });
  tx.audit({ entity: 'fpk', entityId: f.id, action: 'Status FPK: cek divisi → cek margin' });
};

const toBod = (tx: Tx, f: Fpk, from: string) => {
  f.status = 'menunggu_bod';
  tx.addTask({
    kind: 'setujui_fpk', title: `Setujui ${f.number} — ${clientName(tx, latest(f).clientId)}`, refType: 'fpk', refId: f.id,
    assigneeRole: 'BOD', dueAt: wd(tx, num(tx, 'fpk.bod_due_workdays', 3)),
  });
  tx.audit({ entity: 'fpk', entityId: f.id, action: `Status FPK: ${from} → menunggu BOD` });
};

/** Satu divisi selesai cek; lanjut ke tahap berikutnya bila semua sudah. */
const divisionDone = (tx: Tx, f: Fpk, d: Division) => {
  f.pendingDivisions = f.pendingDivisions.filter(x => x !== d);
  tx.closeTasks(t => t.refId === f.id && t.kind === 'cek_fpk' && t.division === d);
  if (f.pendingDivisions.length === 0 && f.status === 'cek_divisi') {
    if (f.needsFinance) toMargin(tx, f); else toBod(tx, f, 'cek divisi');
  }
};

const canCheck = (tx: Tx, f: Fpk, d: Division) => {
  if (!has(tx.me, d)) return 'Anda tidak punya peran ' + d;
  if (d === 'Finance') return f.status === 'cek_margin' ? null : 'FPK tidak sedang menunggu cek margin';
  if (f.status !== 'cek_divisi' || !f.pendingDivisions.includes(d)) return 'Cek ' + d + ' tidak sedang dibuka';
  return null;
};

const buildVersion = (tx: Tx, input: FpkInput, no: number, clientId: string, siteId: string, prev?: FpkVersion): FpkVersion => ({
  no,
  clientId,
  siteId,
  periodStart: input.periodStart,
  periodEnd: input.periodEnd,
  plannedStart: input.plannedStart,
  monthlyValue: input.monthlyValue,
  lines: input.lines.map(l => {
    const old = prev?.lines.find(x => x.id === l.id && x.positionId === l.positionId && x.qty === l.qty && x.shift === l.shift);
    return { id: tx.id('fl'), positionId: l.positionId, qty: l.qty, shift: l.shift, sources: old?.sources ?? [] };
  }),
  attachments: input.attachments.map(a => ({
    id: tx.id('at'), kind: a.kind, fileName: a.fileName, priced: isPricedKind(a.kind), uploadedBy: tx.me.id, uploadedAt: NOW,
  })),
  createdBy: tx.me.id,
  createdAt: NOW,
});

const validateInput = (tx: Tx, input: FpkInput): string | null => {
  if (!input.clientId && !input.newClient) return 'Pilih klien atau buat klien baru.';
  if (input.newClient && (!input.newClient.code || !input.newClient.name || !input.newClient.billingAddress)) return 'Klien baru: kode, nama, dan alamat penagihan wajib diisi.';
  if (!input.siteId && !input.newSite) return 'Pilih site atau buat site baru.';
  if (input.newSite && (!input.newSite.code || !input.newSite.name || !input.newSite.address || !input.newSite.areaId)) return 'Site baru: kode, nama, alamat, dan area wajib diisi.';
  if (input.type !== 'baru' && !input.parentFpkId) return 'FPK perubahan/perpanjangan wajib memilih FPK induk.';
  if (!input.periodStart || !input.periodEnd || !input.plannedStart) return 'Periode dan tanggal mulai rencana wajib diisi.';
  if (diffDays(input.periodStart, input.periodEnd) <= 0) return 'Periode selesai harus setelah periode mulai.';
  if (!(input.monthlyValue > 0)) return 'Nilai per bulan wajib diisi.';
  if (!input.lines.length || input.lines.some(l => !l.positionId || !(l.qty > 0))) return 'Isi minimal satu baris jabatan dengan jumlah lebih dari 0.';
  if (input.newClient && tx.s.clients.some(c => c.code.toLowerCase() === input.newClient!.code.toLowerCase() || c.name.toLowerCase() === input.newClient!.name.toLowerCase())) return 'Kode atau nama klien baru sudah dipakai.';
  if (input.newSite && tx.s.sites.some(s => s.code.toLowerCase() === input.newSite!.code.toLowerCase())) return 'Kode site baru sudah dipakai.';
  return null;
};

const resolveClientSite = (tx: Tx, input: FpkInput) => {
  let clientId = input.clientId!;
  if (input.newClient) {
    clientId = tx.id('c');
    tx.s.clients.push({
      id: clientId, code: input.newClient.code.toUpperCase(), name: input.newClient.name, accountOwnerId: tx.me.id, coOwnerIds: [],
      billingAddress: input.newClient.billingAddress, termDays: num(tx, 'client.payment_terms_days', 30), note: 'Dibuat Marketing dari form FPK', active: true,
    });
    tx.audit({ entity: 'klien', entityId: clientId, action: 'Buat klien dari form FPK', after: `${input.newClient.code} ${input.newClient.name} (account owner: ${tx.me.name})` });
  }
  let siteId = input.siteId!;
  if (input.newSite) {
    siteId = tx.id('s');
    tx.s.sites.push({ id: siteId, code: input.newSite.code.toUpperCase(), name: input.newSite.name, address: input.newSite.address, clientId, areaId: input.newSite.areaId, note: 'Dibuat Marketing dari form FPK', active: true });
    tx.audit({ entity: 'site', entityId: siteId, action: 'Buat site dari form FPK', after: `${input.newSite.code} ${input.newSite.name}` });
  }
  return { clientId, siteId };
};

const nextNumber = (tx: Tx, prefix: string, existing: string[]) => {
  const year = TODAY.slice(0, 4);
  const max = existing.filter(n => n.startsWith(`${prefix}/${year}/`)).map(n => parseInt(n.split('/').pop()!, 10)).reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}/${year}/${String(max + 1).padStart(4, '0')}`;
};

/** Wakil BOD hanya bisa memutuskan bila delegasi periode aktif, atau (delegasi tetap) tugas BOD-nya sudah lewat batas. */
const DEPUTY_WAIT = 'Wakil BOD baru bisa memutuskan setelah tugas BOD lewat batas (delegasi tetap) atau saat delegasi periode aktif.';
const deputyBlocked = (tx: Tx, refId: string, kind: 'setujui_fpk' | 'setujui_memo') => {
  if (has(tx.me, 'BOD')) return false;
  const task = tx.s.tasks.find(t => t.refId === refId && t.kind === kind && t.status === 'terbuka');
  return !deputyMayAct(tx.me, tx.s.delegations, task);
};

export { deputyBlocked, DEPUTY_WAIT };
export function buildFpkActions(exec: (fn: (tx: Tx) => Result) => Result) {
  /** Simpan draf FPK (baru atau ubah draf). */
  const saveFpkDraft = (input: FpkInput, fpkId?: string) => exec(tx => {
    if (!has(tx.me, 'Marketing')) return fail('Hanya Marketing yang membuat FPK.');
    const err = validateInput(tx, input);
    if (err) return fail(err);
    const { clientId, siteId } = resolveClientSite(tx, input);
    if (fpkId) {
      const f = fpkOf(tx, fpkId);
      if (!f || f.status !== 'draf') return fail('Hanya draf yang bisa diubah langsung.');
      f.type = input.type;
      f.parentFpkId = input.parentFpkId;
      f.versions[0] = buildVersion(tx, input, 1, clientId, siteId, f.versions[0]);
      tx.audit({ entity: 'fpk', entityId: f.id, action: 'Ubah draf FPK' });
      return ok(f.id);
    }
    const id = tx.id('f');
    const f: Fpk = {
      id, number: nextNumber(tx, 'FPK', tx.s.fpks.map(x => x.number)), type: input.type, parentFpkId: input.parentFpkId, status: 'draf',
      versions: [buildVersion(tx, input, 1, clientId, siteId)], reviews: [], pendingDivisions: [], createdBy: tx.me.id, createdAt: TODAY,
    };
    tx.s.fpks.unshift(f);
    tx.audit({ entity: 'fpk', entityId: id, action: 'Buat draf FPK', after: f.number });
    return ok(id);
  });

  /** Kirim draf ke cek paralel 3 divisi. */
  const submitFpk = (fpkId: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'draf') return fail('FPK tidak dalam status draf.');
    const v = latest(f);
    if (!v.attachments.some(a => a.kind === 'BOQ')) return fail('Lampirkan minimal satu file BOQ sebelum mengirim ke cek.');
    if (!v.attachments.some(a => a.kind === 'Bukti deal')) return fail('Lampirkan bukti deal tertulis (email atau surat) sebelum mengirim ke cek.');
    f.status = 'cek_divisi';
    f.pendingDivisions = [...CHECK_DIVISIONS];
    f.needsFinance = true;
    createCheckTasks(tx, f, CHECK_DIVISIONS);
    tx.audit({ entity: 'fpk', entityId: f.id, action: 'Status FPK: draf → cek divisi' });
    return ok(f.id);
  });

  /** Marketing membuat versi baru dari FPK yang dikembalikan. */
  const submitNewVersion = (fpkId: string, input: FpkInput) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'dikembalikan') return fail('Versi baru hanya untuk FPK yang dikembalikan.');
    const err = validateInput(tx, input);
    if (err) return fail(err);
    if (!input.attachments.some(a => a.kind === 'BOQ') || !input.attachments.some(a => a.kind === 'Bukti deal')) return fail('BOQ dan bukti deal wajib ada.');
    const { clientId, siteId } = resolveClientSite(tx, input);
    const prev = latest(f);
    const next = buildVersion(tx, input, prev.no + 1, clientId, siteId, prev);
    const plan = rereviewPlan(f, prev, next);
    f.versions.push(next);
    f.type = input.type;
    // Tanda tidak layak berlaku untuk versi yang dicek; versi baru dicek ulang (riwayatnya tetap di daftar review).
    f.notFeasible = undefined;
    tx.closeTasks(t => t.refId === f.id && t.kind === 'perbaiki_fpk');
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Versi ${next.no} dibuat`, after: plan.reasons.join('; ') });
    if (plan.notifyOnly) tx.notify(`${f.number}: tanggal mulai dimundurkan ke ${fmtDate(next.plannedStart)}.`, stakeholders(tx, f), { refType: 'fpk', refId: f.id });
    f.needsFinance = plan.finance;
    if (plan.divisions.length) {
      f.status = 'cek_divisi';
      f.pendingDivisions = plan.divisions;
      createCheckTasks(tx, f, plan.divisions);
      tx.audit({ entity: 'fpk', entityId: f.id, action: 'Status FPK: dikembalikan → cek divisi' });
    } else if (plan.finance) {
      f.status = 'cek_divisi';
      f.pendingDivisions = [];
      toMargin(tx, f);
    } else {
      toBod(tx, f, 'dikembalikan');
    }
    f.returned = undefined;
    return ok(f.id);
  });

  const reviewOps = (fpkId: string, result: 'cocok' | 'ada_perubahan' | 'perlu_survei', note: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    const e = canCheck(tx, f, 'Operasional');
    if (e) return fail(e);
    if (result === 'ada_perubahan' && !note.trim()) return fail('Tulis selisih per baris dan alasannya.');
    f.reviews.push({ versionNo: latest(f).no, division: 'Operasional', result, note: note || undefined, actorId: tx.me.id, at: NOW });
    if (result === 'perlu_survei') {
      if (f.surveyPending) return fail('Survei sudah diminta.');
      f.surveyPending = true;
      tx.closeTasks(t => t.refId === f.id && t.kind === 'cek_fpk' && t.division === 'Operasional');
      tx.addTask({
        kind: 'survei', title: `Survei lokasi ${siteOf(tx, latest(f).siteId)?.name} — ${f.number}`, refType: 'fpk', refId: f.id,
        assigneeRole: 'Operasional', assigneeUserId: tx.me.id, division: 'Operasional', dueAt: wd(tx, num(tx, 'fpk.survey_due_workdays', 2)),
      });
      tx.audit({ entity: 'fpk', entityId: f.id, action: 'Cek Operasional: perlu survei dulu' });
      return ok();
    }
    if (f.surveyPending) {
      f.surveyPending = false;
      tx.closeTasks(t => t.refId === f.id && t.kind === 'survei');
    }
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Cek Operasional: ${result === 'cocok' ? 'cocok' : 'ada perubahan'}`, after: note || undefined });
    divisionDone(tx, f, 'Operasional');
    return ok();
  });

  const reviewRecruitment = (fpkId: string, sources: Record<string, FpkLineSource[]>, readyDate: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    const e = canCheck(tx, f, 'Recruitment');
    if (e) return fail(e);
    const v = latest(f);
    for (const l of v.lines) {
      const src = sources[l.id] ?? [];
      const total = src.reduce((n, s) => n + (s.qty || 0), 0);
      if (total !== l.qty) return fail(`Jumlah sumber personel untuk ${tx.s.positions.find(p => p.id === l.positionId)?.name} (${l.shift}) harus ${l.qty} orang, sekarang ${total}.`);
      if (src.some(s => s.kind === 'mutasi' && (!s.fromAreaId || !(s.qty > 0)))) return fail('Sumber mutasi wajib memilih area asal dan jumlah.');
    }
    if (!readyDate) return fail('Isi perkiraan tanggal siap.');
    v.lines.forEach(l => { l.sources = (sources[l.id] ?? []).filter(s => s.qty > 0); });
    f.reviews.push({ versionNo: v.no, division: 'Recruitment', result: 'selesai', readyDate, actorId: tx.me.id, at: NOW });
    tx.audit({ entity: 'fpk', entityId: f.id, action: 'Cek Recruitment selesai', after: `Siap ${fmtDate(readyDate)}` });
    divisionDone(tx, f, 'Recruitment');
    return ok();
  });

  const reviewProcurement = (fpkId: string, available: boolean, note: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    const e = canCheck(tx, f, 'Pengadaan');
    if (e) return fail(e);
    if (!available && !note.trim()) return fail('Tulis perkiraan waktu barang siap.');
    const text = available ? `Barang standar tersedia${note ? `. ${note}` : ''}` : `Perlu dipesan: ${note}`;
    f.reviews.push({ versionNo: latest(f).no, division: 'Pengadaan', result: 'selesai', note: text, actorId: tx.me.id, at: NOW });
    tx.audit({ entity: 'fpk', entityId: f.id, action: 'Cek Pengadaan selesai', after: text });
    divisionDone(tx, f, 'Pengadaan');
    return ok();
  });

  /** Pemeriksa (divisi) atau BOD mengembalikan FPK ke Marketing. */
  const returnFpk = (fpkId: string, from: Division | 'BOD', reason: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    if (!reason.trim()) return fail('Alasan wajib diisi.');
    if (from === 'BOD') {
      if (f.status !== 'menunggu_bod') return fail('FPK tidak menunggu BOD.');
      if (!(has(tx.me, 'BOD') || isDeputy(tx.me, tx.s.delegations))) return fail('Hanya BOD atau wakil.');
      if (deputyBlocked(tx, f.id, 'setujui_fpk')) return fail(DEPUTY_WAIT);
      if (f.createdBy === tx.me.id) return fail('Pembuat FPK tidak bisa memutuskan FPK-nya sendiri.');
    } else {
      const e = canCheck(tx, f, from);
      if (e) return fail(e);
    }
    const prevStatus = f.status;
    if (from === 'BOD') {
      f.bodDecision = { decision: 'kembalikan', by: tx.me.id, onBehalfOf: has(tx.me, 'BOD') ? undefined : tx.s.delegations.find(d => d.deputyUserId === tx.me.id)?.bodUserId, note: reason, at: NOW };
    } else {
      f.reviews.push({ versionNo: latest(f).no, division: from, result: 'kembalikan', note: reason, actorId: tx.me.id, at: NOW });
    }
    f.status = 'dikembalikan';
    f.pendingDivisions = [];
    f.surveyPending = false;
    f.returned = { by: tx.me.id, reason, at: NOW, fromDivision: from };
    tx.closeTasks(t => t.refId === f.id && (from === 'BOD' ? t.kind === 'setujui_fpk' : t.division === from && ['cek_fpk', 'survei', 'cek_margin'].includes(t.kind)));
    tx.closeTasks(t => t.refId === f.id && ['cek_fpk', 'survei', 'cek_margin', 'setujui_fpk'].includes(t.kind), 'dibatalkan');
    tx.addTask({
      kind: 'perbaiki_fpk', title: `Perbaiki ${f.number} yang dikembalikan — ${clientName(tx, latest(f).clientId)}`, refType: 'fpk', refId: f.id,
      assigneeRole: 'Marketing', assigneeUserId: f.createdBy, dueAt: wd(tx, num(tx, 'fpk.returned_fix_due_workdays', 2)),
    });
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Status FPK: ${prevStatus.replace('_', ' ')} → dikembalikan (oleh ${from})`, after: reason, onBehalfOfId: from === 'BOD' && !has(tx.me, 'BOD') ? 'u-bod' : undefined });
    tx.notify(`${f.number} dikembalikan oleh ${from}: ${reason}`, [f.createdBy], { refType: 'fpk', refId: f.id });
    return ok();
  });

  const markNotFeasible = (fpkId: string, division: Division, reason: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    if (division === 'Finance') return fail('Finance mengisi cek margin; tanda margin rendah otomatis.');
    const e = canCheck(tx, f, division);
    if (e) return fail(e);
    if (!reason.trim()) return fail('Alasan wajib diisi.');
    f.notFeasible = { by: tx.me.id, division, reason };
    f.reviews.push({ versionNo: latest(f).no, division, result: 'tidak_layak', note: reason, actorId: tx.me.id, at: NOW });
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Ditandai tidak layak oleh ${division}`, after: reason });
    tx.notify(`${f.number} ditandai tidak layak oleh ${division}. Tanda tampil di layar persetujuan BOD.`, [...tx.s.users.filter(u => u.roles.includes('BOD')).map(u => u.id), ...tx.s.delegations.map(d => d.deputyUserId)], { refType: 'fpk', refId: f.id });
    divisionDone(tx, f, division);
    return ok();
  });

  const marginCheck = (fpkId: string, estCost: number, note: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    const e = canCheck(tx, f, 'Finance');
    if (e) return fail(e);
    if (!(estCost > 0)) return fail('Isi estimasi biaya per bulan.');
    const v = latest(f);
    v.estCost = estCost;
    v.estMarginPct = Math.round(((v.monthlyValue - estCost) / v.monthlyValue) * 1000) / 10;
    const min = num(tx, 'margin.minimum_pct', 10);
    f.reviews.push({ versionNo: v.no, division: 'Finance', result: 'selesai', note: note || (v.estMarginPct < min ? `Margin di bawah minimum ${min}%` : undefined), actorId: tx.me.id, at: NOW });
    tx.closeTasks(t => t.refId === f.id && t.kind === 'cek_margin');
    tx.audit({ entity: 'fpk', entityId: f.id, action: 'Cek margin selesai', after: `Estimasi biaya Rp ${estCost.toLocaleString('id-ID')}, margin ${v.estMarginPct.toLocaleString('id-ID')}%`, hasMoney: true });
    toBod(tx, f, 'cek margin');
    return ok();
  });

  const bodDecide = (fpkId: string, decision: 'setujui' | 'tolak', note: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'menunggu_bod') return fail('FPK tidak menunggu keputusan BOD.');
    const deputy = !has(tx.me, 'BOD') && isDeputy(tx.me, tx.s.delegations);
    if (!has(tx.me, 'BOD') && !deputy) return fail('Hanya BOD atau wakil.');
    if (deputy && deputyBlocked(tx, f.id, 'setujui_fpk')) return fail(DEPUTY_WAIT);
    if (f.createdBy === tx.me.id) return fail('Pembuat FPK tidak bisa menyetujui FPK-nya sendiri. Persetujuan pindah ke BOD.');
    if (decision === 'tolak' && !note.trim()) return fail('Alasan wajib diisi untuk menolak.');
    if (f.notFeasible && decision === 'setujui' && !note.trim()) return fail('FPK ini ditandai tidak layak: setujui dengan catatan.');
    const onBehalfOf = deputy ? tx.s.delegations.find(d => d.deputyUserId === tx.me.id)?.bodUserId : undefined;
    f.bodDecision = { decision, by: tx.me.id, onBehalfOf, note: note || undefined, at: NOW };
    tx.closeTasks(t => t.refId === f.id && t.kind === 'setujui_fpk');
    const v = latest(f);
    if (decision === 'tolak') {
      f.status = 'ditolak';
      tx.audit({ entity: 'fpk', entityId: f.id, action: 'Status FPK: menunggu BOD → ditolak (diarsipkan)', after: note, onBehalfOfId: onBehalfOf });
      tx.notify(`${f.number} ditolak BOD: ${note}`, [...stakeholders(tx, f), f.createdBy], { refType: 'fpk', refId: f.id });
      return ok();
    }
    f.status = 'disetujui';
    tx.audit({ entity: 'fpk', entityId: f.id, action: 'Status FPK: menunggu BOD → disetujui', after: note || undefined, onBehalfOfId: onBehalfOf });
    tx.notify(`${f.number} disetujui. Mulai jaga ${fmtDate(v.plannedStart)} di ${siteOf(tx, v.siteId)?.name}.`, [...stakeholders(tx, f), f.createdBy], { refType: 'fpk', refId: f.id });
    // Tugas persiapan personel
    const sum = (k: FpkLineSource['kind']) => v.lines.flatMap(l => l.sources).filter(s => s.kind === k).reduce((n, s) => n + s.qty, 0);
    const rekrut = sum('rekrut') + sum('takeover');
    const standby = sum('standby');
    if (rekrut > 0) {
      tx.addTask({ kind: 'serah_hr', title: `Serahkan ${rekrut} calon personel ke HR — ${f.number}`, refType: 'fpk', refId: f.id, assigneeRole: 'Recruitment', assigneeUserId: assigneeFor(tx, f, 'Recruitment'), dueAt: hMinus1Due(tx, v.plannedStart) });
    } else f.handedToHr = true;
    if (standby > 0) {
      tx.addTask({ kind: 'ubah_penempatan', title: `Tempatkan ${standby} personel standby — ${f.number}`, refType: 'fpk', refId: f.id, assigneeRole: 'HR', assigneeUserId: headOf(tx, 'HR'), dueAt: hMinus1Due(tx, v.plannedStart) });
    }
    if (!rekrut) f.registered = true;
    mutationSources(v).forEach(m => {
      const fromArea = tx.s.areas.find(a => a.id === m.fromAreaId);
      tx.addTask({ kind: 'lepas_mutasi', title: `Lepas ${m.qty} personel dari ${fromArea?.name}${m.fromSiteId ? ` (${siteOf(tx, m.fromSiteId)?.name})` : ''} untuk mutasi — ${f.number}`, refType: 'fpk', refId: f.id, subKey: m.key, assigneeRole: 'Operasional', assigneeUserId: opsForArea(tx, m.fromAreaId!), division: 'Operasional', dueAt: hMinus1Due(tx, v.plannedStart) });
    });
    const area = tx.s.areas.find(a => a.id === siteOf(tx, v.siteId)?.areaId);
    tx.addTask({ kind: 'mulai_jaga', title: `Konfirmasi mulai jaga di ${siteOf(tx, v.siteId)?.name} — ${f.number}`, refType: 'fpk', refId: f.id, assigneeRole: 'PIC Area', assigneeUserId: area?.picUserId, dueAt: v.plannedStart });
    return ok();
  });

  const cancelFpk = (fpkId: string, reason: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    if (!(has(tx.me, 'BOD') || isDeputy(tx.me, tx.s.delegations))) return fail('Hanya BOD atau wakil yang bisa membatalkan FPK.');
    if (['selesai', 'ditolak', 'batal'].includes(f.status)) return fail('FPK sudah tidak aktif.');
    if (!reason.trim()) return fail('Alasan wajib diisi.');
    const prev = f.status;
    f.status = 'batal';
    f.cancelled = { by: tx.me.id, reason, at: NOW };
    tx.closeTasks(t => t.refId === f.id, 'dibatalkan');
    const deployed = !!f.startedAt || tx.s.personnel.some(p => p.placements.some(pl => pl.fpkId === f.id && !pl.end));
    if (deployed) {
      const v = latest(f);
      const areaId = siteOf(tx, v.siteId)?.areaId ?? '';
      tx.addTask({ kind: 'demobilisasi', title: `Demobilisasi personel ${siteOf(tx, v.siteId)?.name} (FPK batal) — tarik personel`, refType: 'fpk', refId: f.id, assigneeRole: 'Operasional', assigneeUserId: opsForArea(tx, areaId), division: 'Operasional', dueAt: wd(tx, 1) });
      tx.addTask({ kind: 'demobilisasi', title: `Demobilisasi personel ${siteOf(tx, v.siteId)?.name} (FPK batal) — akhiri penempatan`, refType: 'fpk', refId: f.id, assigneeRole: 'HR', assigneeUserId: headOf(tx, 'HR'), dueAt: wd(tx, 1) });
    }
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Status FPK: ${prev.replace('_', ' ')} → batal`, after: reason });
    tx.notify(`${f.number} dibatalkan BOD: ${reason}`, [...stakeholders(tx, f), f.createdBy], { refType: 'fpk', refId: f.id });
    return ok();
  });

  /** Marketing pembuat membatalkan FPK yang masih draf atau dikembalikan (belum masuk proses persetujuan). */
  const cancelDraft = (fpkId: string, reason: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    if (f.createdBy !== tx.me.id) return fail('Hanya pembuat FPK yang bisa membatalkan drafnya.');
    if (f.status !== 'draf' && f.status !== 'dikembalikan') return fail('Hanya FPK draf atau dikembalikan yang bisa dibatalkan Marketing. Selebihnya lewat BOD.');
    if (!reason.trim()) return fail('Alasan wajib diisi.');
    const prev = f.status;
    f.status = 'batal';
    f.cancelled = { by: tx.me.id, reason, at: NOW };
    tx.closeTasks(t => t.refId === f.id, 'dibatalkan');
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Status FPK: ${prev} → batal (oleh pembuat)`, after: reason });
    if (prev === 'dikembalikan') tx.notify(`${f.number} dibatalkan oleh pembuatnya: ${reason}`, stakeholders(tx, f), { refType: 'fpk', refId: f.id });
    return ok();
  });

  /** PIC area mengonfirmasi mulai jaga: titik awal hitungan jalan tanpa SPK. */
  const confirmStart = (fpkId: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'disetujui') return fail('FPK belum disetujui atau sudah berjalan.');
    const v = latest(f);
    const site = siteOf(tx, v.siteId);
    if (!has(tx.me, 'PIC Area') || !site || !tx.me.areaIds.includes(site.areaId)) return fail('Mulai jaga hanya bisa dikonfirmasi PIC area dari area site ini.');
    if (diffDays(v.plannedStart, TODAY) < 0) return fail(`Mulai jaga baru bisa dikonfirmasi pada ${fmtDate(v.plannedStart)}.`);
    const notReady = tx.s.personnel.filter(p => p.status === 'calon' && p.placements.some(x => x.fpkId === f.id && !x.end)).length;
    const pendingNote = notReady ? `${notReady} calon belum ditandai terdaftar HR, belum dihitung aktif` : '';
    f.status = 'berjalan';
    f.startedAt = TODAY;
    let n = 0;
    tx.s.personnel.forEach(p => {
      const pl = p.placements.find(x => x.fpkId === f.id && !x.end);
      if (pl && (p.status === 'terdaftar' || p.status === 'standby')) { p.status = 'aktif'; n++; }
    });
    tx.closeTasks(t => t.refId === f.id && t.kind === 'mulai_jaga');
    const client = tx.s.clients.find(c => c.id === v.clientId);
    // SPK bisa saja sudah aktif sebelum mulai jaga: status ikut cakupan kuota.
    const cov = fpkCoverage(f, tx.s.spks);
    if (cov.done >= cov.total && cov.total > 0) f.status = 'selesai';
    else if (cov.done > 0) f.status = 'tertutup_sebagian';
    if (f.status !== 'selesai') {
      tx.addTask({
        kind: 'kejar_spk', title: `Kejar SPK ${site.name} (jalan tanpa SPK sejak ${fmtDate(TODAY)})`, refType: 'fpk', refId: f.id,
        assigneeRole: 'Marketing', assigneeUserId: client?.accountOwnerId, dueAt: addDays(TODAY, num(tx, 'spk.without_spk_escalate_days', 30)),
        customEscalation: 'Pengingat hari ke-7, 14, 21; BOD di hari ke-30', remindersSent: [],
      });
    }
    tx.audit({ entity: 'fpk', entityId: f.id, action: `Status FPK: disetujui → ${f.status.replace('_', ' ')} (mulai jaga)`, after: `${n} personel aktif${pendingNote ? `; ${pendingNote}` : ''}` });
    tx.notify(f.status === 'selesai' ? `Mulai jaga ${site.name} dikonfirmasi. SPK sudah aktif, tidak ada jalan tanpa SPK.` : `Mulai jaga ${site.name} dikonfirmasi. Hitungan jalan tanpa SPK dimulai.`, [client?.accountOwnerId, ...stakeholders(tx, f)], { refType: 'fpk', refId: f.id });
    return ok();
  });

  // ---------------- Persiapan personel (People in Act) ----------------

  const handOverToHr = (fpkId: string, rows: { name: string; positionId: string; uniformSize: string; shoeSize: number }[]) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'disetujui') return fail('Serah ke HR hanya untuk FPK yang sudah disetujui.');
    if (!has(tx.me, 'Recruitment')) return fail('Hanya Recruitment.');
    const bad = rows.findIndex(r => !r.name.trim() || !r.positionId || !r.uniformSize || !(r.shoeSize > 0));
    if (bad >= 0) return fail(`Baris ${bad + 1} ditolak: nama, jabatan, ukuran seragam, dan ukuran sepatu wajib diisi.`);
    const v = latest(f);
    const site = siteOf(tx, v.siteId)!;
    rows.forEach(r => {
      const id = tx.id('ps');
      tx.s.personnel.push({
        id, employeeNo: `SEC-${2000 + tx.s.seq}`, name: r.name.trim(), positionId: r.positionId, status: 'calon',
        uniformSize: r.uniformSize as Personnel['uniformSize'], shoeSize: r.shoeSize,
        placements: [{ areaId: site.areaId, siteId: site.id, fpkId: f.id, start: v.plannedStart }],
      });
    });
    f.handedToHr = true;
    tx.closeTasks(t => t.refId === f.id && t.kind === 'serah_hr');
    tx.addTask({ kind: 'tandai_terdaftar', title: `Tandai terdaftar ${rows.length} calon personel — ${f.number}`, refType: 'fpk', refId: f.id, assigneeRole: 'HR', assigneeUserId: headOf(tx, 'HR'), dueAt: hMinus1Due(tx, v.plannedStart) });
    tx.audit({ entity: 'personel', entityId: f.id, action: `Serahkan ${rows.length} calon ke HR`, after: rows.map(r => r.name).join(', ') });
    return ok();
  });

  const registerPersonnel = (fpkId: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f) return fail('FPK tidak ditemukan.');
    if (!has(tx.me, 'HR')) return fail('Hanya HR.');
    const calon = tx.s.personnel.filter(p => p.status === 'calon' && p.placements.some(pl => pl.fpkId === f.id && !pl.end));
    if (!calon.length) return fail('Tidak ada calon yang menunggu didaftarkan.');
    calon.forEach(p => { p.status = 'terdaftar'; });
    f.registered = true;
    tx.closeTasks(t => t.refId === f.id && t.kind === 'tandai_terdaftar');
    tx.audit({ entity: 'personel', entityId: f.id, action: `HR menandai ${calon.length} personel terdaftar` });
    return ok();
  });

  const placeStandby = (fpkId: string, personnelIds: string[]) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'disetujui') return fail('FPK tidak dalam status disetujui.');
    if (!has(tx.me, 'HR')) return fail('Hanya HR.');
    const v = latest(f);
    const need = v.lines.flatMap(l => l.sources).filter(s => s.kind === 'standby').reduce((n, s) => n + s.qty, 0);
    if (personnelIds.length !== need) return fail(`Pilih tepat ${need} personel standby.`);
    const site = siteOf(tx, v.siteId)!;
    personnelIds.forEach(id => {
      const p = tx.s.personnel.find(x => x.id === id)!;
      p.placements.forEach(pl => { if (!pl.end) pl.end = TODAY; });
      p.placements.push({ areaId: site.areaId, siteId: site.id, fpkId: f.id, start: v.plannedStart });
      p.status = 'terdaftar';
    });
    tx.closeTasks(t => t.refId === f.id && t.kind === 'ubah_penempatan' && t.title.includes('standby'));
    tx.audit({ entity: 'personel', entityId: f.id, action: `Tempatkan ${personnelIds.length} personel standby ke ${site.name}` });
    return ok();
  });

  const releaseForMutation = (fpkId: string, key: string, personnelIds: string[], effectiveDate: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    if (!f || f.status !== 'disetujui') return fail('FPK tidak dalam status disetujui.');
    if (!has(tx.me, 'Operasional')) return fail('Hanya Operasional.');
    const v = latest(f);
    const src = mutationSources(v).find(m => m.key === key);
    if (!src) return fail('Sumber mutasi tidak ditemukan.');
    if (!tx.me.areaIds.includes(src.fromAreaId!)) return fail('Hanya Operasional area asal yang bisa melepas personel.');
    if (f.mutations?.[key]) return fail('Personel untuk sumber ini sudah dilepas.');
    if (personnelIds.length !== src.qty) return fail(`Pilih tepat ${src.qty} personel sesuai jumlah di FPK.`);
    if (!effectiveDate) return fail('Isi tanggal efektif.');
    for (const id of personnelIds) {
      const p = tx.s.personnel.find(x => x.id === id);
      if (!p || p.status !== 'aktif') return fail('Personel yang sedang dalam mutasi atau tidak aktif tidak bisa dipilih.');
    }
    personnelIds.forEach(id => { tx.s.personnel.find(x => x.id === id)!.status = 'dalam_mutasi'; });
    f.mutations = { ...(f.mutations ?? {}), [key]: { fromAreaId: src.fromAreaId!, fromSiteId: src.fromSiteId, qty: src.qty, releasedIds: personnelIds, effectiveDate, placed: false } };
    tx.closeTasks(t => t.refId === f.id && t.kind === 'lepas_mutasi' && (t.subKey === key || !t.subKey));
    const fromArea = tx.s.areas.find(a => a.id === src.fromAreaId)!;
    tx.addTask({ kind: 'ubah_penempatan', title: `Ubah penempatan ${personnelIds.length} personel mutasi dari ${fromArea.name} — ${f.number}`, refType: 'fpk', refId: f.id, subKey: key, assigneeRole: 'HR', assigneeUserId: headOf(tx, 'HR'), dueAt: hMinus1Due(tx, effectiveDate) });
    const toArea = tx.s.areas.find(a => a.id === siteOf(tx, v.siteId)?.areaId);
    tx.notify(`Mutasi ${personnelIds.length} personel dari ${fromArea.name} ke ${toArea?.name} efektif ${fmtDate(effectiveDate)}. Pindahkan lokasi di aplikasi absensi.`, [fromArea.picUserId, toArea?.picUserId], { refType: 'fpk', refId: f.id });
    tx.audit({ entity: 'mutasi', entityId: f.id, action: `Operasional melepas ${personnelIds.length} personel dari ${fromArea.name}`, after: `Efektif ${fmtDate(effectiveDate)}` });
    // Cek kuota lokasi asal (site bila diisi, kalau tidak area) setelah dilepas.
    const siteIds = new Set(tx.s.sites.filter(s => (src.fromSiteId ? s.id === src.fromSiteId : s.areaId === fromArea.id)).map(s => s.id));
    const quota = [...quotaByPosition(tx.s.spks, siteIds).values()].reduce((a, b) => a + b, 0);
    const actual = [...activeByPosition(tx.s.personnel, fromArea.id, src.fromSiteId).values()].reduce((a, b) => a + b, 0);
    if (actual < quota) {
      const due = wd(tx, num(tx, 'mutation.replacement_due_workdays', 5));
      const where = src.fromSiteId ? siteOf(tx, src.fromSiteId)?.name : fromArea.name;
      const t = `Lokasi asal ${where} kurang ${quota - actual} orang: cari pengganti`;
      tx.addTask({ kind: 'cari_pengganti', title: t, refType: 'fpk', refId: f.id, subKey: key, assigneeRole: 'Operasional', assigneeUserId: opsForArea(tx, fromArea.id), division: 'Operasional', dueAt: due });
      tx.addTask({ kind: 'cari_pengganti', title: t, refType: 'fpk', refId: f.id, subKey: key, assigneeRole: 'Recruitment', assigneeUserId: headOf(tx, 'Recruitment'), division: 'Recruitment', dueAt: due });
      tx.audit({ entity: 'mutasi', entityId: f.id, action: `Lokasi asal ${where} di bawah kuota`, after: `Kurang ${quota - actual} orang` });
    }
    return ok();
  });

  const placeMutation = (fpkId: string, key: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    const m = f?.mutations?.[key];
    if (!f || !m || m.placed || m.cancelled) return fail('Tidak ada mutasi yang menunggu.');
    if (!has(tx.me, 'HR')) return fail('Hanya HR.');
    const site = siteOf(tx, latest(f).siteId)!;
    m.releasedIds.forEach(id => {
      const p = tx.s.personnel.find(x => x.id === id)!;
      p.placements.forEach(pl => { if (!pl.end) pl.end = m.effectiveDate; });
      p.placements.push({ areaId: site.areaId, siteId: site.id, fpkId: f.id, start: m.effectiveDate });
      p.status = 'terdaftar';
    });
    m.placed = true;
    tx.closeTasks(t => t.refId === f.id && t.kind === 'ubah_penempatan' && t.subKey === key);
    tx.audit({ entity: 'mutasi', entityId: f.id, action: `HR mengubah penempatan ${m.releasedIds.length} personel ke ${site.name}` });
    return ok();
  });

  const cancelMutation = (fpkId: string, key: string) => exec(tx => {
    const f = fpkOf(tx, fpkId);
    const m = f?.mutations?.[key];
    if (!f || !m || m.placed || m.cancelled) return fail('Tidak ada mutasi yang bisa dibatalkan.');
    if (!has(tx.me, 'Operasional')) return fail('Hanya Operasional.');
    m.cancelled = true;
    tx.closeTasks(t => t.refId === f.id && t.kind === 'ubah_penempatan' && t.subKey === key, 'dibatalkan');
    tx.addTask({ kind: 'ubah_penempatan', title: `Mutasi dibatalkan: kembalikan ${m.releasedIds.length} personel ke penempatan asal atau jadikan standby — ${f.number}`, refType: 'fpk', refId: f.id, subKey: key, assigneeRole: 'HR', assigneeUserId: headOf(tx, 'HR'), dueAt: wd(tx, 1) });
    tx.audit({ entity: 'mutasi', entityId: f.id, action: 'Mutasi dibatalkan setelah personel dilepas' });
    return ok();
  });

  return {
    saveFpkDraft, submitFpk, submitNewVersion, reviewOps, reviewRecruitment, reviewProcurement, returnFpk, markNotFeasible,
    marginCheck, bodDecide, cancelFpk, cancelDraft, confirmStart, handOverToHr, registerPersonnel, placeStandby, releaseForMutation, placeMutation, cancelMutation,
  };
}

export type { FpkLine };
