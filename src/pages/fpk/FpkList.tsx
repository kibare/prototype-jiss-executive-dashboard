import React, { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, Money, PageHeader, SearchBox, Select, Table, Tabs, Td, ExportBtn, exportCsv } from '../../ui/kit';
import { Link, navigate } from '../../router';
import { FPK_STATUS, FPK_TYPE } from '../../domain/labels';
import { fpkHeadcount, latest } from '../../domain/selectors';
import { fmtDate } from '../../domain/time';
import { settingNum } from '../../domain/settings';
import type { Division, Fpk } from '../../domain/types';

const ACTIVE: Fpk['status'][] = ['draf', 'cek_divisi', 'cek_margin', 'menunggu_bod', 'dikembalikan', 'disetujui', 'berjalan', 'tertutup_sebagian'];

const RESULT_TEXT: Record<string, string> = { cocok: 'Cocok', ada_perubahan: 'Ada perubahan', selesai: 'Selesai', kembalikan: 'Dikembalikan', tidak_layak: 'Tidak layak' };

export const CheckChips: React.FC<{ f: Fpk; labeled?: boolean }> = ({ f, labeled }) => {
  const v = latest(f);
  const divs: Division[] = ['Operasional', 'Recruitment', 'Pengadaan', 'Finance'];
  if (f.status === 'draf') return <span className="text-xs text-slate-400">Belum dikirim</span>;
  if (labeled) {
    return (
      <ul className="space-y-1.5">
        {divs.map(d => {
          const r = [...f.reviews].reverse().find(x => x.versionNo === v.no && x.division === d);
          const pending = f.pendingDivisions.includes(d) || (d === 'Finance' && f.status === 'cek_margin');
          const [dot, txt] = r?.result === 'kembalikan' ? ['bg-amber-400', 'Dikembalikan'] : r?.result === 'tidak_layak' ? ['bg-rose-500', 'Tidak layak'] : r ? ['bg-emerald-500', RESULT_TEXT[r.result] ?? 'Selesai'] : pending ? ['bg-blue-400', 'Sedang dicek'] : ['bg-slate-300', 'Belum'];
          return (
            <li key={d} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${dot}`} />{d === 'Finance' ? 'Finance (margin)' : d}</span>
              <span className="text-slate-600">{txt}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="flex gap-1">
      {divs.map(d => {
        const r = [...f.reviews].reverse().find(x => x.versionNo === v.no && x.division === d);
        const pending = f.pendingDivisions.includes(d) || (d === 'Finance' && f.status === 'cek_margin');
        const tone = r?.result === 'kembalikan' ? 'bg-amber-400' : r?.result === 'tidak_layak' ? 'bg-rose-500' : r ? 'bg-emerald-500' : pending ? 'bg-blue-400 animate-pulse' : 'bg-slate-200';
        return <span key={d} title={`${d}: ${r ? r.result.replace('_', ' ') : pending ? 'sedang dicek' : 'belum'}`} className={`w-5 h-1.5 rounded-full ${tone}`} />;
      })}
    </div>
  );
};

export const FpkListPage: React.FC = () => {
  const { state, lookups, access, myTasks } = useStore();
  const [tab, setTab] = useState('aktif');
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const minMargin = settingNum(state.settings, 'margin.minimum_pct', 10);
  const mine = new Set(myTasks.filter(x => x.task.refType === 'fpk').map(x => x.task.refId));
  const visible = state.fpks.filter(f => {
    const s = lookups.site.get(latest(f).siteId);
    return s && access.area(s.areaId);
  });
  const rows = visible
    .filter(f => tab === 'saya' ? mine.has(f.id) : tab === 'aktif' ? ACTIVE.includes(f.status) : tab === 'arsip' ? !ACTIVE.includes(f.status) : true)
    .filter(f => !area || lookups.site.get(latest(f).siteId)?.areaId === area)
    .filter(f => `${f.number} ${lookups.client.get(latest(f).clientId)?.name} ${lookups.site.get(latest(f).siteId)?.name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="FPK"
        subtitle="Perintah kerja internal. Dicek tiga divisi sekaligus, lalu margin oleh Finance, lalu disetujui BOD."
        actions={<>
          <ExportBtn onClick={() => exportCsv('fpk.csv', [['Nomor', 'Jenis', 'Klien', 'Site', 'Status', 'Mulai', 'Orang'], ...rows.map(f => { const v = latest(f); return [f.number, FPK_TYPE[f.type], lookups.client.get(v.clientId)?.name ?? '', lookups.site.get(v.siteId)?.name ?? '', FPK_STATUS[f.status].label, fmtDate(f.startedAt ?? v.plannedStart), fpkHeadcount(f)]; })])} />
          {access.can('fpk.create') && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/fpk/baru')}>Buat FPK</Btn>}
        </>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'saya', label: `Perlu tindakan saya (${visible.filter(f => mine.has(f.id)).length})` },
        { key: 'aktif', label: 'Aktif' },
        { key: 'arsip', label: 'Selesai / ditolak / batal' },
        { key: 'semua', label: 'Semua' },
      ]} />
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nomor, klien, site" />
        <Select value={area} onChange={e => setArea(e.target.value)} className="sm:w-48">
          <option value="">Semua area</option>
          {state.areas.filter(a => access.area(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>
      <Card pad={false}>
        <Table head={['Nomor', 'Klien / site', 'Status', 'Cek (Ops·Rec·Peng·Fin)', 'Mulai', 'Orang', 'Nilai/bulan']}>
          {rows.map(f => {
            const v = latest(f);
            const low = v.estMarginPct !== undefined && v.estMarginPct < minMargin;
            return (
              <tr key={f.id} className="hover:bg-slate-50/60">
                <Td>
                  <Link to={`/fpk/${f.id}`} className="font-semibold text-indigo-700 hover:underline whitespace-nowrap">{f.number}</Link>
                  <div className="text-xs text-slate-500">{FPK_TYPE[f.type]}{f.versions.length > 1 ? ` · versi ${v.no}` : ''}</div>
                </Td>
                <Td>
                  <div className="font-medium">{lookups.client.get(v.clientId)?.name}</div>
                  <div className="text-xs text-slate-500">{lookups.site.get(v.siteId)?.name} · {lookups.area.get(lookups.site.get(v.siteId)?.areaId ?? '')?.name}</div>
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={FPK_STATUS[f.status].tone}>{FPK_STATUS[f.status].label}</Badge>
                    {f.notFeasible && <Badge tone="red"><AlertTriangle className="w-3 h-3" />Tidak layak</Badge>}
                    {low && access.money(v.clientId) && <Badge tone="red">Margin rendah</Badge>}
                    {mine.has(f.id) && <Badge tone="violet">Tindakan saya</Badge>}
                  </div>
                </Td>
                <Td><CheckChips f={f} /></Td>
                <Td className="whitespace-nowrap">{fmtDate(f.startedAt ?? v.plannedStart)}{f.startedAt && <div className="text-[11px] text-emerald-700">mulai jaga</div>}</Td>
                <Td className="tabular-nums">{fpkHeadcount(f)}</Td>
                <Td><Money value={v.monthlyValue} clientId={v.clientId} /></Td>
              </tr>
            );
          })}
        </Table>
        {rows.length === 0 && <p className="text-sm text-slate-500 p-4">Tidak ada FPK.</p>}
      </Card>
    </div>
  );
};
