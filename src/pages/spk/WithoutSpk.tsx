import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { Badge, Card, Money, PageHeader, Select, Stat, Table, Td, ExportBtn, exportCsv, DocLink } from '../../ui/kit';
import { Link } from '../../router';
import { withoutSpkList, lapsedSpkList, latest } from '../../domain/selectors';
import { SPK_STATUS } from '../../domain/labels';
import { fmtDate, fmtRp } from '../../domain/time';
import { settingNum } from '../../domain/settings';

export const WithoutSpkPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [area, setArea] = useState('');
  const [client, setClient] = useState('');
  const escalateAt = settingNum(state.settings, 'spk.without_spk_escalate_days', 30);
  const reminders = (state.settings.find(s => s.key === 'spk.chase_reminder_days')?.value ?? '7, 14, 21').split(',').map(x => parseInt(x, 10));
  const all = withoutSpkList(state.fpks, state.spks, state.sites).filter(x => x.site && access.area(x.site.areaId));
  const rows = all.filter(x => (!area || x.site?.areaId === area) && (!client || latest(x.fpk).clientId === client));
  const lapsed = lapsedSpkList(state.spks, state.sites).filter(x => x.site && access.area(x.site.areaId))
    .filter(x => (!area || x.site?.areaId === area) && (!client || x.spk.clientId === client));
  const seeAllMoney = rows.every(x => access.money(latest(x.fpk).clientId)) && lapsed.every(x => access.money(x.spk.clientId));
  const total = rows.reduce((n, x) => n + x.held, 0) + lapsed.reduce((n, x) => n + x.held, 0);

  return (
    <div>
      <PageHeader
        title="Daftar jalan tanpa SPK"
        subtitle="Site yang sudah dijaga tapi kuotanya belum (seluruhnya) tertutup SPK aktif. Dihitung dari mulai jaga sampai SPK aktif."
        actions={<ExportBtn onClick={() => exportCsv('jalan-tanpa-spk.csv', [['Klien', 'Site', 'Area', 'Marketing', 'Hari', 'Status SPK'], ...rows.map(x => { const v = latest(x.fpk); return [lookups.client.get(v.clientId)?.name ?? '', x.site?.name ?? '', lookups.area.get(x.site?.areaId ?? '')?.name ?? '', lookups.user.get(lookups.client.get(v.clientId)?.accountOwnerId ?? '')?.name ?? '', x.days, x.pendingSpk ? SPK_STATUS[x.pendingSpk.status].label : 'Belum ada']; })])} />}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Site jalan tanpa SPK" value={rows.length + lapsed.length} hint={lapsed.length ? `${lapsed.length} di antaranya SPK sudah berakhir` : undefined} />
        <Stat label="Lewat batas eskalasi BOD" value={rows.filter(x => x.days > escalateAt).length + lapsed.length} tone={rows.some(x => x.days > escalateAt) || lapsed.length ? 'red' : undefined} hint={`Hari ke-${escalateAt}`} />
        <Stat label="Total nilai tertahan" value={seeAllMoney ? fmtRp(total) : <Money value={0} />} hint="Nilai per bulan ÷ hari kalender bulan × hari, per bulan" />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Select value={area} onChange={e => setArea(e.target.value)} className="sm:w-48">
          <option value="">Semua area</option>
          {state.areas.filter(a => access.area(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select value={client} onChange={e => setClient(e.target.value)} className="sm:w-60">
          <option value="">Semua klien</option>
          {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <Card pad={false}>
        <Table head={['Klien / site', 'Area', 'Marketing', 'Sejak', 'Hari', 'Nilai tertahan', 'Status SPK']}>
          {rows.map(x => {
            const v = latest(x.fpk);
            const c = lookups.client.get(v.clientId);
            const next = reminders.find(r => r >= x.days);
            return (
              <tr key={x.fpk.id} className={x.days > escalateAt ? 'bg-rose-50/50' : ''}>
                <Td>
                  <div className="font-medium">{c?.name}</div>
                  <DocLink to={`/fpk/${x.fpk.id}`} className="text-xs text-indigo-700 hover:underline">{x.site?.name} · {x.fpk.number}</DocLink>
                </Td>
                <Td>{lookups.area.get(x.site?.areaId ?? '')?.name}</Td>
                <Td>{lookups.user.get(c?.accountOwnerId ?? '')?.name}</Td>
                <Td className="whitespace-nowrap">{fmtDate(x.from)}</Td>
                <Td>
                  <span className={x.days > escalateAt ? 'font-bold text-rose-600' : 'font-semibold'}>{x.days}</span>
                  <div className="text-[11px] text-slate-500">{x.days > escalateAt ? 'Eskalasi BOD' : next ? `Pengingat hari ke-${next}` : `BOD di hari ke-${escalateAt}`}</div>
                </Td>
                <Td><Money value={x.held} clientId={v.clientId} className="font-semibold" /></Td>
                <Td>
                  {x.pendingSpk
                    ? <DocLink to={`/spk/${x.pendingSpk.id}`}><Badge tone={SPK_STATUS[x.pendingSpk.status].tone}>{SPK_STATUS[x.pendingSpk.status].label}</Badge></DocLink>
                    : <Badge tone="red">Belum ada SPK</Badge>}
                  {x.fpk.status === 'tertutup_sebagian' && <div className="text-[11px] text-slate-500 mt-1">sebagian sudah tertutup</div>}
                </Td>
              </tr>
            );
          })}
        </Table>
        {rows.length === 0 && <p className="text-sm text-slate-500 p-4">Tidak ada site yang jalan tanpa SPK.</p>}
      </Card>

      {lapsed.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-slate-800 mb-1">SPK sudah berakhir, site masih dijaga</h2>
          <p className="text-xs text-slate-500 mb-3">Ditandai job harian sehari setelah periode SPK selesai. Langsung eskalasi BOD bila lewat 1 hari kerja. Keluar dari daftar saat SPK perpanjangan aktif atau personel ditarik.</p>
          <Card pad={false}>
            <Table head={['Klien / site', 'Area', 'Marketing', 'Sejak', 'Hari', 'Nilai tertahan', 'Status perpanjangan']}>
              {lapsed.map(x => {
                const c = lookups.client.get(x.spk.clientId);
                return (
                  <tr key={x.spk.id} className="bg-rose-50/50">
                    <Td>
                      <div className="font-medium">{c?.name}</div>
                      <DocLink to={`/spk/${x.spk.id}`} className="text-xs text-indigo-700 hover:underline">{x.site?.name} · {x.spk.number} (berakhir {fmtDate(x.spk.periodEnd)})</DocLink>
                    </Td>
                    <Td>{lookups.area.get(x.site?.areaId ?? '')?.name}</Td>
                    <Td>{lookups.user.get(c?.accountOwnerId ?? '')?.name}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(x.from)}</Td>
                    <Td><span className="font-bold text-rose-600">{x.days}</span></Td>
                    <Td><Money value={x.held} clientId={x.spk.clientId} className="font-semibold" /></Td>
                    <Td>
                      {x.pendingSpk
                        ? <DocLink to={`/spk/${x.pendingSpk.id}`}><Badge tone={SPK_STATUS[x.pendingSpk.status].tone}>{SPK_STATUS[x.pendingSpk.status].label}</Badge></DocLink>
                        : <Badge tone="red">Belum ada perpanjangan</Badge>}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
};
