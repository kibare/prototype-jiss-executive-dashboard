import React, { useState } from 'react';
import { Plus, Trash2, Paperclip } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, ErrorText, Field, Input, PageHeader, Select, toast, DateInput } from '../../ui/kit';
import { navigate } from '../../router';
import { NotFound } from '../Misc';
import { fpkCoverage, latest } from '../../domain/selectors';
import { SHIFTS } from '../../domain/fpk';
import type { Shift, SpkType } from '../../domain/types';

type Line = { positionId: string; qty: number; shift: Shift; fpkLineId?: string };

export const SpkFormPage: React.FC<{ reviseId?: string }> = ({ reviseId }) => {
  const { state, lookups, me, actions } = useStore();
  const old = reviseId ? lookups.spk.get(reviseId) : undefined;
  const qs = new URLSearchParams(window.location.search);
  const qsFpk = qs.get('fpk') ?? '';
  const qsParent = qs.get('induk') ?? '';
  const myClient = (cid: string) => { const c = lookups.client.get(cid); return !!c && (c.accountOwnerId === me.id || c.coOwnerIds.includes(me.id)); };
  const fpks = state.fpks.filter(f => ['disetujui', 'berjalan', 'tertutup_sebagian'].includes(f.status) && myClient(latest(f).clientId));

  const [fpkId, setFpkId] = useState(old?.fpkId ?? (fpks.some(f => f.id === qsFpk) ? qsFpk : ''));
  const [number, setNumber] = useState(old?.number ?? '');
  const [type, setType] = useState<SpkType>(old?.type ?? (qsParent ? 'perpanjangan' : 'baru'));
  const [parentSpkId, setParent] = useState(old?.parentSpkId ?? qsParent);
  const [effectiveDate, setEff] = useState(old?.effectiveDate ?? '');
  const [siteId, setSiteId] = useState(old?.siteId ?? '');
  const [periodStart, setPS] = useState(old?.periodStart ?? '');
  const [periodEnd, setPE] = useState(old?.periodEnd ?? '');
  const [monthlyValue, setValue] = useState(old?.monthlyValue ?? 0);
  const [lines, setLines] = useState<Line[]>(old?.lines.map(l => ({ positionId: l.positionId, qty: l.qty, shift: l.shift, fpkLineId: l.fpkLineId })) ?? [{ positionId: '', qty: 1, shift: 'Pagi' }]);
  const [pdf, setPdf] = useState(old ? '' : '');
  const [err, setErr] = useState('');

  if (reviseId && (!old || old.status !== 'perlu_revisi' || !myClient(old.clientId))) return <NotFound what="SPK yang perlu revisi" />;
  const f = lookups.fpk.get(fpkId);
  const parentSpk = lookups.spk.get(parentSpkId);
  // Perpanjangan: FPK dan klien mengikuti SPK induk, baris dibandingkan dengan SPK induk.
  const noFpkRenewal = type === 'perpanjangan' && !!parentSpk;
  const clientId = f ? latest(f).clientId : noFpkRenewal ? parentSpk!.clientId : '';
  // Addendum menggantikan SPK induknya, jadi sisa kuota dihitung tanpa SPK induk.
  const cov = f ? fpkCoverage(f, type === 'addendum' && parentSpkId ? state.spks.filter(x => x.id !== parentSpkId) : state.spks, reviseId) : null;
  const sites = state.sites.filter(s => s.clientId === clientId);
  // Perpanjangan boleh untuk SPK yang sudah berakhir (mis. site masih dijaga setelah SPK habis).
  const parents = state.spks.filter(s => (s.status === 'aktif' || (type === 'perpanjangan' && s.status === 'berakhir')) && (clientId ? s.clientId === clientId : myClient(s.clientId)));

  const submit = () => {
    const r = actions.inputSpk({ number, type, parentSpkId: parentSpkId || undefined, fpkId: noFpkRenewal ? undefined : fpkId, siteId, periodStart, periodEnd, effectiveDate: effectiveDate || undefined, monthlyValue, lines, pdfName: pdf }, reviseId);
    if (!r.ok) return setErr(r.error);
    toast('SPK diinput, menunggu verifikasi Finance');
    navigate(`/spk/${r.id}`);
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={reviseId ? `/spk/${reviseId}` : '/spk'}
        title={reviseId ? `Input revisi ${old!.number}` : 'Input SPK'}
        subtitle="Ketik ulang data kunci dari dokumen SPK. Sengaja tanpa isi otomatis dari FPK, supaya Finance bisa menangkap perbedaannya."
      />
      {old?.revisionReason && <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 mb-4">Alasan perlu revisi: {old.revisionReason}</p>}
      <div className="space-y-4">
        <Card title="Dokumen">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="FPK induk" required>
              <Select value={noFpkRenewal ? '' : fpkId} onChange={e => { setFpkId(e.target.value); setSiteId(''); setLines(lines.map(l => ({ ...l, fpkLineId: undefined }))); }} disabled={!!reviseId || noFpkRenewal}>
                <option value="">{noFpkRenewal ? (parentSpk!.fpkId ? `Mengikuti SPK induk (${lookups.fpk.get(parentSpk!.fpkId)?.number})` : 'Tidak ada (SPK induk data awal)') : '– pilih FPK klien yang Anda pegang –'}</option>
                {fpks.map(x => <option key={x.id} value={x.id}>{x.number} · {lookups.client.get(latest(x).clientId)?.name} · {lookups.site.get(latest(x).siteId)?.name}</option>)}
              </Select>
            </Field>
            <Field label="Nomor SPK" required hint="Unik per klien."><Input value={number} onChange={e => setNumber(e.target.value)} placeholder="Sesuai dokumen klien" /></Field>
            <Field label="Jenis" required>
              <Select value={type} onChange={e => setType(e.target.value as SpkType)}>
                <option value="baru">Baru</option>
                <option value="addendum">Addendum</option>
                <option value="perpanjangan">Perpanjangan</option>
              </Select>
            </Field>
            {type !== 'baru' && (
              <Field label="SPK induk" required>
                <Select value={parentSpkId} onChange={e => setParent(e.target.value)}>
                  <option value="">– pilih –</option>
                  {parents.map(s => <option key={s.id} value={s.id}>{s.number} · {lookups.site.get(s.siteId)?.name}</option>)}
                </Select>
              </Field>
            )}
            {type === 'addendum' && <Field label="Tanggal berlaku addendum" required hint="Addendum menyimpan komposisi lengkap setelah perubahan, bukan selisih."><DateInput value={effectiveDate} onChange={e => setEff(e.target.value)} /></Field>}
            <Field label="Site" required>
              <Select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={!clientId}>
                <option value="">– pilih –</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Periode mulai" required><DateInput value={periodStart} onChange={e => setPS(e.target.value)} /></Field>
            <Field label="Periode selesai" required><DateInput value={periodEnd} onChange={e => setPE(e.target.value)} /></Field>
            <Field label="Nilai per bulan, sebelum PPN (Rp)" required hint="Sesuai SPK, belum termasuk PPN."><Input type="number" value={monthlyValue || ''} onChange={e => setValue(Number(e.target.value))} /></Field>
            <Field label="PDF SPK" required>
              {pdf ? (
                <div className="flex items-center justify-between text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5 truncate"><Paperclip className="w-3.5 h-3.5" />{pdf}</span>
                  <button onClick={() => setPdf('')} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border border-dashed border-indigo-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-indigo-50">
                  <Plus className="w-3.5 h-3.5" /> Pilih PDF
                  <input type="file" accept=".pdf" className="hidden" onChange={e => { const n = e.target.files?.[0]?.name; if (n) setPdf(n); }} />
                </label>
              )}
            </Field>
          </div>
        </Card>

        <Card title="Baris jabatan + baris FPK yang ditutup" actions={<Btn size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setLines([...lines, { positionId: '', qty: 1, shift: 'Pagi' }])}>Tambah baris</Btn>}>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Select className="col-span-12 sm:col-span-3" value={l.positionId} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, positionId: e.target.value } : x))}>
                  <option value="">– jabatan –</option>
                  {state.positions.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input className="col-span-3 sm:col-span-2" type="number" min={1} value={l.qty} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                <Select className="col-span-4 sm:col-span-2" value={l.shift} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, shift: e.target.value as Shift } : x))}>
                  {SHIFTS.map(s => <option key={s}>{s}</option>)}
                </Select>
                <Select className="col-span-12 sm:col-span-4 order-last sm:order-none" value={l.fpkLineId ?? ''} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, fpkLineId: e.target.value || undefined } : x))} disabled={!cov || noFpkRenewal}>
                  <option value="">{noFpkRenewal ? 'dibandingkan dengan SPK induk' : '– baris FPK yang ditutup –'}</option>
                  {cov?.lines.map(c => (
                    <option key={c.line.id} value={c.line.id}>
                      {lookups.position.get(c.line.positionId)?.name} · {c.line.shift} · sisa {c.line.qty - c.covered} dari {c.line.qty}
                    </option>
                  ))}
                </Select>
                <button className="col-span-1 text-slate-400 hover:text-rose-600 justify-self-center" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Hapus baris"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">SPK yang hanya menutup sebagian kuota FPK tetap diinput sebagai SPK tersendiri yang terhubung ke FPK yang sama.</p>
        </Card>

        <ErrorText>{err}</ErrorText>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={() => navigate(reviseId ? `/spk/${reviseId}` : '/spk')}>Batal</Btn>
          <Btn onClick={submit}>Kirim ke verifikasi Finance</Btn>
        </div>
      </div>
    </div>
  );
};
