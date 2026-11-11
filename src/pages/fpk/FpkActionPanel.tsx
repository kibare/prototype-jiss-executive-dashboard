import React, { useState } from 'react';
import { CheckCircle2, Undo2, Ban, Search, TrendingDown, AlertTriangle, PlayCircle, ThumbsUp, XCircle } from 'lucide-react';
import { useStore } from '../../store/store';
import { AttachmentChip, Badge, Btn, Card, ErrorText, Field, Input, Money, Select, Textarea, cx, toast, DateInput } from '../../ui/kit';
import { ReasonModal } from '../../ui/ReasonModal';
import { latest } from '../../domain/selectors';
import { SOURCE_LABEL } from '../../domain/labels';
import { settingNum } from '../../domain/settings';
import { TODAY, diffDays, fmtDate } from '../../domain/time';
import { has, isDeputy } from '../../domain/rbac';
import { deputyMayAct } from '../../domain/tasks';
import type { Division, Fpk, FpkLineSource, SourceKind } from '../../domain/types';

type R = { ok: boolean; error?: string };
const done = (r: R, msg: string, setErr: (e: string) => void) => {
  if (r.ok) { toast(msg); setErr(''); } else setErr(r.error ?? 'Gagal');
};

/** Tombol Kembalikan + Tandai tidak layak yang dimiliki setiap pemeriksa. */
const ReviewerExtras: React.FC<{ f: Fpk; division: Division }> = ({ f, division }) => {
  const { actions } = useStore();
  const [modal, setModal] = useState<'return' | 'nf' | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-100">
        <Btn size="sm" variant="secondary" icon={<Undo2 className="w-3.5 h-3.5" />} onClick={() => setModal('return')}>Kembalikan ke Marketing</Btn>
        {division !== 'Finance' && <Btn size="sm" variant="secondary" icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setModal('nf')}>Tandai tidak layak</Btn>}
      </div>
      {modal === 'return' && (
        <ReasonModal title="Kembalikan FPK" label="Alasan" confirm="Kembalikan" variant="warning"
          hint="FPK langsung kembali ke Marketing. Review divisi lain yang belum selesai ditutup; yang sudah selesai tetap disimpan."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.returnFpk(f.id, division, t); if (r.ok) toast('FPK dikembalikan'); return r; }} />
      )}
      {modal === 'nf' && (
        <ReasonModal title="Tandai tidak layak" label="Alasan" confirm="Tandai tidak layak" variant="danger"
          hint="Tidak menghentikan alur dan tidak memveto. Tandanya tampil di layar persetujuan BOD, lalu BOD yang memutuskan."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.markNotFeasible(f.id, division, t); if (r.ok) toast('Ditandai tidak layak; cek Anda dianggap selesai'); return r; }} />
      )}
    </>
  );
};

const OpsPanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { actions } = useStore();
  const [result, setResult] = useState<'cocok' | 'ada_perubahan' | 'perlu_survei'>('cocok');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  return (
    <Card title={f.surveyPending ? 'Hasil survei Operasional' : 'Cek Operasional'}>
      <div className="space-y-2">
        {(f.surveyPending ? (['cocok', 'ada_perubahan'] as const) : (['cocok', 'ada_perubahan', 'perlu_survei'] as const)).map(k => (
          <label key={k} className={cx('flex items-start gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer', result === k ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200')}>
            <input type="radio" checked={result === k} onChange={() => setResult(k)} className="mt-1" />
            <span>
              <b>{k === 'cocok' ? 'Cocok' : k === 'ada_perubahan' ? 'Ada perubahan' : 'Perlu survei dulu'}</b>
              <span className="block text-xs text-slate-500">
                {k === 'cocok' ? 'Kebutuhan personel sesuai kondisi lokasi.' : k === 'ada_perubahan' ? 'Tulis selisih per baris dan alasannya. Informasi ini dibawa ke Finance dan BOD.' : 'Membuat tugas survei untuk Operasional (2 hari kerja). Cek margin Finance menunggu sampai survei selesai.'}
              </span>
            </span>
          </label>
        ))}
      </div>
      {result === 'ada_perubahan' && (
        <Field label="Selisih per baris + alasan" required className="mt-3">
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Anggota Satpam shift Malam 2 → 3, karena ada 2 pos jaga." />
        </Field>
      )}
      <div className="mt-3"><ErrorText>{err}</ErrorText></div>
      <div className="flex justify-end mt-3">
        <Btn icon={result === 'perlu_survei' ? <Search className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} onClick={() => done(actions.reviewOps(f.id, result, note), result === 'perlu_survei' ? 'Tugas survei dibuat' : 'Cek Operasional selesai', setErr)}>
          {result === 'perlu_survei' ? 'Minta survei' : 'Simpan hasil cek'}
        </Btn>
      </div>
      <ReviewerExtras f={f} division="Operasional" />
    </Card>
  );
};

const RecPanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { state, lookups, actions } = useStore();
  const v = latest(f);
  const [src, setSrc] = useState<Record<string, FpkLineSource[]>>(
    Object.fromEntries(v.lines.map(l => [l.id, l.sources.length ? l.sources : [{ kind: 'rekrut' as SourceKind, qty: l.qty }]])),
  );
  const [ready, setReady] = useState('');
  const [err, setErr] = useState('');
  const set = (lineId: string, i: number, patch: Partial<FpkLineSource>) =>
    setSrc({ ...src, [lineId]: src[lineId].map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <Card title="Cek Recruitment: sumber personel per baris">
      <div className="space-y-4">
        {v.lines.map(l => {
          const total = (src[l.id] ?? []).reduce((n, s) => n + (s.qty || 0), 0);
          return (
            <div key={l.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{lookups.position.get(l.positionId)?.name} · {l.shift} · {l.qty} orang</span>
                <Badge tone={total === l.qty ? 'green' : 'red'}>{total}/{l.qty}</Badge>
              </div>
              {(src[l.id] ?? []).map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                  <Select className="col-span-6 sm:col-span-3" value={s.kind} onChange={e => set(l.id, i, { kind: e.target.value as SourceKind, fromAreaId: undefined, fromSiteId: undefined })}>
                    {(Object.keys(SOURCE_LABEL) as SourceKind[]).map(k => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}
                  </Select>
                  <Input className="col-span-6 sm:col-span-2" type="number" min={0} value={s.qty} onChange={e => set(l.id, i, { qty: Number(e.target.value) })} />
                  {s.kind === 'mutasi' && (
                    <>
                      <Select className="col-span-6 sm:col-span-3" value={s.fromAreaId ?? ''} onChange={e => set(l.id, i, { fromAreaId: e.target.value || undefined, fromSiteId: undefined })}>
                        <option value="">Area asal *</option>
                        {state.areas.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                      <Select className="col-span-6 sm:col-span-3" value={s.fromSiteId ?? ''} onChange={e => set(l.id, i, { fromSiteId: e.target.value || undefined })}>
                        <option value="">Site asal (opsional)</option>
                        {state.sites.filter(x => x.areaId === s.fromAreaId).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </Select>
                    </>
                  )}
                </div>
              ))}
              <button className="text-xs font-semibold text-indigo-700" onClick={() => setSrc({ ...src, [l.id]: [...(src[l.id] ?? []), { kind: 'standby', qty: 0 }] })}>+ Tambah sumber</button>
            </div>
          );
        })}
        <Field label="Perkiraan tanggal siap" required><DateInput value={ready} onChange={e => setReady(e.target.value)} className="sm:w-48" /></Field>
      </div>
      <div className="mt-3"><ErrorText>{err}</ErrorText></div>
      <div className="flex justify-end mt-3">
        <Btn icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => done(actions.reviewRecruitment(f.id, src, ready), 'Cek Recruitment selesai', setErr)}>Simpan hasil cek</Btn>
      </div>
      <ReviewerExtras f={f} division="Recruitment" />
    </Card>
  );
};

const ProcPanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { actions } = useStore();
  const [available, setAvailable] = useState(true);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  return (
    <Card title="Cek Pengadaan">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={available} onChange={() => setAvailable(true)} /> Barang standar (seragam, perlengkapan) tersedia</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!available} onChange={() => setAvailable(false)} /> Perlu dipesan</label>
      </div>
      <Field label={available ? 'Catatan (opsional)' : 'Perkiraan waktu siap'} required={!available} className="mt-3">
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder={available ? '' : 'Contoh: sepatu ukuran 44 siap 7 hari'} />
      </Field>
      <div className="mt-3"><ErrorText>{err}</ErrorText></div>
      <div className="flex justify-end mt-3">
        <Btn icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => done(actions.reviewProcurement(f.id, available, note), 'Cek Pengadaan selesai', setErr)}>Simpan hasil cek</Btn>
      </div>
      <ReviewerExtras f={f} division="Pengadaan" />
    </Card>
  );
};

const FinancePanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { state, actions } = useStore();
  const v = latest(f);
  const [cost, setCost] = useState<number>(0);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const min = settingNum(state.settings, 'margin.minimum_pct', 10);
  const margin = cost > 0 ? Math.round(((v.monthlyValue - cost) / v.monthlyValue) * 1000) / 10 : null;
  return (
    <Card title="Cek margin Finance">
      <div className="flex flex-wrap gap-2 mb-3">{v.attachments.filter(a => a.kind === 'BOQ').map(a => <AttachmentChip key={a.id} a={a} clientId={v.clientId} entity="fpk" entityId={f.id} />)}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Nilai per bulan (sebelum PPN)"><div className="py-2 font-semibold"><Money value={v.monthlyValue} clientId={v.clientId} /></div></Field>
        <Field label="Estimasi biaya per bulan (Rp)" required><Input type="number" min={0} value={cost || ''} onChange={e => setCost(Number(e.target.value))} /></Field>
        <Field label="Estimasi margin">
          <div className={cx('py-2 font-bold', margin !== null && margin < min ? 'text-rose-600' : 'text-slate-900')}>
            {margin === null ? '–' : `${margin.toLocaleString('id-ID')}%`}
            {margin !== null && margin < min && <span className="block text-xs font-semibold">Di bawah minimum {min}%: diteruskan ke BOD dengan tanda</span>}
          </div>
        </Field>
      </div>
      <Field label="Catatan (opsional)" className="mt-3"><Input value={note} onChange={e => setNote(e.target.value)} /></Field>
      <div className="mt-3"><ErrorText>{err}</ErrorText></div>
      <div className="flex justify-end mt-3">
        <Btn icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => done(actions.marginCheck(f.id, cost, note), 'Cek margin selesai, diteruskan ke BOD', setErr)}>Simpan & teruskan ke BOD</Btn>
      </div>
      <ReviewerExtras f={f} division="Finance" />
    </Card>
  );
};

const BodPanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { state, me, actions, lookups } = useStore();
  const [modal, setModal] = useState<'setujui' | 'kembalikan' | 'tolak' | null>(null);
  const v = latest(f);
  const min = settingNum(state.settings, 'margin.minimum_pct', 10);
  const low = (v.estMarginPct ?? 100) < min;
  const deputy = !has(me, 'BOD') && isDeputy(me, state.delegations);
  if (f.createdBy === me.id) {
    return <Card title="Persetujuan BOD"><p className="text-sm text-rose-700">Anda pembuat FPK ini, jadi tidak bisa menyetujuinya. Persetujuan pindah ke BOD ({lookups.user.get('u-bod')?.name}).</p></Card>;
  }
  const bodTask = state.tasks.find(t => t.refId === f.id && t.kind === 'setujui_fpk' && t.status === 'terbuka');
  if (deputy && !deputyMayAct(me, state.delegations, bodTask)) {
    return <Card title="Persetujuan BOD"><p className="text-sm text-slate-600">Menunggu BOD. Sebagai wakil, Anda baru bisa memutuskan setelah tugas BOD lewat batas{bodTask ? ` (${fmtDate(bodTask.dueAt)})` : ''}, atau saat delegasi periode aktif.</p></Card>;
  }
  return (
    <Card title={deputy ? 'Persetujuan BOD (Anda sebagai wakil, tercatat atas nama BOD)' : 'Persetujuan BOD'}>
      <div className="space-y-2 mb-3">
        {low && <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"><TrendingDown className="w-4 h-4" /> Margin {v.estMarginPct?.toLocaleString('id-ID')}% di bawah minimum {min}%.</div>}
        {f.notFeasible && <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4 mt-0.5" /><span>Ditandai <b>tidak layak</b> oleh {f.notFeasible.division} ({lookups.user.get(f.notFeasible.by)?.name}): {f.notFeasible.reason}</span></div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn variant="success" icon={<ThumbsUp className="w-4 h-4" />} onClick={() => setModal('setujui')}>{f.notFeasible ? 'Setujui dengan catatan' : 'Setujui'}</Btn>
        <Btn variant="warning" icon={<Undo2 className="w-4 h-4" />} onClick={() => setModal('kembalikan')}>{f.notFeasible || low ? 'Minta nego ulang (kembalikan)' : 'Kembalikan'}</Btn>
        <Btn variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={() => setModal('tolak')}>Tolak</Btn>
      </div>
      {modal === 'setujui' && (
        <ReasonModal title="Setujui FPK" label="Catatan" confirm="Setujui" variant="success" required={!!f.notFeasible}
          hint="Setelah disetujui: info ke divisi terkait dan PIC area, lalu tugas serah ke HR, mutasi, dan mulai jaga dibuat otomatis."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.bodDecide(f.id, 'setujui', t); if (r.ok) toast('FPK disetujui'); return r; }} />
      )}
      {modal === 'kembalikan' && (
        <ReasonModal title="Kembalikan FPK" label="Alasan" confirm="Kembalikan" variant="warning"
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.returnFpk(f.id, 'BOD', t); if (r.ok) toast('FPK dikembalikan ke Marketing'); return r; }} />
      )}
      {modal === 'tolak' && (
        <ReasonModal title="Tolak FPK" label="Alasan" confirm="Tolak" variant="danger" hint="FPK yang ditolak diarsipkan."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.bodDecide(f.id, 'tolak', t); if (r.ok) toast('FPK ditolak'); return r; }} />
      )}
    </Card>
  );
};

const StartPanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { state, actions } = useStore();
  const [err, setErr] = useState('');
  const v = latest(f);
  const notYet = diffDays(v.plannedStart, TODAY) < 0;
  const count = state.personnel.filter(p => p.placements.some(pl => pl.fpkId === f.id && !pl.end) && ['terdaftar', 'standby'].includes(p.status)).length;
  const calon = state.personnel.filter(p => p.status === 'calon' && p.placements.some(pl => pl.fpkId === f.id && !pl.end)).length;
  const prep = state.tasks.filter(t => t.refId === f.id && t.status === 'terbuka' && t.kind !== 'mulai_jaga');
  return (
    <Card title="Mulai jaga">
      <p className="text-sm text-slate-600">
        Konfirmasi di hari pertama personel jaga. Ini titik awal hitungan jalan tanpa SPK, dan {count} personel yang tercantum otomatis berstatus aktif.
      </p>
      {(calon > 0 || prep.length > 0) && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Persiapan belum lengkap. Mulai jaga tetap bisa dikonfirmasi, tapi:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {calon > 0 && <li>{calon} calon belum ditandai terdaftar oleh HR, jadi belum ikut menjadi aktif.</li>}
              {prep.map(t => <li key={t.id}>{t.title} (belum selesai)</li>)}
            </ul>
          </div>
        </div>
      )}
      {notYet && <p className="text-xs text-amber-700 mt-2">Tanggal mulai rencana {fmtDate(v.plannedStart)}. Tombol aktif pada tanggal itu.</p>}
      <div className="mt-3"><ErrorText>{err}</ErrorText></div>
      <div className="flex justify-end mt-3">
        <Btn variant="success" disabled={notYet} icon={<PlayCircle className="w-4 h-4" />} onClick={() => done(actions.confirmStart(f.id), 'Mulai jaga dikonfirmasi', setErr)}>Konfirmasi mulai jaga</Btn>
      </div>
    </Card>
  );
};

/** Panel aksi untuk user yang sedang login, sesuai peran dan status FPK. */
export const FpkActionPanel: React.FC<{ f: Fpk }> = ({ f }) => {
  const { me, state, lookups } = useStore();
  const v = latest(f);
  const site = lookups.site.get(v.siteId);
  const inScope = (role: 'Operasional' | 'PIC Area') => has(me, role) && !!site && (me.areaIds.includes(site.areaId) || role !== 'PIC Area' && !me.areaIds.length);
  const panels: React.ReactNode[] = [];
  if (f.status === 'cek_divisi') {
    if (f.pendingDivisions.includes('Operasional') && inScope('Operasional')) panels.push(<OpsPanel key="ops" f={f} />);
    if (f.pendingDivisions.includes('Recruitment') && has(me, 'Recruitment')) panels.push(<RecPanel key="rec" f={f} />);
    if (f.pendingDivisions.includes('Pengadaan') && has(me, 'Pengadaan')) panels.push(<ProcPanel key="peng" f={f} />);
  }
  if (f.status === 'cek_margin' && has(me, 'Finance')) panels.push(<FinancePanel key="fin" f={f} />);
  if (f.status === 'menunggu_bod' && (has(me, 'BOD') || isDeputy(me, state.delegations))) panels.push(<BodPanel key="bod" f={f} />);
  if (f.status === 'disetujui' && inScope('PIC Area')) panels.push(<StartPanel key="start" f={f} />);
  if (!panels.length) return null;
  return <div className="space-y-4">{panels}</div>;
};
