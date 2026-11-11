import React, { useState } from 'react';
import { CheckCircle2, XCircle, ThumbsUp, Lock, AlertTriangle, FileEdit, Receipt } from 'lucide-react';
import { useStore } from '../../store/store';
import { AttachmentChip, Badge, Btn, Card, DL, Money, PageHeader, Table, Td, cx, toast } from '../../ui/kit';
import { ReasonModal } from '../../ui/ReasonModal';
import { Link, navigate } from '../../router';
import { NotFound } from '../Misc';
import { SPK_STATUS, SPK_TYPE } from '../../domain/labels';
import { compareSpkFpk } from '../../domain/spk';
import { fpkCoverage, spkHeadcount } from '../../domain/selectors';
import { TODAY, diffDays, fmtDate, fmtRp } from '../../domain/time';
import { has } from '../../domain/rbac';

export const SpkDetailPage: React.FC<{ id: string }> = ({ id }) => {
  const { lookups, access, me, actions, state } = useStore();
  const [modal, setModal] = useState<'salah' | 'benar' | 'tagih' | null>(null);
  const s = lookups.spk.get(id);
  const site = s ? lookups.site.get(s.siteId) : undefined;
  if (!s || !site || !access.area(site.areaId)) return <NotFound what="SPK" />;
  const f = s.fpkId ? lookups.fpk.get(s.fpkId) : undefined;
  const client = lookups.client.get(s.clientId);
  const isOwner = !!client && (client.accountOwnerId === me.id || client.coOwnerIds.includes(me.id));
  const seeMoney = access.money(s.clientId);
  const diffs = f ? compareSpkFpk(s, f, {
    company: x => lookups.company.get(x)?.name ?? '–', site: x => lookups.site.get(x)?.name ?? '–', position: x => lookups.position.get(x)?.name ?? '–',
    date: fmtDate, rp: fmtRp,
  }) : [];
  const hasDiff = diffs.some(d => !d.same);
  const canVerify = s.status === 'diinput' && has(me, 'Finance');
  const selfInput = s.inputBy === me.id;
  const cov = f ? fpkCoverage(f, state.spks) : null;
  const daysRevision = s.verifiedAt ? diffDays(s.verifiedAt, TODAY) : 0;
  const parent = s.parentSpkId ? lookups.spk.get(s.parentSpkId) : undefined;

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
              <p className="text-sm text-slate-600 mb-3">{hasDiff ? 'Ada field yang beda dari FPK (ditandai merah di tabel perbandingan). Pilih apakah SPK-nya salah atau justru benar.' : 'Semua field sesuai FPK.'}</p>
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
          {f && (
            <Card title="Perbandingan dengan FPK" pad={false}>
              <Table head={['Field', 'SPK', 'FPK', '']}>
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
              ['PT', lookups.company.get(s.companyId)?.name],
              ['Periode', `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`],
              ...(s.effectiveDate ? [['Berlaku addendum', fmtDate(s.effectiveDate)] as [string, string]] : []),
              ['Nilai per bulan', <Money value={s.monthlyValue} clientId={s.clientId} className="font-semibold" />],
              ['FPK induk', f ? <Link to={`/fpk/${f.id}`} className="text-indigo-700 hover:underline">{f.number}</Link> : 'Tanpa FPK (data awal)'],
              ...(parent ? [['SPK induk', <Link to={`/spk/${parent.id}`} className="text-indigo-700 hover:underline">{parent.number}</Link>] as [string, React.ReactNode]] : []),
              ['Diverifikasi', s.verifiedBy ? `${lookups.user.get(s.verifiedBy)?.name}, ${fmtDate(s.verifiedAt)} (${s.verdict})` : 'Belum'],
              ...(f?.startedAt && s.status === 'aktif' && s.verifiedAt ? [['KPI menunggu SPK', `${diffDays(f.startedAt, s.verifiedAt)} hari sejak mulai jaga`] as [string, string]] : []),
            ]} />
          </Card>
          <Card title="Lampiran"><AttachmentChip a={s.pdf} clientId={s.clientId} /></Card>
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
