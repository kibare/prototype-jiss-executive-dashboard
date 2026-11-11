import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Paperclip, Info } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, ErrorText, Field, Input, PageHeader, Select, toast, DateInput } from '../../ui/kit';
import { navigate } from '../../router';
import { NotFound } from '../Misc';
import { latest } from '../../domain/selectors';
import { rereviewPlan, SHIFTS } from '../../domain/fpk';
import { addDays, TODAY } from '../../domain/time';
import type { FpkInput } from '../../store/fpkActions';
import type { FpkType, FpkVersion, Shift } from '../../domain/types';

type Line = { id?: string; positionId: string; qty: number; shift: Shift };

const FilePick: React.FC<{ label: string; files: string[]; onAdd: (n: string) => void; onRemove: (i: number) => void; multiple?: boolean }> = ({ label, files, onAdd, onRemove, multiple }) => (
  <div>
    <div className="text-xs font-semibold text-slate-700 mb-1">{label} <span className="text-rose-500">*</span></div>
    <div className="space-y-1.5">
      {files.map((f, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="flex items-center gap-1.5 min-w-0"><Paperclip className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f}</span></span>
          <button onClick={() => onRemove(i)} className="text-slate-400 hover:text-rose-600" aria-label="Hapus lampiran"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      {(multiple || files.length === 0) && (
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border border-dashed border-indigo-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-indigo-50">
          <Plus className="w-3.5 h-3.5" /> Pilih file (PDF/JPG/PNG, maks 10 MB)
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const n = e.target.files?.[0]?.name; if (n) onAdd(n); e.target.value = ''; }} />
        </label>
      )}
    </div>
  </div>
);

export const FpkFormPage: React.FC<{ fpkId?: string }> = ({ fpkId }) => {
  const { state, lookups, me, actions } = useStore();
  const existing = fpkId ? lookups.fpk.get(fpkId) : undefined;
  const mode: 'baru' | 'draf' | 'versi' = !existing ? 'baru' : existing.status === 'draf' ? 'draf' : 'versi';
  const base = existing ? latest(existing) : undefined;

  const myClients = state.clients.filter(c => c.active && (c.accountOwnerId === me.id || c.coOwnerIds.includes(me.id)));
  const [type, setType] = useState<FpkType>(existing?.type ?? 'baru');
  const [parentFpkId, setParent] = useState(existing?.parentFpkId ?? '');
  const [clientId, setClientId] = useState(base?.clientId ?? '');
  const [newClient, setNewClient] = useState<null | { code: string; name: string; billingAddress: string }>(null);
  const [siteId, setSiteId] = useState(base?.siteId ?? '');
  const [newSite, setNewSite] = useState<null | { code: string; name: string; address: string; areaId: string }>(null);
  const [periodStart, setPS] = useState(base?.periodStart ?? '');
  const [periodEnd, setPE] = useState(base?.periodEnd ?? '');
  const [plannedStart, setPlanned] = useState(base?.plannedStart ?? '');
  const [monthlyValue, setValue] = useState<number>(base?.monthlyValue ?? 0);
  const [lines, setLines] = useState<Line[]>(base?.lines.map(l => ({ id: l.id, positionId: l.positionId, qty: l.qty, shift: l.shift })) ?? [{ positionId: '', qty: 1, shift: 'Pagi' }]);
  const [boq, setBoq] = useState<string[]>(base?.attachments.filter(a => a.kind === 'BOQ').map(a => a.fileName) ?? []);
  const [deal, setDeal] = useState<string[]>(base?.attachments.filter(a => a.kind === 'Bukti deal').map(a => a.fileName) ?? []);
  const [err, setErr] = useState('');

  const input: FpkInput = {
    type, parentFpkId: parentFpkId || undefined,
    clientId: newClient ? undefined : clientId, newClient: newClient ?? undefined,
    siteId: newSite ? undefined : siteId, newSite: newSite ?? undefined,
    periodStart, periodEnd, plannedStart, monthlyValue, lines,
    attachments: [...boq.map(fileName => ({ kind: 'BOQ' as const, fileName })), ...deal.map(fileName => ({ kind: 'Bukti deal' as const, fileName }))],
  };

  const plan = useMemo(() => {
    if (mode !== 'versi' || !existing || !base) return null;
    const temp: FpkVersion = {
      ...base, no: base.no + 1, clientId, siteId: newSite ? 'baru' : siteId, periodStart, periodEnd, plannedStart, monthlyValue,
      lines: lines.map((l, i) => ({ id: l.id ?? `tmp-${i}`, positionId: l.positionId, qty: l.qty, shift: l.shift, sources: [] })),
      attachments: [...boq, ...deal].map((fileName, i) => ({ id: `t${i}`, kind: 'BOQ', fileName, priced: true, uploadedBy: me.id, uploadedAt: '' })),
    };
    return rereviewPlan(existing, base, temp);
  }, [mode, existing, base, clientId, siteId, newSite, periodStart, periodEnd, plannedStart, monthlyValue, lines, boq, deal, me.id]);

  if (fpkId && (!existing || existing.createdBy !== me.id && !myClients.some(c => c.id === base?.clientId))) return <NotFound what="FPK" />;
  if (existing && !['draf', 'dikembalikan'].includes(existing.status)) return <NotFound what="FPK yang bisa diubah" />;

  const sites = state.sites.filter(s => s.clientId === clientId && s.active);
  const parents = state.fpks.filter(f => f.id !== fpkId && ['disetujui', 'berjalan', 'tertutup_sebagian', 'selesai'].includes(f.status) && (!clientId || latest(f).clientId === clientId));

  const saveDraft = (andSubmit: boolean) => {
    const r = actions.saveFpkDraft(input, mode === 'draf' ? fpkId : undefined);
    if (!r.ok) return setErr(r.error);
    if (andSubmit) {
      const r2 = actions.submitFpk(r.id!);
      if (!r2.ok) { setErr(`Draf tersimpan, tapi belum bisa dikirim: ${r2.error}`); return navigate(`/fpk/${r.id}/ubah`); }
      toast('FPK dikirim ke cek Operasional, Recruitment, dan Pengadaan');
    } else toast('Draf FPK disimpan');
    navigate(`/fpk/${r.id}`);
  };
  const submitVersion = () => {
    const r = actions.submitNewVersion(fpkId!, input);
    if (!r.ok) return setErr(r.error);
    toast(`Versi ${base!.no + 1} dikirim`);
    navigate(`/fpk/${fpkId}`);
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={fpkId ? `/fpk/${fpkId}` : '/fpk'}
        title={mode === 'baru' ? 'Buat FPK' : mode === 'draf' ? `Ubah draf ${existing!.number}` : `Versi baru ${existing!.number}`}
        subtitle={mode === 'versi' ? `Dikembalikan: "${existing!.returned?.reason}". Versi ${base!.no} tetap tersimpan dan bisa dibuka.` : 'BOQ dan bukti deal wajib dilampirkan sebelum FPK bisa dikirim ke cek.'}
      />
      <div className="space-y-4">
        <Card title="Kontrak">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Jenis" required>
              <Select value={type} onChange={e => setType(e.target.value as FpkType)} disabled={mode === 'versi'}>
                <option value="baru">Baru</option>
                <option value="perubahan">Perubahan</option>
                <option value="perpanjangan">Perpanjangan</option>
              </Select>
            </Field>
            {type !== 'baru' && (
              <Field label="FPK induk" required>
                <Select value={parentFpkId} onChange={e => setParent(e.target.value)}>
                  <option value="">– pilih –</option>
                  {parents.map(f => <option key={f.id} value={f.id}>{f.number} · {lookups.site.get(latest(f).siteId)?.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div>
              <Field label="Klien" required>
                {newClient ? (
                  <div className="space-y-2 border border-indigo-200 bg-indigo-50/40 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Kode" value={newClient.code} onChange={e => setNewClient({ ...newClient, code: e.target.value.toUpperCase() })} />
                      <Input placeholder="Nama klien" className="col-span-2" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                    </div>
                    <Input placeholder="Alamat penagihan" value={newClient.billingAddress} onChange={e => setNewClient({ ...newClient, billingAddress: e.target.value })} />
                    <p className="text-[11px] text-slate-600">Account owner otomatis Anda ({me.name}). Termin default dari pengaturan.</p>
                  </div>
                ) : (
                  <Select value={clientId} onChange={e => { setClientId(e.target.value); setSiteId(''); }} disabled={mode === 'versi'}>
                    <option value="">– pilih klien yang Anda pegang –</option>
                    {myClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
              {mode !== 'versi' && (
                <button className="text-xs font-semibold text-indigo-700 mt-1" onClick={() => { setNewClient(newClient ? null : { code: '', name: '', billingAddress: '' }); setNewSite(newClient ? null : { code: '', name: '', address: '', areaId: '' }); }}>
                  {newClient ? 'Pilih klien yang ada' : '+ Klien baru'}
                </button>
              )}
            </div>
            <div>
              <Field label="Site" required>
                {newSite ? (
                  <div className="space-y-2 border border-indigo-200 bg-indigo-50/40 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Kode" value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value.toUpperCase() })} />
                      <Input placeholder="Nama site" className="col-span-2" value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })} />
                    </div>
                    <Input placeholder="Alamat" value={newSite.address} onChange={e => setNewSite({ ...newSite, address: e.target.value })} />
                    <Select value={newSite.areaId} onChange={e => setNewSite({ ...newSite, areaId: e.target.value })}>
                      <option value="">– area yang mengurus –</option>
                      {state.areas.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                ) : (
                  <Select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={!clientId}>
                    <option value="">– pilih site –</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({lookups.area.get(s.areaId)?.name})</option>)}
                  </Select>
                )}
              </Field>
              {!newClient && (
                <button className="text-xs font-semibold text-indigo-700 mt-1" onClick={() => setNewSite(newSite ? null : { code: '', name: '', address: '', areaId: '' })}>
                  {newSite ? 'Pilih site yang ada' : '+ Site baru'}
                </button>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <Field label="Nilai per bulan, sebelum PPN (Rp)" required hint="Total penawaran per bulan di surat/BOQ, belum termasuk PPN. Field terbatas: tidak terlihat oleh Operasional, Recruitment, Pengadaan, HR, PIC area.">
              <Input type="number" min={0} value={monthlyValue || ''} onChange={e => setValue(Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Field label="Periode mulai" required><DateInput value={periodStart} onChange={e => { setPS(e.target.value); if (!plannedStart) setPlanned(e.target.value); if (!periodEnd && e.target.value) setPE(addDays(addDays(e.target.value, 365), -1)); }} /></Field>
            <Field label="Periode selesai" required><DateInput value={periodEnd} onChange={e => setPE(e.target.value)} /></Field>
            <Field label="Tanggal mulai rencana" required><DateInput value={plannedStart} min={TODAY} onChange={e => setPlanned(e.target.value)} /></Field>
          </div>
        </Card>

        <Card title="Baris jabatan" actions={<Btn size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setLines([...lines, { positionId: '', qty: 1, shift: 'Pagi' }])}>Tambah baris</Btn>}>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Select className="col-span-12 sm:col-span-6" value={l.positionId} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, positionId: e.target.value } : x))}>
                  <option value="">– jabatan –</option>
                  {state.positions.filter(p => p.active || p.id === l.positionId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input className="col-span-4 sm:col-span-2" type="number" min={1} value={l.qty} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                <Select className="col-span-6 sm:col-span-3" value={l.shift} onChange={e => setLines(lines.map((x, j) => j === i ? { ...x, shift: e.target.value as Shift } : x))}>
                  {SHIFTS.map(s => <option key={s}>{s}</option>)}
                </Select>
                <button className="col-span-2 sm:col-span-1 text-slate-400 hover:text-rose-600 justify-self-center" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Hapus baris"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">Total {lines.reduce((n, l) => n + (l.qty || 0), 0)} orang. Sumber personel per baris diisi Recruitment saat cek.</p>
        </Card>

        <Card title="Lampiran">
          <div className="grid sm:grid-cols-2 gap-4">
            <FilePick label="BOQ yang dikirim ke klien (boleh lebih dari satu)" files={boq} multiple onAdd={n => setBoq([...boq, n])} onRemove={i => setBoq(boq.filter((_, j) => j !== i))} />
            <FilePick label="Bukti deal tertulis (email atau surat)" files={deal} onAdd={n => setDeal([...deal, n])} onRemove={i => setDeal(deal.filter((_, j) => j !== i))} />
          </div>
        </Card>

        {plan && (
          <Card title="Yang akan mereview ulang versi ini">
            <div className="flex items-start gap-2 text-sm">
              <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {plan.toBod ? 'Langsung ke BOD' : [...plan.divisions, ...(plan.finance ? ['Finance (cek margin)'] : [])].join(', ')}
                </p>
                <ul className="text-xs text-slate-600 mt-1 list-disc pl-4">{plan.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            </div>
          </Card>
        )}

        <ErrorText>{err}</ErrorText>
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="secondary" onClick={() => navigate(fpkId ? `/fpk/${fpkId}` : '/fpk')}>Batal</Btn>
          {mode === 'versi' ? (
            <Btn onClick={submitVersion}>Kirim versi {base!.no + 1}</Btn>
          ) : (
            <>
              <Btn variant="secondary" onClick={() => saveDraft(false)}>Simpan draf</Btn>
              <Btn onClick={() => saveDraft(true)}>Simpan & kirim ke cek</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
