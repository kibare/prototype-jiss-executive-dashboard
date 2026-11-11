import React, { useState } from 'react';
import { Send, CheckCircle2, ThumbsUp, Undo2, TrendingDown, Plus, Paperclip, Trash2, Handshake, XCircle, MessageSquare } from 'lucide-react';
import { useStore } from '../../store/store';
import { AttachmentChip, Badge, Btn, Card, DL, ErrorText, Field, Input, Money, PageHeader, Table, Tabs, Td, cx, toast, DateInput } from '../../ui/kit';
import { ReasonModal } from '../../ui/ReasonModal';
import { Link, navigate } from '../../router';
import { NotFound } from '../Misc';
import { MEMO_STATUS, MEMO_TYPE } from '../../domain/labels';
import { effectiveSpks } from '../../domain/selectors';
import { TODAY, diffDays, fmtDate, hMinus, fmtDateTime } from '../../domain/time';
import { settingNum } from '../../domain/settings';
import { has, isDeputy } from '../../domain/rbac';
import { deputyMayAct } from '../../domain/tasks';
import type { Memo, MemoType } from '../../domain/types';

const FilePick: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <Field label={label} required>
    {value ? (
      <div className="flex items-center justify-between gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <span className="flex items-center gap-1.5 truncate"><Paperclip className="w-3.5 h-3.5 shrink-0" />{value}</span>
        <button onClick={() => onChange('')} className="text-slate-400 hover:text-rose-600" aria-label="Hapus file"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ) : (
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border border-dashed border-indigo-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-indigo-50">
        <Plus className="w-3.5 h-3.5" /> Pilih file
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const n = e.target.files?.[0]?.name; if (n) onChange(n); e.target.value = ''; }} />
      </label>
    )}
  </Field>
);

const useMemoDates = () => {
  const { state } = useStore();
  const n = (k: string, fb: number) => settingNum(state.settings, k, fb);
  return (end: string) => ({
    start: hMinus(end, n('memo.start_days_before_end', 75)),
    send: hMinus(end, n('memo.send_deadline_days_before_end', 60)),
    answer: hMinus(end, n('memo.answer_deadline_days_before_end', 30)),
  });
};

// ---------------- Daftar ----------------

export const MemoListPage: React.FC = () => {
  const { state, lookups, access, me } = useStore();
  const [tab, setTab] = useState('berjalan');
  const dates = useMemoDates();
  const visibleSpk = (spkId: string) => { const s = lookups.spk.get(spkId); return !!s && access.area(lookups.site.get(s.siteId)?.areaId ?? ''); };
  const startDays = settingNum(state.settings, 'memo.start_days_before_end', 75);
  const due = effectiveSpks(state.spks).filter(s =>
    visibleSpk(s.id) && diffDays(TODAY, s.periodEnd) <= startDays && !state.memos.some(m => m.spkId === s.id));
  const memos = state.memos.filter(m => visibleSpk(m.spkId));
  const rows = memos.filter(m => tab === 'semua' || (tab === 'berjalan' ? m.status !== 'dijawab' : m.status === 'dijawab'));
  const isMine = (clientId: string) => { const c = lookups.client.get(clientId); return !!c && (c.accountOwnerId === me.id || c.coOwnerIds.includes(me.id)); };

  return (
    <div>
      <PageHeader title="Memo eksternal" subtitle="Keputusan perpanjang atau akhiri harus selesai sekitar dua bulan sebelum SPK habis: tugas di H-75, terkirim paling lambat H-60, dijawab paling lambat H-30." />
      <Card title={`SPK masuk H-${startDays} tanpa memo (${due.length})`} pad={false} className="mb-5">
        <Table head={['SPK', 'Klien / site', 'Berakhir', 'Batas kirim (H-60)', '']}>
          {due.map(s => {
            const d = dates(s.periodEnd);
            const late = diffDays(d.send, TODAY) > 0;
            return (
              <tr key={s.id} className={late ? 'bg-rose-50/60' : ''}>
                <Td>
                  <Link to={`/spk/${s.id}`} className="font-semibold text-indigo-700 hover:underline whitespace-nowrap">{s.number}</Link>
                  {s.isInitialData && <div><Badge className="mt-1">data awal hampir habis</Badge></div>}
                </Td>
                <Td><div className="font-medium">{lookups.client.get(s.clientId)?.name}</div><div className="text-xs text-slate-500">{lookups.site.get(s.siteId)?.name}</div></Td>
                <Td className="whitespace-nowrap">{fmtDate(s.periodEnd)}<div className="text-xs text-slate-500">{diffDays(TODAY, s.periodEnd)} hari lagi</div></Td>
                <Td className={cx('whitespace-nowrap', late && 'text-rose-600 font-semibold')}>{fmtDate(d.send)}{late && <div className="text-xs">lewat, eskalasi BOD</div>}</Td>
                <Td>{has(me, 'Marketing') && isMine(s.clientId) && <Btn size="sm" onClick={() => navigate(`/memo/baru?spk=${s.id}`)}>Pilih jenis memo</Btn>}</Td>
              </tr>
            );
          })}
        </Table>
        {due.length === 0 && <p className="text-sm text-slate-500 p-4">Tidak ada.</p>}
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'berjalan', label: `Berjalan (${memos.filter(m => m.status !== 'dijawab').length})` },
        { key: 'selesai', label: 'Sudah dijawab' },
        { key: 'semua', label: 'Semua' },
      ]} />
      <Card pad={false}>
        <Table head={['Memo', 'SPK / klien', 'Jenis', 'Status', 'Nilai baru', 'Tenggat']}>
          {rows.map(m => {
            const s = lookups.spk.get(m.spkId)!;
            const d = dates(s.periodEnd);
            const v = m.versions[m.versions.length - 1];
            return (
              <tr key={m.id}>
                <Td>
                  <Link to={`/memo/${m.id}`} className="font-semibold text-indigo-700 hover:underline whitespace-nowrap">{m.number ?? 'Draf (nomor keluar saat disetujui)'}</Link>
                  {m.parentMemoId && <div className="text-xs text-slate-500">nego atas {lookups.memo.get(m.parentMemoId)?.number}</div>}
                </Td>
                <Td><div className="text-sm">{s.number}</div><div className="text-xs text-slate-500">{lookups.client.get(s.clientId)?.name}</div></Td>
                <Td className="text-xs">{MEMO_TYPE[m.type]}</Td>
                <Td>
                  <Badge tone={MEMO_STATUS[m.status].tone}>{MEMO_STATUS[m.status].label}</Badge>
                  {m.clientAnswer && <div className="text-xs mt-1">{m.clientAnswer === 'setuju' ? 'Klien setuju' : m.clientAnswer === 'nego' ? 'Klien nego' : 'Tidak lanjut'}</div>}
                </Td>
                <Td>{m.type.startsWith('perpanjangan') ? <Money value={v.newValue} clientId={s.clientId} /> : '–'}</Td>
                <Td className="text-xs whitespace-nowrap">
                  {m.status === 'terkirim' ? <>Jawaban: {fmtDate(d.answer)}</> : m.status === 'dijawab' ? '–' : <>Kirim: {fmtDate(d.send)}</>}
                </Td>
              </tr>
            );
          })}
        </Table>
        {rows.length === 0 && <p className="text-sm text-slate-500 p-4">Tidak ada memo.</p>}
      </Card>
    </div>
  );
};

// ---------------- Buat (pilih jenis) ----------------

const TYPES: { k: MemoType; desc: string }[] = [
  { k: 'perpanjangan_sama', desc: 'Nilai per bulan sama. Langsung ke persetujuan BOD.' },
  { k: 'perpanjangan_ump', desc: 'Harga naik mengikuti UMP/UMK. Lampirkan BOQ baru; Finance cek margin dulu.' },
  { k: 'pengakhiran_perusahaan', desc: 'JISS tidak melanjutkan kontrak. Perlu persetujuan BOD.' },
  { k: 'pengakhiran_klien', desc: 'Klien sudah memberi tahu tidak lanjut. Dicatat langsung dan memicu demobilisasi.' },
];

export const MemoNewPage: React.FC = () => {
  const { lookups, actions } = useStore();
  const spkId = new URLSearchParams(window.location.search).get('spk') ?? '';
  const s = lookups.spk.get(spkId);
  const [type, setType] = useState<MemoType>('perpanjangan_sama');
  const [err, setErr] = useState('');
  if (!s) return <NotFound what="SPK" />;
  const go = () => {
    const r = actions.startMemo(s.id, type);
    if (!r.ok) return setErr(r.error);
    toast(type === 'pengakhiran_klien' ? 'Pengakhiran dicatat, tugas demobilisasi dibuat' : 'Draf memo dibuat');
    navigate(`/memo/${r.id}`);
  };
  return (
    <div className="max-w-2xl">
      <PageHeader back={`/spk/${s.id}`} title="Pilih jenis memo" subtitle={`${s.number} · ${lookups.client.get(s.clientId)?.name} · berakhir ${fmtDate(s.periodEnd)}`} />
      <Card>
        <div className="space-y-2">
          {TYPES.map(t => (
            <label key={t.k} className={cx('flex items-start gap-3 border rounded-lg px-3 py-2.5 cursor-pointer', type === t.k ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200')}>
              <input type="radio" checked={type === t.k} onChange={() => setType(t.k)} className="mt-1" />
              <span><b className="text-sm">{MEMO_TYPE[t.k]}</b><span className="block text-xs text-slate-500">{t.desc}</span></span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">Draf terisi otomatis dari SPK (klien, site, periode baru, jabatan, jumlah, nilai). Nomor memo keluar saat disetujui BOD.</p>
        <div className="mt-3"><ErrorText>{err}</ErrorText></div>
        <div className="flex justify-end mt-3"><Btn onClick={go}>{type === 'pengakhiran_klien' ? 'Catat pengakhiran' : 'Buat draf memo'}</Btn></div>
      </Card>
    </div>
  );
};

// ---------------- Detail ----------------

const ActionCard: React.FC<{ m: Memo }> = ({ m }) => {
  const { state, lookups, me, actions } = useStore();
  const s = lookups.spk.get(m.spkId)!;
  const c = lookups.client.get(s.clientId);
  const owner = has(me, 'Marketing') && !!c && (c.accountOwnerId === me.id || c.coOwnerIds.includes(me.id));
  const v = m.versions[m.versions.length - 1];
  const min = settingNum(state.settings, 'margin.minimum_pct', 10);
  const [value, setValue] = useState(v.newValue);
  const [boq, setBoq] = useState('');
  const [cost, setCost] = useState(0);
  const [signed, setSigned] = useState('');
  const [proof, setProof] = useState('');
  const [sent, setSent] = useState(TODAY);
  const [modal, setModal] = useState<null | 'kembalikan' | 'setujui' | 'nego' | 'tidak_lanjut'>(null);
  const [err, setErr] = useState('');
  const run = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) { toast(msg); setErr(''); } else setErr(r.error ?? 'Gagal'); };
  const bodLike = has(me, 'BOD') || isDeputy(me, state.delegations);

  if (m.status === 'draf' && owner) {
    const ump = m.type === 'perpanjangan_ump';
    const extend = m.type.startsWith('perpanjangan');
    return (
      <Card title={v.bodDecision?.decision === 'kembalikan' ? `Revisi draf (dikembalikan BOD: ${v.bodDecision.note})` : 'Lengkapi draf memo'}>
        <div className="grid sm:grid-cols-2 gap-3">
          {extend && <Field label="Nilai per bulan periode baru, sebelum PPN (Rp)" required hint={ump ? undefined : 'Perpanjangan harga sama: nilai mengikuti SPK berjalan.'}>
            <Input type="number" value={value || ''} disabled={!ump} onChange={e => setValue(Number(e.target.value))} />
          </Field>}
          {ump && <FilePick label="BOQ baru" value={boq} onChange={setBoq} />}
        </div>
        {!extend && <p className="text-sm text-slate-600">Memo pengakhiran oleh perusahaan per {fmtDate(s.periodEnd)}. Setelah BOD setuju, sistem membuat draf PDF bernomor.</p>}
        <div className="mt-3"><ErrorText>{err}</ErrorText></div>
        <div className="flex justify-end mt-3">
          <Btn icon={<Send className="w-4 h-4" />} onClick={() => run(actions.submitMemo(m.id, value, boq), ump ? 'Dikirim ke cek margin Finance' : 'Dikirim ke BOD')}>{ump ? 'Kirim ke cek margin' : 'Kirim ke BOD'}</Btn>
        </div>
      </Card>
    );
  }
  if (m.status === 'cek_margin' && has(me, 'Finance')) {
    const margin = cost > 0 ? Math.round(((v.newValue - cost) / v.newValue) * 1000) / 10 : null;
    return (
      <Card title="Cek margin memo">
        {v.boq && <div className="mb-3"><AttachmentChip a={v.boq} clientId={s.clientId} entity="memo" entityId={m.id} /></div>}
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Nilai baru/bulan (sebelum PPN)"><div className="py-2 font-semibold"><Money value={v.newValue} clientId={s.clientId} /></div></Field>
          <Field label="Estimasi biaya/bulan (Rp)" required><Input type="number" value={cost || ''} onChange={e => setCost(Number(e.target.value))} /></Field>
          <Field label="Margin"><div className={cx('py-2 font-bold', margin !== null && margin < min && 'text-rose-600')}>{margin === null ? '–' : `${margin.toLocaleString('id-ID')}%`}</div></Field>
        </div>
        <div className="mt-3"><ErrorText>{err}</ErrorText></div>
        <div className="flex justify-end mt-3"><Btn icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => run(actions.memoMargin(m.id, cost), 'Diteruskan ke BOD')}>Simpan & teruskan ke BOD</Btn></div>
      </Card>
    );
  }
  if (m.status === 'menunggu_bod' && bodLike) {
    if (m.createdBy === me.id) return <Card title="Persetujuan BOD"><p className="text-sm text-rose-700">Anda pembuat memo ini, jadi tidak bisa menyetujuinya. Persetujuan pindah ke BOD.</p></Card>;
    const low = v.marginPct !== undefined && v.marginPct < min;
    const bodTask = state.tasks.find(t => t.refId === m.id && t.kind === 'setujui_memo' && t.status === 'terbuka');
    if (!has(me, 'BOD') && !deputyMayAct(me, state.delegations, bodTask)) {
      return <Card title="Persetujuan BOD"><p className="text-sm text-slate-600">Menunggu BOD. Sebagai wakil, Anda baru bisa memutuskan setelah tugas BOD lewat batas{bodTask ? ` (${fmtDate(bodTask.dueAt)})` : ''}, atau saat delegasi periode aktif.</p></Card>;
    }
    return (
      <Card title={has(me, 'BOD') ? 'Persetujuan BOD' : 'Persetujuan BOD (sebagai wakil, atas nama BOD)'}>
        {low && <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3"><TrendingDown className="w-4 h-4" />Margin {v.marginPct?.toLocaleString('id-ID')}% di bawah minimum {min}%.</div>}
        <div className="flex flex-wrap gap-2">
          <Btn variant="success" icon={<ThumbsUp className="w-4 h-4" />} onClick={() => setModal('setujui')}>Setujui</Btn>
          <Btn variant="warning" icon={<Undo2 className="w-4 h-4" />} onClick={() => setModal('kembalikan')}>Kembalikan</Btn>
        </div>
        {modal === 'setujui' && <ReasonModal title="Setujui memo" label="Catatan" confirm="Setujui" variant="success" required={false} hint="Nomor memo keluar dan sistem membuat draf PDF dari template kop surat. Penanda tangan: BOD atau wakil yang menyetujui." onClose={() => setModal(null)} onSubmit={t => { const r = actions.memoBodDecide(m.id, 'setujui', t); if (r.ok) toast('Memo disetujui'); return r; }} />}
        {modal === 'kembalikan' && <ReasonModal title="Kembalikan memo" label="Alasan" confirm="Kembalikan" variant="warning" onClose={() => setModal(null)} onSubmit={t => { const r = actions.memoBodDecide(m.id, 'kembalikan', t); if (r.ok) toast('Memo dikembalikan'); return r; }} />}
      </Card>
    );
  }
  if (m.status === 'disetujui' && owner) {
    return (
      <Card title="Kirim memo ke klien">
        <p className="text-sm text-slate-600 mb-3">Unduh draf PDF, minta tanda tangan, lalu unggah versi bertanda tangan dan bukti kirim. Batas kirim H-60.</p>
        {m.draftPdf && <div className="mb-3"><AttachmentChip a={m.draftPdf} clientId={s.clientId} entity="memo" entityId={m.id} /></div>}
        <div className="grid sm:grid-cols-3 gap-3">
          <FilePick label="Memo bertanda tangan" value={signed} onChange={setSigned} />
          <FilePick label="Bukti kirim" value={proof} onChange={setProof} />
          <Field label="Tanggal kirim" required><DateInput value={sent} onChange={e => setSent(e.target.value)} /></Field>
        </div>
        <div className="mt-3"><ErrorText>{err}</ErrorText></div>
        <div className="flex justify-end mt-3"><Btn icon={<Send className="w-4 h-4" />} onClick={() => run(actions.sendMemo(m.id, signed, proof, sent), 'Memo ditandai terkirim')}>Tandai terkirim</Btn></div>
      </Card>
    );
  }
  if (m.status === 'terkirim' && owner && m.type === 'pengakhiran_perusahaan') {
    return (
      <Card title="Konfirmasi pemberitahuan pengakhiran">
        <p className="text-sm text-slate-600 mb-3">Memo pengakhiran oleh perusahaan bersifat pemberitahuan, jadi tidak ada setuju atau nego. Tandai bila klien sudah menerima memo.</p>
        <Btn variant="danger" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setModal('tidak_lanjut')}>Klien sudah menerima pemberitahuan</Btn>
        {modal === 'tidak_lanjut' && <ReasonModal title="Klien sudah menerima pemberitahuan" label="Catatan" confirm="Simpan" variant="danger" required={false} hint="Tugas demobilisasi dibuat untuk Operasional (tarik personel) dan HR (akhiri penempatan); Finance diberi info untuk invoice terakhir." onClose={() => setModal(null)} onSubmit={t => { const r = actions.recordAnswer(m.id, 'tidak_lanjut', t); if (r.ok) toast('Tugas demobilisasi dibuat'); return r; }} />}
      </Card>
    );
  }
  if (m.status === 'terkirim' && owner) {
    return (
      <Card title="Catat jawaban klien">
        <div className="flex flex-wrap gap-2">
          <Btn variant="success" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setModal('setujui')}>Setuju</Btn>
          <Btn variant="warning" icon={<Handshake className="w-4 h-4" />} onClick={() => setModal('nego')}>Nego</Btn>
          <Btn variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={() => setModal('tidak_lanjut')}>Tidak lanjut</Btn>
        </div>
        {modal === 'setujui' && <ReasonModal title="Klien setuju" label="Catatan" confirm="Simpan" variant="success" required={false} hint="Marketing mendapat tugas input SPK perpanjangan. Bila jumlah atau jabatan berubah, lewat FPK perubahan." onClose={() => setModal(null)} onSubmit={t => { const r = actions.recordAnswer(m.id, 'setuju', t); if (r.ok) toast('Jawaban dicatat'); return r; }} />}
        {modal === 'nego' && <ReasonModal title="Klien nego" label="Isi permintaan klien" confirm="Simpan" variant="warning" hint="Memo yang sudah terkirim tidak diubah. Sistem membuat memo baru (draf) yang merujuk memo ini; revisi BOQ lalu kembali ke cek margin." onClose={() => setModal(null)} onSubmit={t => { const r = actions.recordAnswer(m.id, 'nego', t); if (r.ok) toast('Memo baru untuk nego dibuat'); return r; }} />}
        {modal === 'tidak_lanjut' && <ReasonModal title="Klien tidak lanjut" label="Catatan" confirm="Simpan" variant="danger" hint="Tugas demobilisasi dibuat sekaligus untuk Operasional (tarik personel) dan HR (akhiri penempatan); Finance diberi info untuk invoice terakhir." onClose={() => setModal(null)} onSubmit={t => { const r = actions.recordAnswer(m.id, 'tidak_lanjut', t); if (r.ok) toast('Tugas demobilisasi dibuat'); return r; }} />}
      </Card>
    );
  }
  return null;
};

export const MemoDetailPage: React.FC<{ id: string }> = ({ id }) => {
  const { state, lookups, access } = useStore();
  const dates = useMemoDates();
  const m = lookups.memo.get(id);
  const s = m ? lookups.spk.get(m.spkId) : undefined;
  const site = s ? lookups.site.get(s.siteId) : undefined;
  if (!m || !s || !site || !access.area(site.areaId)) return <NotFound what="Memo" />;
  const d = dates(s.periodEnd);
  const v = m.versions[m.versions.length - 1];
  const children = state.memos.filter(x => x.parentMemoId === m.id);
  const steps = ['draf', 'cek_margin', 'menunggu_bod', 'disetujui', 'terkirim', 'dijawab'].filter(x => m.type === 'perpanjangan_ump' || x !== 'cek_margin');
  const idx = steps.indexOf(m.status);
  const extend = m.type.startsWith('perpanjangan');

  return (
    <div className="space-y-5">
      <PageHeader
        back="/memo"
        title={m.number ?? 'Draf memo'}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={MEMO_STATUS[m.status].tone}>{MEMO_STATUS[m.status].label}</Badge>{MEMO_TYPE[m.type]} · dibuat {lookups.user.get(m.createdBy)?.name}, {fmtDate(m.createdAt)}</span>}
      />
      <div className="flex overflow-x-auto gap-1 pb-1">
        {steps.map((x, i) => (
          <div key={x} className={cx('flex-1 min-w-[90px] text-center text-[11px] font-semibold rounded-md py-1.5 border', i < idx ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : i === idx ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400')}>
            {MEMO_STATUS[x as Memo['status']].label}
          </div>
        ))}
      </div>
      {m.status === 'dijawab' && (
        <div className={cx('flex items-start gap-2 text-sm rounded-xl px-4 py-3 border', m.clientAnswer === 'setuju' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : m.clientAnswer === 'nego' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900')}>
          <MessageSquare className="w-4 h-4 mt-0.5" />
          <span>
            Jawaban klien ({fmtDate(m.answeredAt)}): <b>{m.clientAnswer === 'setuju' ? 'setuju' : m.clientAnswer === 'nego' ? 'nego' : 'tidak lanjut'}</b>{m.answerNote ? ` — ${m.answerNote}` : ''}.
            {children.map(c => <span key={c.id}> Memo baru: <Link to={`/memo/${c.id}`} className="underline font-semibold">{c.number ?? 'draf'}</Link>.</span>)}
          </span>
        </div>
      )}
      <ActionCard m={m} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <Card title="Isi memo">
            <DL items={[
              ['SPK', <Link to={`/spk/${s.id}`} className="text-indigo-700 font-semibold hover:underline">{s.number}</Link>],
              ['Klien / site', `${lookups.client.get(s.clientId)?.name} · ${site.name}`],
              ['Periode berjalan', `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`],
              ['Periode baru', extend ? `${fmtDate(v.periodStart)} – ${fmtDate(v.periodEnd)}` : 'Tidak diperpanjang'],
              ['Nilai berjalan / bulan', <Money value={s.monthlyValue} clientId={s.clientId} />],
              ['Nilai baru / bulan', extend ? <Money value={v.newValue} clientId={s.clientId} className="font-semibold" /> : '–'],
              ['Jabatan dan jumlah', s.lines.map(l => `${l.qty} ${lookups.position.get(l.positionId)?.name}`).join(', ')],
              ['Margin', v.marginPct !== undefined ? (access.money(s.clientId) ? `${v.marginPct.toLocaleString('id-ID')}%` : <Money value={0} clientId={s.clientId} />) : '–'],
              ...(m.parentMemoId ? [['Nego atas', <Link to={`/memo/${m.parentMemoId}`} className="text-indigo-700 hover:underline">{lookups.memo.get(m.parentMemoId)?.number}</Link>] as [string, React.ReactNode]] : []),
            ]} />
          </Card>
          <Card title={`Riwayat versi draf (${m.versions.length})`} pad={false}>
            <Table head={['Versi', 'Nilai baru', 'BOQ', 'Margin', 'Keputusan BOD']}>
              {m.versions.map(x => (
                <tr key={x.no}>
                  <Td>v{x.no}<div className="text-xs text-slate-500">{fmtDateTime(x.createdAt)}</div></Td>
                  <Td>{extend ? <Money value={x.newValue} clientId={s.clientId} /> : '–'}</Td>
                  <Td>{x.boq ? <AttachmentChip a={x.boq} clientId={s.clientId} entity="memo" entityId={m.id} /> : '–'}</Td>
                  <Td>{x.marginPct !== undefined && access.money(s.clientId) ? `${x.marginPct.toLocaleString('id-ID')}%` : '–'}</Td>
                  <Td className="text-xs">{x.bodDecision ? <>{x.bodDecision.decision === 'setujui' ? 'Disetujui' : 'Dikembalikan'} oleh {lookups.user.get(x.bodDecision.by)?.name}{x.bodDecision.onBehalfOf && ' (atas nama BOD)'}{x.bodDecision.note && `: ${x.bodDecision.note}`}</> : '–'}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
        <div className="space-y-5 min-w-0">
          <Card title="Tenggat">
            <DL items={[
              ['Tugas memo (H-75)', fmtDate(d.start)],
              ['Terkirim paling lambat (H-60)', <span className={cx(m.status !== 'terkirim' && m.status !== 'dijawab' && diffDays(d.send, TODAY) > 0 && 'text-rose-600 font-semibold')}>{fmtDate(d.send)}</span>],
              ['Jawaban paling lambat (H-30)', <span className={cx(m.status === 'terkirim' && diffDays(d.answer, TODAY) > 0 && 'text-rose-600 font-semibold')}>{fmtDate(d.answer)}</span>],
              ['SPK berakhir', fmtDate(s.periodEnd)],
            ]} />
          </Card>
          <Card title="Dokumen">
            <div className="flex flex-col gap-1.5">
              {m.draftPdf && <AttachmentChip a={m.draftPdf} clientId={s.clientId} entity="memo" entityId={m.id} />}
              {m.signedPdf && <AttachmentChip a={m.signedPdf} clientId={s.clientId} entity="memo" entityId={m.id} />}
              {m.proof && <AttachmentChip a={m.proof} clientId={s.clientId} entity="memo" entityId={m.id} />}
              {m.sentAt && <span className="text-xs text-slate-500">Terkirim {fmtDate(m.sentAt)}</span>}
              {!m.draftPdf && <span className="text-xs text-slate-500">Draf PDF dibuat setelah BOD menyetujui.</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
