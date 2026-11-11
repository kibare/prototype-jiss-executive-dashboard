import React from 'react';
import { useStore } from '../../store/store';
import { Badge, Card, Table, Td, Money, cx, DocLink } from '../../ui/kit';
import { Link } from '../../router';
import { FPK_STATUS, SPK_STATUS } from '../../domain/labels';
import { activeByPosition, effectiveSpks, latest, quotaByPosition, spkHeadcount } from '../../domain/selectors';
import { fmtDate } from '../../domain/time';
import type { Fpk, Spk } from '../../domain/types';

export const ActiveBadge: React.FC<{ active: boolean }> = ({ active }) =>
  active ? <Badge tone="green">Aktif</Badge> : <Badge tone="slate">Nonaktif</Badge>;

/** Security aktif per jabatan vs kuota SPK yang berlaku (PRD People in Act, layar 1). */
export const QuotaTable: React.FC<{ areaId: string; siteId?: string }> = ({ areaId, siteId }) => {
  const { state, lookups } = useStore();
  const siteIds = new Set(state.sites.filter(s => (siteId ? s.id === siteId : s.areaId === areaId)).map(s => s.id));
  const quota = quotaByPosition(state.spks, siteIds);
  const actual = activeByPosition(state.personnel, areaId, siteId);
  const posIds = [...new Set([...quota.keys(), ...actual.keys()])];
  const totalQ = [...quota.values()].reduce((a, b) => a + b, 0);
  const totalA = [...actual.values()].reduce((a, b) => a + b, 0);
  const diff = (a: number, q: number) => {
    const d = a - q;
    if (d === 0) return <Badge tone="green">Pas</Badge>;
    return d < 0 ? <Badge tone="red">Kurang {-d}</Badge> : <Badge tone="amber">Lebih {d}</Badge>;
  };
  return (
    <Card
      title={siteId ? 'Security aktif vs kuota SPK di site ini' : 'Security aktif vs total kuota SPK aktif di area'}
      pad={false}
    >
      <Table head={['Jabatan', 'Security aktif', 'Kuota SPK aktif', 'Selisih']}>
        {posIds.map(pid => (
          <tr key={pid}>
            <Td className="font-medium">{lookups.position.get(pid)?.name}</Td>
            <Td className="tabular-nums">{actual.get(pid) ?? 0}</Td>
            <Td className="tabular-nums">{quota.get(pid) ?? 0}</Td>
            <Td>{diff(actual.get(pid) ?? 0, quota.get(pid) ?? 0)}</Td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <Td>Total</Td>
          <Td className="tabular-nums">{totalA}</Td>
          <Td className="tabular-nums">{totalQ}</Td>
          <Td>{diff(totalA, totalQ)}</Td>
        </tr>
      </Table>
      <p className="text-[11px] text-slate-500 px-4 py-3 border-t border-slate-100">
        {siteId
          ? 'Hanya menghitung security yang site-nya diisi. HR saat ini mencatat personel per area, jadi angka per site bisa kurang lengkap.'
          : 'Batasan yang diketahui: kuota dihitung per area, jadi kekurangan di satu site bisa tertutup kelebihan di site lain pada area yang sama. Kelebihan biasanya berarti ada site yang masih jalan tanpa SPK.'}
      </p>
    </Card>
  );
};

export const FpkMiniTable: React.FC<{ fpks: Fpk[]; title?: string }> = ({ fpks, title = 'FPK berjalan' }) => {
  const { lookups } = useStore();
  return (
    <Card title={`${title} (${fpks.length})`} pad={false}>
      <Table head={['Nomor', 'Klien / site', 'Status', 'Mulai', 'Nilai/bulan']}>
        {fpks.map(f => {
          const v = latest(f);
          return (
            <tr key={f.id}>
              <Td><DocLink to={`/fpk/${f.id}`} className="font-semibold text-indigo-700 hover:underline">{f.number}</DocLink></Td>
              <Td>
                <div className="font-medium">{lookups.client.get(v.clientId)?.name}</div>
                <div className="text-xs text-slate-500">{lookups.site.get(v.siteId)?.name}</div>
              </Td>
              <Td><Badge tone={FPK_STATUS[f.status].tone}>{FPK_STATUS[f.status].label}</Badge></Td>
              <Td className="whitespace-nowrap">{fmtDate(f.startedAt ?? v.plannedStart)}</Td>
              <Td><Money value={v.monthlyValue} clientId={v.clientId} /></Td>
            </tr>
          );
        })}
      </Table>
      {fpks.length === 0 && <p className="text-sm text-slate-500 px-4 py-4">Tidak ada.</p>}
    </Card>
  );
};

export const SpkMiniTable: React.FC<{ spks: Spk[]; title?: string }> = ({ spks, title = 'SPK' }) => {
  const { lookups } = useStore();
  return (
    <Card title={`${title} (${spks.length})`} pad={false}>
      <Table head={['Nomor', 'Klien / site', 'Status', 'Periode', 'Orang', 'Nilai/bulan']}>
        {spks.map(s => (
          <tr key={s.id}>
            <Td>
              <DocLink to={`/spk/${s.id}`} className="font-semibold text-indigo-700 hover:underline whitespace-nowrap">{s.number}</DocLink>
              {s.isInitialData && <div><Badge tone="slate" className="mt-1">data awal</Badge></div>}
            </Td>
            <Td>
              <div className="font-medium">{lookups.client.get(s.clientId)?.name}</div>
              <div className="text-xs text-slate-500">{lookups.site.get(s.siteId)?.name}</div>
            </Td>
            <Td><Badge tone={SPK_STATUS[s.status].tone}>{SPK_STATUS[s.status].label}</Badge></Td>
            <Td className="whitespace-nowrap text-xs">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</Td>
            <Td className="tabular-nums">{spkHeadcount(s)}</Td>
            <Td><Money value={s.monthlyValue} clientId={s.clientId} /></Td>
          </tr>
        ))}
      </Table>
      {spks.length === 0 && <p className="text-sm text-slate-500 px-4 py-4">Tidak ada.</p>}
    </Card>
  );
};

export const RUNNING_FPK: Fpk['status'][] = ['cek_divisi', 'cek_margin', 'menunggu_bod', 'disetujui', 'berjalan', 'tertutup_sebagian', 'dikembalikan'];

export const runningIn = (state: { fpks: Fpk[]; spks: Spk[] }, siteIds: Set<string>) => {
  const fpks = state.fpks.filter(f => RUNNING_FPK.includes(f.status) && siteIds.has(latest(f).siteId));
  const effective = new Set(effectiveSpks(state.spks).map(s => s.id));
  const spks = state.spks.filter(s => siteIds.has(s.siteId) && (effective.has(s.id) || s.status === 'diinput' || s.status === 'perlu_revisi'));
  return { fpks, spks };
};

export const muted = (active: boolean) => cx(!active && 'opacity-60');
