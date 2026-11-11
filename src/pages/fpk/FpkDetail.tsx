import React, { useState } from 'react';
import { AlertTriangle, Pencil, Send, FilePlus2, Ban, Undo2, TrendingDown, Search, Timer } from 'lucide-react';
import { useStore } from '../../store/store';
import { AttachmentChip, Badge, Btn, Card, DL, Money, PageHeader, Table, Td, cx, toast } from '../../ui/kit';
import { ReasonModal } from '../../ui/ReasonModal';
import { Link, navigate } from '../../router';
import { NotFound } from '../Misc';
import { FPK_STATUS, FPK_TYPE, SOURCE_LABEL, SPK_STATUS } from '../../domain/labels';
import { fpkCoverage, latest, withoutSpkList } from '../../domain/selectors';
import { diffDays, fmtDate, fmtDateTime } from '../../domain/time';
import { settingNum } from '../../domain/settings';
import { has, isDeputy } from '../../domain/rbac';
import { FpkActionPanel } from './FpkActionPanel';
import { FpkPeople } from './FpkPeople';
import { CheckChips } from './FpkList';

const RESULT_LABEL: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' }> = {
  cocok: { label: 'Cocok', tone: 'green' },
  ada_perubahan: { label: 'Ada perubahan', tone: 'amber' },
  perlu_survei: { label: 'Perlu survei', tone: 'blue' },
  selesai: { label: 'Selesai', tone: 'green' },
  kembalikan: { label: 'Kembalikan', tone: 'amber' },
  tidak_layak: { label: 'Tidak layak', tone: 'red' },
};

const STEPS: { key: string; label: string }[] = [
  { key: 'draf', label: 'Draf' },
  { key: 'cek_divisi', label: 'Cek divisi' },
  { key: 'cek_margin', label: 'Cek margin' },
  { key: 'menunggu_bod', label: 'Menunggu BOD' },
  { key: 'disetujui', label: 'Disetujui' },
  { key: 'berjalan', label: 'Jalan, belum SPK' },
  { key: 'tertutup_sebagian', label: 'Sebagian SPK' },
  { key: 'selesai', label: 'SPK lengkap' },
];

export const FpkDetailPage: React.FC<{ id: string }> = ({ id }) => {
  const { state, lookups, access, me, actions } = useStore();
  const f = lookups.fpk.get(id);
  const [viewNo, setViewNo] = useState<number | null>(null);
  const [modal, setModal] = useState<'batal' | 'batal-draf' | null>(null);
  if (!f) return <NotFound what="FPK" />;
  const cur = latest(f);
  const site = lookups.site.get(cur.siteId);
  if (!site || !access.area(site.areaId)) return <NotFound what="FPK" />;
  const v = f.versions.find(x => x.no === (viewNo ?? cur.no)) ?? cur;
  const isOld = v.no !== cur.no;
  const client = lookups.client.get(v.clientId);
  const minMargin = settingNum(state.settings, 'margin.minimum_pct', 10);
  const lowMargin = v.estMarginPct !== undefined && v.estMarginPct < minMargin;
  const isOwner = !!client && (client.accountOwnerId === me.id || client.coOwnerIds.includes(me.id));
  const cov = fpkCoverage(f, state.spks);
  const spks = state.spks.filter(s => s.fpkId === f.id);
  const ws = withoutSpkList([f], state.spks, state.sites)[0];
  const stepIdx = STEPS.findIndex(s => s.key === f.status);
  const bodLike = has(me, 'BOD') || isDeputy(me, state.delegations);

  return (
    <div className="space-y-5">
      <PageHeader
        back="/fpk"
        title={f.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={FPK_STATUS[f.status].tone}>{FPK_STATUS[f.status].label}</Badge>
            <span>{FPK_TYPE[f.type]}</span>
            {f.parentFpkId && <span>· induk <Link to={`/fpk/${f.parentFpkId}`} className="text-indigo-700 hover:underline">{lookups.fpk.get(f.parentFpkId)?.number}</Link></span>}
            <span>· dibuat {lookups.user.get(f.createdBy)?.name}, {fmtDate(f.createdAt)}</span>
          </span>
        }
        actions={<>
          {f.status === 'draf' && isOwner && <>
            <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => navigate(`/fpk/${f.id}/ubah`)}>Ubah draf</Btn>
            <Btn size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={() => { const r = actions.submitFpk(f.id); if (r.ok) toast('Dikirim ke cek 3 divisi'); else toast(r.error, 'err'); }}>Kirim ke cek</Btn>
          </>}
          {f.status === 'dikembalikan' && isOwner && <Btn size="sm" icon={<FilePlus2 className="w-3.5 h-3.5" />} onClick={() => navigate(`/fpk/${f.id}/ubah`)}>Buat versi {cur.no + 1}</Btn>}
          {(f.status === 'draf' || f.status === 'dikembalikan') && f.createdBy === me.id && <Btn size="sm" variant="ghost" icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setModal('batal-draf')}>Batalkan draf</Btn>}
          {bodLike && !['selesai', 'ditolak', 'batal', 'draf'].includes(f.status) && <Btn size="sm" variant="secondary" icon={<Ban className="w-3.5 h-3.5" />} onClick={() => setModal('batal')}>Batalkan FPK</Btn>}
        </>}
      />

      {!['dikembalikan', 'ditolak', 'batal'].includes(f.status) && (
        <>
        {/* HP: cukup langkah saat ini, supaya tidak terpotong. */}
        <div className="sm:hidden">
          <div className="text-sm font-semibold text-slate-800">Langkah {stepIdx + 1} dari {STEPS.length}: {STEPS[stepIdx]?.label}</div>
          <div className="h-2 rounded-full bg-slate-100 mt-1.5 overflow-hidden"><div className="h-full bg-indigo-600" style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} /></div>
          {STEPS[stepIdx + 1] && <div className="text-xs text-slate-500 mt-1">Berikutnya: {STEPS[stepIdx + 1].label}</div>}
        </div>
        <div className="hidden sm:flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className={cx('flex-1 min-w-[88px] text-center text-[11px] font-semibold rounded-md py-1.5 border', i < stepIdx ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : i === stepIdx ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400')}>{s.label}</div>
          ))}
        </div>
        </>
      )}

      {f.returned && f.status === 'dikembalikan' && (
        <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
          <Undo2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Dikembalikan oleh <b>{f.returned.fromDivision}</b> ({lookups.user.get(f.returned.by)?.name}, {fmtDateTime(f.returned.at)}): {f.returned.reason}</span>
        </div>
      )}
      {f.cancelled && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3">Dibatalkan oleh {lookups.user.get(f.cancelled.by)?.name}: {f.cancelled.reason}</div>}
      {f.notFeasible && f.status !== 'menunggu_bod' && <div className="flex items-start gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3"><AlertTriangle className="w-4 h-4 mt-0.5" />Ditandai tidak layak oleh {f.notFeasible.division}: {f.notFeasible.reason}</div>}
      {f.surveyPending && <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3"><Search className="w-4 h-4" />Operasional sedang survei lokasi. Cek margin Finance menunggu hasil survei.</div>}
      {ws && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3">
          <Timer className="w-4 h-4" />
          <span>Jalan tanpa SPK <b>{ws.days} hari</b> sejak {fmtDate(ws.from)}. Nilai tertahan: <b><Money value={ws.held} clientId={v.clientId} /></b>.</span>
          <Link to="/jalan-tanpa-spk" className="font-semibold underline">Lihat daftar</Link>
        </div>
      )}

      {!isOld && <FpkActionPanel f={f} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <Card
            title={<span>Isi FPK {f.versions.length > 1 && <span className="font-normal text-slate-500">· versi {v.no}{isOld ? ' (versi lama, hanya baca)' : ' (terbaru)'}</span>}</span>}
            actions={f.versions.length > 1 && (
              <div className="flex gap-1">
                {f.versions.map(x => (
                  <button key={x.no} onClick={() => setViewNo(x.no)} className={cx('text-xs font-semibold px-2 py-1 rounded-md border', x.no === v.no ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600')}>v{x.no}</button>
                ))}
              </div>
            )}
          >
            <DL items={[
              ['Klien', <Link to={`/klien/${v.clientId}`} className="text-indigo-700 font-semibold hover:underline">{client?.name}</Link>],
              ['Site', <><Link to={`/site/${v.siteId}`} className="text-indigo-700 font-semibold hover:underline">{lookups.site.get(v.siteId)?.name}</Link> <span className="text-slate-500">· area {lookups.area.get(lookups.site.get(v.siteId)?.areaId ?? '')?.name}</span></>],
              ['Periode', `${fmtDate(v.periodStart)} – ${fmtDate(v.periodEnd)}`],
              ['Tanggal mulai rencana', fmtDate(v.plannedStart)],
              ['Mulai jaga', f.startedAt ? fmtDate(f.startedAt) : '–'],
              ['Nilai per bulan (sebelum PPN)', <Money value={v.monthlyValue} clientId={v.clientId} className="font-semibold" />],
              ['Estimasi biaya / margin', v.estCost === undefined ? 'Belum dicek Finance' : access.money(v.clientId)
                ? <span className={cx(lowMargin && 'text-rose-600 font-semibold')}><Money value={v.estCost} clientId={v.clientId} /> · {v.estMarginPct?.toLocaleString('id-ID')}%{lowMargin && <TrendingDown className="inline w-4 h-4 ml-1" />}</span>
                : <Money value={0} clientId={v.clientId} />],
            ]} />
          </Card>

          <Card title={`Baris jabatan (${v.lines.reduce((n, l) => n + l.qty, 0)} orang)`} pad={false}>
            <Table head={['Jabatan', 'Jumlah', 'Shift', 'Sumber personel', ...(spks.length ? ['Tertutup SPK'] : [])]}>
              {v.lines.map(l => {
                const c = cov.lines.find(x => x.line.id === l.id);
                return (
                  <tr key={l.id}>
                    <Td className="font-medium">{lookups.position.get(l.positionId)?.name}</Td>
                    <Td className="tabular-nums">{l.qty}</Td>
                    <Td>{l.shift}</Td>
                    <Td className="text-xs">
                      {l.sources.length ? l.sources.map((s, i) => (
                        <div key={i}>{s.qty} · {SOURCE_LABEL[s.kind]}{s.kind === 'mutasi' && ` dari ${lookups.area.get(s.fromAreaId ?? '')?.name}${s.fromSiteId ? ` (${lookups.site.get(s.fromSiteId)?.name})` : ''}`}</div>
                      )) : <span className="text-slate-400">Diisi Recruitment saat cek</span>}
                    </Td>
                    {spks.length > 0 && <Td><Badge tone={c && c.covered >= l.qty ? 'green' : c?.covered ? 'amber' : 'slate'}>{c?.covered ?? 0}/{l.qty}</Badge></Td>}
                  </tr>
                );
              })}
            </Table>
          </Card>

          <FpkPeople f={f} />

          {access.can('spk.view') && (
            <Card title={`SPK terkait (${spks.length})`} pad={false} actions={has(me, 'Marketing') && isOwner && ['berjalan', 'tertutup_sebagian', 'disetujui'].includes(f.status) && <Btn size="sm" onClick={() => navigate(`/spk/input?fpk=${f.id}`)}>Input SPK</Btn>}>
              <Table head={['Nomor', 'Status', 'Periode', 'Orang', 'Nilai/bulan']}>
                {spks.map(s => (
                  <tr key={s.id}>
                    <Td><Link to={`/spk/${s.id}`} className="font-semibold text-indigo-700 hover:underline">{s.number}</Link></Td>
                    <Td><Badge tone={SPK_STATUS[s.status].tone}>{SPK_STATUS[s.status].label}</Badge>{s.invoiceHeld && <Badge tone="red" className="ml-1">invoice ditahan</Badge>}</Td>
                    <Td className="text-xs whitespace-nowrap">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</Td>
                    <Td className="tabular-nums">{s.lines.reduce((n, l) => n + l.qty, 0)}</Td>
                    <Td><Money value={s.monthlyValue} clientId={s.clientId} /></Td>
                  </tr>
                ))}
              </Table>
              {spks.length === 0 && <p className="text-sm text-slate-500 p-4">Belum ada SPK.</p>}
              {spks.length > 0 && <p className="text-xs text-slate-500 px-4 py-3 border-t border-slate-100">Kuota tertutup SPK aktif: {cov.done} dari {cov.total} orang.</p>}
              {f.startedAt && spks.filter(s => s.type !== 'perpanjangan' && ['aktif', 'berakhir'].includes(s.status) && diffDays(f.startedAt!, s.periodStart) > 0).map(s => (
                <p key={s.id} className="text-xs text-amber-800 bg-amber-50 px-4 py-2 border-t border-amber-100">
                  {s.number}: {diffDays(f.startedAt!, s.periodStart)} hari tidak tertagih (mulai jaga {fmtDate(f.startedAt!)}, periode SPK mulai {fmtDate(s.periodStart)}).
                </p>
              ))}
            </Card>
          )}
        </div>

        <div className="space-y-5 min-w-0">
          <Card title="Status cek">
            <CheckChips f={f} labeled />
            {f.pendingDivisions.length > 0 && <p className="text-xs text-slate-600 mt-2">Menunggu: {f.pendingDivisions.join(', ')}</p>}
          </Card>
          <Card title="Lampiran">
            <div className="flex flex-col gap-1.5">
              {v.attachments.map(a => <AttachmentChip key={a.id} a={a} clientId={v.clientId} entity="fpk" entityId={f.id} />)}
              {!v.attachments.some(a => a.kind === 'Bukti deal') && <span className="text-xs text-rose-600">Bukti deal belum dilampirkan</span>}
            </div>
          </Card>
          <Card title="Riwayat cek" pad={false}>
            <div className="divide-y divide-slate-100">
              {[...f.reviews].reverse().map((r, i) => (
                <div key={i} className="px-4 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">v{r.versionNo} · {r.division}</span>
                    <Badge tone={RESULT_LABEL[r.result].tone}>{RESULT_LABEL[r.result].label}</Badge>
                  </div>
                  {r.note && <div className="text-slate-600 mt-1">{r.note}</div>}
                  {r.readyDate && <div className="text-slate-600 mt-1">Siap {fmtDate(r.readyDate)}</div>}
                  <div className="text-slate-400 mt-1">{lookups.user.get(r.actorId)?.name} · {fmtDateTime(r.at)}</div>
                </div>
              ))}
              {f.bodDecision && (
                <div className="px-4 py-2.5 text-xs bg-violet-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">BOD</span>
                    <Badge tone={f.bodDecision.decision === 'setujui' ? 'green' : f.bodDecision.decision === 'tolak' ? 'red' : 'amber'}>{f.bodDecision.decision}</Badge>
                  </div>
                  {f.bodDecision.note && <div className="text-slate-600 mt-1">{f.bodDecision.note}</div>}
                  <div className="text-slate-400 mt-1">{lookups.user.get(f.bodDecision.by)?.name}{f.bodDecision.onBehalfOf && ` atas nama ${lookups.user.get(f.bodDecision.onBehalfOf)?.name}`} · {fmtDateTime(f.bodDecision.at)}</div>
                </div>
              )}
              {f.reviews.length === 0 && !f.bodDecision && <p className="text-xs text-slate-500 p-4">Belum ada.</p>}
            </div>
          </Card>
        </div>
      </div>

      {modal === 'batal' && (
        <ReasonModal title={`Batalkan ${f.number}`} label="Alasan" confirm="Batalkan FPK" variant="danger"
          hint="Semua tugas terbuka dibatalkan. Bila personel sudah dikerahkan, tugas demobilisasi dibuat untuk Operasional dan HR."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.cancelFpk(f.id, t); if (r.ok) toast('FPK dibatalkan'); return r; }} />
      )}
      {modal === 'batal-draf' && (
        <ReasonModal title={`Batalkan ${f.number}`} label="Alasan" confirm="Batalkan draf" variant="danger"
          hint="FPK ditandai batal dan tetap tersimpan di riwayat. Tugas perbaikan yang terbuka ikut ditutup."
          onClose={() => setModal(null)} onSubmit={t => { const r = actions.cancelDraft(f.id, t); if (r.ok) toast('FPK dibatalkan'); return r; }} />
      )}
    </div>
  );
};
