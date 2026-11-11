import React, { useState } from 'react';
import { CheckCircle2, Circle, UserPlus, ArrowRightLeft } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, ErrorText, Input, Select, cx, toast, DateInput } from '../../ui/kit';
import { latest, currentPlacement } from '../../domain/selectors';
import { PERSONNEL_STATUS } from '../../domain/labels';
import { fmtDate } from '../../domain/time';
import { has } from '../../domain/rbac';
import type { Fpk } from '../../domain/types';
import { mutationSources } from '../../store/fpkActions';

const Step: React.FC<{ done: boolean; title: string; note?: React.ReactNode; children?: React.ReactNode }> = ({ done, title, note, children }) => (
  <div className="flex gap-3">
    {done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
    <div className="flex-1 min-w-0">
      <div className={cx('text-sm font-semibold', done ? 'text-slate-700' : 'text-slate-900')}>{title}</div>
      {note && <div className="text-xs text-slate-500 mt-0.5">{note}</div>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  </div>
);

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

type Src = ReturnType<typeof mutationSources>[number];

/** Satu sumber mutasi: Ops asal melepas, HR ubah penempatan, atau batal + tindak lanjut HR. */
const MutationStep: React.FC<{ f: Fpk; src: Src }> = ({ f, src }) => {
  const { state, lookups, me, actions } = useStore();
  const v = latest(f);
  const m = f.mutations?.[src.key];
  const [pick, setPick] = useState<string[]>([]);
  const [eff, setEff] = useState(v.plannedStart);
  const [err, setErr] = useState('');
  const run = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) { toast(msg); setErr(''); } else setErr(r.error ?? 'Gagal'); };
  const pool = state.personnel.filter(p => {
    const pl = currentPlacement(p);
    return p.status === 'aktif' && pl?.areaId === src.fromAreaId && (!src.fromSiteId || pl?.siteId === src.fromSiteId);
  });
  const restoreOpen = !!m?.cancelled && !m.restored;
  return (
    <Step
      done={!!m?.placed || !!m?.restored}
      title={`Mutasi ${src.qty} ${lookups.position.get(src.positionId)?.name ?? 'personel'} dari ${lookups.area.get(src.fromAreaId!)?.name}${src.fromSiteId ? ` (${lookups.site.get(src.fromSiteId)?.name})` : ''}`}
      note={m?.restored ? 'Mutasi dibatalkan; HR sudah menindaklanjuti.' : m?.cancelled ? 'Mutasi dibatalkan; HR mengembalikan penempatan asal atau menjadikan standby.' : m?.placed ? 'Penempatan sudah diubah HR.' : m ? `Dilepas Operasional asal, efektif ${fmtDate(m.effectiveDate)}. Menunggu HR ubah penempatan.` : 'Menunggu Operasional area asal memilih nama yang dilepas.'}
    >
      {!m && f.status === 'disetujui' && has(me, 'Operasional') && me.areaIds.includes(src.fromAreaId!) && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-1.5">
          <p className="text-xs text-slate-500">Personel yang sedang dalam mutasi lain tidak muncul di daftar.</p>
          {pool.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pick.includes(p.id)} onChange={e => setPick(e.target.checked ? [...pick, p.id] : pick.filter(x => x !== p.id))} />
              {p.name} · {lookups.position.get(p.positionId)?.name} · {lookups.site.get(currentPlacement(p)?.siteId ?? '')?.name}
            </label>
          ))}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <span className="text-xs text-slate-600">Tanggal efektif</span>
            <DateInput value={eff} onChange={e => setEff(e.target.value)} className="w-40" />
            <Btn size="sm" icon={<ArrowRightLeft className="w-3.5 h-3.5" />} onClick={() => run(actions.releaseForMutation(f.id, src.key, pick, eff), 'Personel dilepas untuk mutasi')}>Lepas ({pick.length}/{src.qty})</Btn>
          </div>
        </div>
      )}
      {restoreOpen && has(me, 'HR') && (
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" onClick={() => run(actions.restoreMutation(f.id, src.key, 'kembali'), 'Personel kembali ke penempatan asal')}>Kembalikan ke penempatan asal</Btn>
          <Btn size="sm" variant="secondary" onClick={() => run(actions.restoreMutation(f.id, src.key, 'standby'), 'Personel dijadikan standby')}>Jadikan standby</Btn>
        </div>
      )}
      {m && !m.placed && !m.cancelled && (
        <div className="flex flex-wrap gap-2">
          {has(me, 'HR') && <Btn size="sm" onClick={() => run(actions.placeMutation(f.id, src.key), 'Penempatan diubah')}>Ubah penempatan</Btn>}
          {has(me, 'Operasional') && <Btn size="sm" variant="secondary" onClick={() => run(actions.cancelMutation(f.id, src.key), 'Mutasi dibatalkan')}>Batalkan mutasi</Btn>}
        </div>
      )}
      <div className="mt-2"><ErrorText>{err}</ErrorText></div>
    </Step>
  );
};

/** Persiapan personel setelah FPK disetujui: serah ke HR, terdaftar, standby, mutasi. */
export const FpkPeople: React.FC<{ f: Fpk }> = ({ f }) => {
  const { state, lookups, me, actions } = useStore();
  const v = latest(f);
  const sources = v.lines.flatMap(l => l.sources.map(s => ({ ...s, positionId: l.positionId })));
  const rekrut = sources.filter(s => s.kind === 'rekrut' || s.kind === 'takeover');
  const rekrutN = rekrut.reduce((n, s) => n + s.qty, 0);
  const standbyN = sources.filter(s => s.kind === 'standby').reduce((n, s) => n + s.qty, 0);
  const linked = state.personnel.filter(p => p.placements.some(pl => pl.fpkId === f.id && !pl.end));
  const placedStandby = !state.tasks.some(t => t.refId === f.id && t.kind === 'ubah_penempatan' && t.title.includes('standby') && t.status === 'terbuka');

  const [rows, setRows] = useState(() => rekrut.flatMap(s => Array.from({ length: s.qty }, () => ({ name: '', positionId: s.positionId, uniformSize: '', shoeSize: 0 }))));
  const [pickStandby, setPickStandby] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const run = (r: { ok: boolean; error?: string }, msg: string) => { if (r.ok) { toast(msg); setErr(''); } else setErr(r.error ?? 'Gagal'); };

  if (!['disetujui', 'berjalan', 'tertutup_sebagian', 'selesai'].includes(f.status)) return null;
  const started = !!f.startedAt;
  const standbyPool = state.personnel.filter(p => p.status === 'standby' && !p.placements.some(pl => pl.fpkId === f.id && !pl.end));

  return (
    <Card title="Persiapan personel">
      <div className="space-y-4">
        {rekrutN > 0 && (
          <Step done={!!f.handedToHr} title={`Recruitment serahkan ${rekrutN} calon ke HR`} note={f.handedToHr ? 'Sudah diserahkan.' : `Batas H-1 tanggal mulai (${fmtDate(v.plannedStart)}).`}>
            {!f.handedToHr && f.status === 'disetujui' && has(me, 'Recruitment') && (
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-500">Isi template. Baris tanpa ukuran seragam atau sepatu ditolak. Identitas lengkap (KTP, rekening, BPJS) tidak disimpan.</p>
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-12 sm:col-span-5" placeholder={`Nama calon ${i + 1}`} value={r.name} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <div className="col-span-4 sm:col-span-3 text-xs text-slate-600 self-center truncate">{lookups.position.get(r.positionId)?.name}</div>
                    <Select className="col-span-4 sm:col-span-2" value={r.uniformSize} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, uniformSize: e.target.value } : x))}>
                      <option value="">Seragam</option>
                      {SIZES.map(s => <option key={s}>{s}</option>)}
                    </Select>
                    <Input className="col-span-4 sm:col-span-2" type="number" placeholder="Sepatu" value={r.shoeSize || ''} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, shoeSize: Number(e.target.value) } : x))} />
                  </div>
                ))}
                <div className="flex justify-end"><Btn size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => run(actions.handOverToHr(f.id, rows), 'Diserahkan ke HR')}>Serahkan ke HR</Btn></div>
              </div>
            )}
          </Step>
        )}
        {rekrutN > 0 && (
          <Step done={!!f.registered} title="HR tandai terdaftar" note={f.registered ? 'Sudah terdaftar.' : f.handedToHr ? 'Menunggu HR.' : 'Menunggu serah dari Recruitment.'}>
            {f.handedToHr && !f.registered && has(me, 'HR') && (
              <Btn size="sm" onClick={() => run(actions.registerPersonnel(f.id), 'Personel ditandai terdaftar')}>Tandai terdaftar</Btn>
            )}
          </Step>
        )}
        {standbyN > 0 && (
          <Step done={placedStandby} title={`HR tempatkan ${standbyN} personel standby`} note={placedStandby ? 'Sudah ditempatkan.' : 'Pilih dari daftar personel standby.'}>
            {!placedStandby && f.status === 'disetujui' && has(me, 'HR') && (
              <div className="border border-slate-200 rounded-lg p-3 space-y-1.5">
                {standbyPool.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pickStandby.includes(p.id)} onChange={e => setPickStandby(e.target.checked ? [...pickStandby, p.id] : pickStandby.filter(x => x !== p.id))} />
                    {p.name} · {lookups.position.get(p.positionId)?.name} · {lookups.area.get(currentPlacement(p)?.areaId ?? '')?.name ?? 'tanpa area'}
                  </label>
                ))}
                <div className="flex justify-end"><Btn size="sm" onClick={() => run(actions.placeStandby(f.id, pickStandby), 'Personel standby ditempatkan')}>Tempatkan ({pickStandby.length}/{standbyN})</Btn></div>
              </div>
            )}
          </Step>
        )}
        {mutationSources(v).map(src => <MutationStep key={src.key} f={f} src={src} />)}
        <Step done={started} title="Mulai jaga (PIC area)" note={started ? `Dikonfirmasi ${fmtDate(f.startedAt)}.` : `Rencana ${fmtDate(v.plannedStart)}.`} />
        <ErrorText>{err}</ErrorText>
        {linked.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold text-slate-500 mb-2">Personel tercantum ({linked.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {linked.map(p => <Badge key={p.id} tone={PERSONNEL_STATUS[p.status].tone}>{p.name} · {PERSONNEL_STATUS[p.status].label}</Badge>)}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
