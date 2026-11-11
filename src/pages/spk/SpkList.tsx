import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, Money, PageHeader, SearchBox, Select, Table, Tabs, Td, ExportBtn, exportCsv, DocLink } from '../../ui/kit';
import { Link, navigate } from '../../router';
import { SPK_STATUS, SPK_TYPE } from '../../domain/labels';
import { effectiveSpks, spkHeadcount } from '../../domain/selectors';
import { fmtDate, diffDays, TODAY } from '../../domain/time';
import { settingNum } from '../../domain/settings';

export const SpkListPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [tab, setTab] = useState('aktif');
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const memoStart = settingNum(state.settings, 'memo.start_days_before_end', 75);
  const effective = new Set(effectiveSpks(state.spks).map(s => s.id));
  const visible = state.spks.filter(s => access.area(lookups.site.get(s.siteId)?.areaId ?? ''));
  const count = (st: string) => visible.filter(s => s.status === st).length;
  const rows = visible
    .filter(s => tab === 'semua' || s.status === tab)
    .filter(s => !area || lookups.site.get(s.siteId)?.areaId === area)
    .filter(s => `${s.number} ${lookups.client.get(s.clientId)?.name} ${lookups.site.get(s.siteId)?.name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="SPK"
        subtitle="Kontrak resmi dari klien. Dicek Finance terhadap FPK sebelum jadi acuan."
        actions={<>
          <ExportBtn onClick={() => exportCsv('spk.csv', [['Nomor', 'Jenis', 'Klien', 'Site', 'Status', 'Mulai', 'Selesai', 'Orang'], ...rows.map(s => [s.number, SPK_TYPE[s.type], lookups.client.get(s.clientId)?.name ?? '', lookups.site.get(s.siteId)?.name ?? '', SPK_STATUS[s.status].label, fmtDate(s.periodStart), fmtDate(s.periodEnd), spkHeadcount(s)])])} />
          {access.can('spk.input') && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/spk/input')}>Input SPK</Btn>}
        </>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'diinput', label: `Menunggu verifikasi (${count('diinput')})` },
        { key: 'aktif', label: `Aktif (${count('aktif')})` },
        { key: 'perlu_revisi', label: `Perlu revisi (${count('perlu_revisi')})` },
        { key: 'berakhir', label: 'Berakhir' },
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
        <Table head={['Nomor', 'Klien / site', 'Status', 'Periode', 'Orang', 'Nilai/bulan', 'FPK induk']}>
          {rows.map(s => {
            const left = diffDays(TODAY, s.periodEnd);
            return (
              <tr key={s.id}>
                <Td>
                  <DocLink to={`/spk/${s.id}`} className="font-semibold text-indigo-700 hover:underline whitespace-nowrap">{s.number}</DocLink>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs text-slate-500">{SPK_TYPE[s.type]}</span>
                    {s.isInitialData && <Badge>data awal</Badge>}
                  </div>
                </Td>
                <Td>
                  <div className="font-medium">{lookups.client.get(s.clientId)?.name}</div>
                  <div className="text-xs text-slate-500">{lookups.site.get(s.siteId)?.name} · {lookups.area.get(lookups.site.get(s.siteId)?.areaId ?? '')?.name}</div>
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={SPK_STATUS[s.status].tone}>{SPK_STATUS[s.status].label}</Badge>
                    {s.invoiceHeld && <Badge tone="red">invoice ditahan</Badge>}
                    {s.status === 'aktif' && effective.has(s.id) && left <= memoStart && <Badge tone="amber">Habis {left} hari lagi</Badge>}
                  </div>
                </Td>
                <Td className="text-xs whitespace-nowrap">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</Td>
                <Td className="tabular-nums">{spkHeadcount(s)}</Td>
                <Td><Money value={s.monthlyValue} clientId={s.clientId} /></Td>
                <Td>{s.fpkId ? <DocLink to={`/fpk/${s.fpkId}`} className="text-indigo-700 hover:underline text-xs">{lookups.fpk.get(s.fpkId)?.number}</DocLink> : <span className="text-xs text-slate-400">tanpa FPK (data awal)</span>}</Td>
              </tr>
            );
          })}
        </Table>
        {rows.length === 0 && <p className="text-sm text-slate-500 p-4">Tidak ada SPK.</p>}
      </Card>
    </div>
  );
};
