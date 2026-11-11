import React, { useState } from 'react';
import { CheckCircle2, XCircle, ThumbsUp, Lock, AlertTriangle, FileEdit, Receipt } from 'lucide-react';
import { useStore } from '../../store/store';
import { AttachmentChip, Badge, Btn, Card, DL, Input, Money, PageHeader, Table, Td, cx, toast, DocLink } from '../../ui/kit';
import { ReasonModal } from '../../ui/ReasonModal';
import { Link, navigate } from '../../router';
import { NotFound } from '../Misc';
import { SPK_STATUS, SPK_TYPE } from '../../domain/labels';
import { compareSpkFpk, compareSpkParent } from '../../domain/spk';
import { MEMO_STATUS, MEMO_TYPE } from '../../domain/labels';
import { settingNum } from '../../domain/settings';
import { effectiveContractOn, fpkCoverage, spkHeadcount } from '../../domain/selectors';
import { TODAY, diffDays, fmtDate, fmtRp } from '../../domain/time';
import { has } from '../../domain/rbac';

export const SpkDetailPage: React.FC<{ id: string }> = ({ id }) => {
  const { lookups, access, me, actions, state } = useStore();
  const [modal, setModal] = useState<'salah' | 'benar' | 'tagih' | null>(null);
  const [asOf, setAsOf] = useState(TODAY);
  const s = lookups.spk.get(id);
  const site = s ? lookups.site.get(s.siteId) : undefined;
  if (!s || !site || !access.area(site.areaId)) return <NotFound what="SPK" />;
  const f = s.fpkId ? lookups.fpk.get(s.fpkId) : undefined;
  const client = lookups.client.get(s.clientId);
  const isOwner = !!client && (client.accountOwnerId === me.id || client.coOwnerIds.includes(me.id));
  const seeMoney = access.money(s.clientId);
  const names = {
    site: (x: string) => lookups.site.get(x)?.name ?? '–', position: (x: string) => lookups.position.get(x)?.name ?? '–',
    date: fmtDate, rp: fmtRp,
  };
  const parentForCompare = s.parentSpkId && (s.type === 'perpanjangan' || !f) ? lookups.spk.get(s.parentSpkId) : undefined;
  const agreedMemo = parentForCompare ? state.memos.find(m => m.spkId === parentForCompare.id && m.clientAnswer === 'setuju') : undefined;
  const memoV = agreedMemo?.versions[agreedMemo.versions.length - 1];
  const others = f ? fpkCoverage(f, state.spks.filter(x => x.id !== s.parentSpkId || s.type !== 'addendum'), s.id) : null;
  const coveredByOthers = new Map((others?.lines ?? []).map(x => [x.line.id, x.covered] as [string, number]));
  const diffs = f && s.type !== 'perpanjangan' ? compareSpkFpk(s, f, coveredByOthers, names)
    : parentForCompare ? compareSpkParent(s, parentForCompare, memoV ? { periodStart: memoV.periodStart, periodEnd: memoV.periodEnd, value: memoV.newValue } : undefined, names) : [];
  const memos = state.memos.filter(m => m.spkId === s.id);
  const openMemo = memos.find(m => m.status !== 'dijawab');
  const daysLeft = diffDays(TODAY, s.periodEnd);
  const memoWindow = daysLeft <= settingNum(state.settings, 'memo.start_days_before_end', 75);
  const hasDiff = diffs.some(d => !d.same);
  const canVerify = s.status === 'diinput' && has(me, 'Finance');
  const selfInput = s.inputBy === me.id;
  const cov = f ? fpkCoverage(f, state.spks) : null;
  const daysRevision = s.verifiedAt ? diffDays(s.verifiedAt, TODAY) : 0;
  const parent = s.parentSpkId ? lookups.spk.get(s.parentSpkId) : undefined;
  // Hari antara mulai jaga dan awal periode SPK tidak tertagih (perpanjangan tidak dihitung: mulai jaga milik SPK lama).
  const unbilled = f?.startedAt && s.type !== 'perpanjangan' ? Math.max(0, diffDays(f.startedAt, s.periodStart)) : 0;
  // Kontrak induk dan addendumnya: isi yang berlaku pada tanggal tertentu.
  const root = s.type === 'addendum' && parent ? parent : s;
  const addenda = state.spks.filter(x => x.type === 'addendum' && x.parentSpkId === root.id).sort((a, b) => (a.effectiveDate ?? a.periodStart).localeCompare(b.effectiveDate ?? b.periodStart));
  const contract = addenda.length ? effectiveContractOn(root, state.spks, asOf || TODAY) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        back="/spk"
        title={s.number}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <Badge tone={SPK_STATUS[s.status].tone}>{SPK_STATUS[s.status].label}</Badge>
          {s.invoiceHeld && <Badge tone="red"><Receipt className="w-3 h-3" />invoice ditahan</Badge>}
          {s.isInitialData && <Badge>data awal</Badge>}
          <span>{SPK_TYPE[s.type]} · diinput {lookups.user.get(s.inputBy)?.name}, {fmtDate(s.inputAt)}</span>
        </span>}
        actions={<>
          {s.status === 'perlu_revisi' && isOwner && has(me, 'Marketing') && <Btn size="sm" icon={<FileEdit className="w-3.5 h-3.5" />} onClick={() => navigate(`/spk/${s.id}/revisi`)}>Input revisi SPK</Btn>}
          {s.status === 'perlu_revisi' && s.invoiceHeld && has(me, 'BOD') && <Btn size="sm" variant="secondary" onClick={() => setModal('tagih')}>Tagih sesuai SPK dulu</Btn>}
          {s.status === 'aktif' && isOwner && has(me, 'Marketing') && !openMemo && memoWindow && <Btn size="sm" onClick={() => navigate(`/memo/baru?spk=${s.id}`)}>Buat memo (H-{daysLeft})</Btn>}
        </>}
      />

      {s.status === 'perlu_revisi' && (
        <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            SPK salah: {s.revisionReason} Marketing mengurus revisi ke klien ({daysRevision} hari sejak verifikasi).
            {daysRevision >= 14 ? ' Sudah lewat 14 hari: BOD turun tangan dan boleh memutuskan "tagih sesuai SPK dulu".' : ' Lewat 14 hari, BOD turun tangan.'}
          </span>
        </div>
      )}

      {canVerify && (
        <Card title="Verifikasi Finance">
          {selfInput ? (
            <p className="text-sm text-rose-700">Anda ikut menginput SPK ini; verifikasi harus oleh user Finance lain.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-3">{hasDiff ? `Ada field yang beda dari ${f ? 'FPK' : 'acuan'} (ditandai merah di tabel perbandingan). Pilih apakah SPK-nya salah atau justru benar.` : `Semua field sesuai ${f ? 'FPK' : 'SPK induk dan memo yang disetujui'}.`}</p>
              <div className="flex flex-wrap gap-2">
                <Btn variant="success" disabled={hasDiff} icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => { const r = actions.verifySpk(s.id, 'cocok', '', hasDiff); if (r.ok) toast('SPK aktif'); else toast(r.error, 'err'); }}>Cocok, aktifkan</Btn>
                {hasDiff && <>
                  <Btn variant="warning" icon={<XCircle className="w-4 h-4" />} onClick={() => setModal('salah')}>SPK salah</Btn>
                  <Btn icon={<ThumbsUp className="w-4 h-4" />} onClick={() => setModal('benar')}>SPK benar (jadi acuan)</Btn>
                </>}
              </div>
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {diffs.length > 0 && (
            <Card title={f && s.type !== 'perpanjangan' ? 'Perbandingan dengan FPK' : `Perbandingan dengan SPK induk ${parentForCompare?.number}${memoV ? ' dan memo yang disetujui klien' : ''}`} pad={false}>
              <Table head={['Field', 'SPK', f ? 'FPK' : 'Acuan', '']}>
                {diffs.map((d, i) => (
                  <tr key={i} className={cx(!d.same && 'bg-rose-50/60')}>
                    <Td className="font-medium text-xs">{d.field}</Td>
                    <Td className={cx('text-sm', !d.same && 'text-rose-700 font-semibold')}>{d.money && !seeMoney ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="w-3 h-3" />Terbatas</span> : d.spk}</Td>
                    <Td className="text-sm text-slate-600">{d.money && !seeMoney ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="w-3 h-3" />Terbatas</span> : d.fpk}</Td>
                    <Td>{d.same ? <Badge tone="green">Sama</Badge> : <Badge tone="red">Beda</Badge>}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          <Card title={`Baris SPK (${spkHeadcount(s)} orang)`} pad={false}>
            <Table head={['Jabatan', 'Jumlah', 'Shift', 'Menutup baris FPK']}>
              {s.lines.map(l => {
                const fl = f?.versions.flatMap(v => v.lines).find(x => x.id === l.fpkLineId);
                return (
                  <tr key={l.id}>
                    <Td className="font-medium">{lookups.position.get(l.positionId)?.name}</Td>
                    <Td className="tabular-nums">{l.qty}</Td>
                    <Td>{l.shift}</Td>
                    <Td className="text-xs">{fl ? `${lookups.position.get(fl.positionId)?.name} · ${fl.shift} · ${fl.qty} orang` : '–'}</Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
          {contract && (
            <Card title="Isi kontrak yang berlaku" actions={<Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-40" aria-label="Tanggal acuan" />}>
              <p className="text-sm text-slate-600 mb-3">
                Pada {fmtDate(asOf || TODAY)} yang berlaku: <DocLink to={`/spk/${contract.id}`} className="font-semibold text-indigo-700 hover:underline">{contract.number}</DocLink>
                {contract.type === 'addendum' ? ` (addendum, berlaku sejak ${fmtDate(contract.effectiveDate ?? contract.periodStart)})` : ' (SPK induk)'} · <Money value={contract.monthlyValue} clientId={contract.clientId} /> per bulan
              </p>
              <div className="text-sm mb-3">{contract.lines.map(l => `${l.qty} ${lookups.position.get(l.positionId)?.name} (${l.shift})`).join(', ')}</div>
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 space-y-1">
                <div>Riwayat: {root.number} mulai {fmtDate(root.periodStart)}</div>
                {addenda.map(a => <div key={a.id}><DocLink to={`/spk/${a.id}`} className="text-indigo-700 hover:underline">{a.number}</DocLink> berlaku {fmtDate(a.effectiveDate ?? a.periodStart)} · <Badge tone={SPK_STATUS[a.status].tone}>{SPK_STATUS[a.status].label}</Badge></div>)}
              </div>
            </Card>
          )}
          {cov && f && (
            <Card title={`Cakupan kuota ${f.number}`}>
              <p className="text-sm text-slate-600 mb-2">{cov.done} dari {cov.total} orang tertutup SPK aktif. {cov.done < cov.total ? 'Sisanya masih jalan tanpa SPK.' : 'FPK selesai otomatis.'}</p>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${cov.total ? (cov.done / cov.total) * 100 : 0}%` }} /></div>
            </Card>
          )}
        </div>
        <div className="space-y-5 min-w-0">
          <Card title="Data SPK">
            <DL items={[
              ['Klien', <Link to={`/klien/${s.clientId}`} className="text-indigo-700 font-semibold hover:underline">{client?.name}</Link>],
              ['Site', <Link to={`/site/${s.siteId}`} className="text-indigo-700 font-semibold hover:underline">{site.name}</Link>],
              ['Ditagihkan ke', <span>{client?.name}{client?.npwp ? <span className="text-slate-500"> · NPWP {client.npwp}</span> : null}</span>],
              ['Periode', `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`],
              ...(s.effectiveDate ? [['Berlaku addendum', fmtDate(s.effectiveDate)] as [string, string]] : []),
              ['Nilai per bulan (sebelum PPN)', <Money value={s.monthlyValue} clientId={s.clientId} className="font-semibold" />],
              ['FPK induk', f ? <DocLink to={`/fpk/${f.id}`} className="text-indigo-700 hover:underline">{f.number}</DocLink> : 'Tanpa FPK (data awal)'],
              ...(parent ? [['SPK induk', <DocLink to={`/spk/${parent.id}`} className="text-indigo-700 hover:underline">{parent.number}</DocLink>] as [string, React.ReactNode]] : []),
              ['Diverifikasi', s.verifiedBy ? `${lookups.user.get(s.verifiedBy)?.name}, ${fmtDate(s.verifiedAt)} (${s.verdict})` : 'Belum'],
              ...(unbilled ? [['Hari tidak tertagih', <span className="text-amber-700 font-semibold">{unbilled} hari (mulai jaga {fmtDate(f!.startedAt!)}, periode SPK mulai {fmtDate(s.periodStart)})</span>] as [string, React.ReactNode]] : []),
              ...(s.lapsedFrom ? [['Jalan tanpa SPK', <span className="text-rose-700 font-semibold">sejak {fmtDate(s.lapsedFrom)} (SPK berakhir, site masih dijaga)</span>] as [string, React.ReactNode]] : []),
              ...(f?.startedAt && s.status === 'aktif' && s.verifiedAt ? [['KPI menunggu SPK', `${diffDays(f.startedAt, s.verifiedAt)} hari sejak mulai jaga`] as [string, string]] : []),
            ]} />
          </Card>
          <Card title="Lampiran"><AttachmentChip a={s.pdf} clientId={s.clientId} entity="spk" entityId={s.id} /></Card>
          {access.can('memo.view') && (
            <Card title={`Memo eksternal (${memos.length})`}>
              <div className="space-y-2">
                {memos.map(m => (
                  <Link key={m.id} to={`/memo/${m.id}`} className="block text-sm hover:underline">
                    <span className="font-semibold text-indigo-700">{m.number ?? 'Draf memo'}</span> · {MEMO_TYPE[m.type]} <Badge tone={MEMO_STATUS[m.status].tone} className="ml-1">{MEMO_STATUS[m.status].label}</Badge>
                  </Link>
                ))}
                {memos.length === 0 && <p className="text-xs text-slate-500">{s.status === 'aktif' ? (memoWindow ? 'Sudah masuk H-75, memo belum dibuat.' : `Tugas memo muncul di H-75 (${fmtDate(new Date(Date.parse(s.periodEnd) - 75 * 864e5).toISOString().slice(0, 10))}).`) : 'Tidak ada.'}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>

      {modal === 'salah' && (
        <ReasonModal title="SPK salah" label="Apa yang salah" confirm="Tandai perlu revisi" variant="warning"
          hint="SPK berstatus perlu revisi dengan label invoice ditahan. Marketing mendapat tugas mengurus ke klien; lewat 14 hari BOD turun tangan."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.verifySpk(s.id, 'salah', t, hasDiff); if (r.ok) toast('SPK perlu revisi'); return r; }} />
      )}
      {modal === 'benar' && (
        <ReasonModal title="SPK benar, jadi acuan" label="Alasan" confirm="Aktifkan SPK" variant="primary"
          hint="SPK langsung aktif. Sistem membuat FPK perubahan dari isi SPK sebagai tugas penyesuaian untuk divisi terdampak. Bila margin jadi di bawah minimum, BOD mendapat tugas; aktivasi tidak menunggu keputusan itu."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.verifySpk(s.id, 'benar', t, hasDiff); if (r.ok) toast('SPK aktif, FPK perubahan dibuat'); return r; }} />
      )}
      {modal === 'tagih' && (
        <ReasonModal title="Tagih sesuai SPK dulu" label="Catatan" confirm="Putuskan" required={false}
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.billAsIs(s.id, t); if (r.ok) toast('Invoice tidak lagi ditahan'); return r; }} />
      )}
    </div>
  );
};
