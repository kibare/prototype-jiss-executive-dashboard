import React, { useState } from 'react';
import { Btn, ErrorText, Field, Select as Sel, Textarea, toast } from '../../ui/kit';
import { has } from '../../domain/rbac';
import { useStore } from '../../store/store';
import { Badge, Card, DL, PageHeader, SearchBox, Select, Table, Td, ExportBtn, exportCsv } from '../../ui/kit';
import { Link } from '../../router';
import { NotFound } from '../Misc';
import { PERSONNEL_STATUS } from '../../domain/labels';
import { currentPlacement } from '../../domain/selectors';
import { fmtDate } from '../../domain/time';
import type { PersonnelStatus } from '../../domain/types';

export const SecurityPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('');
  const rows = state.personnel
    .filter(p => { const pl = currentPlacement(p); return pl ? access.area(pl.areaId) : access.allAreas(); })
    .filter(p => (!area || currentPlacement(p)?.areaId === area) && (!status || p.status === status))
    .filter(p => `${p.employeeNo} ${p.name}`.toLowerCase().includes(q.toLowerCase()));
  const counts = (Object.keys(PERSONNEL_STATUS) as PersonnelStatus[]).map(k => [k, rows.filter(p => p.status === k).length] as const);

  return (
    <div>
      <PageHeader
        title="Daftar security"
        subtitle="Penempatan wajib sampai area; site opsional, karena HR mencatat personel per area. Hanya status aktif yang dihitung ke kuota."
        actions={<ExportBtn onClick={() => exportCsv('security.csv', [['No induk', 'Nama', 'Jabatan', 'Area', 'Site', 'Status', 'Seragam', 'Sepatu'], ...rows.map(p => { const pl = currentPlacement(p); return [p.employeeNo, p.name, lookups.position.get(p.positionId)?.name ?? '', lookups.area.get(pl?.areaId ?? '')?.name ?? '', lookups.site.get(pl?.siteId ?? '')?.name ?? '', PERSONNEL_STATUS[p.status].label, p.uniformSize, p.shoeSize]; })])} />}
      />
      <div className="flex flex-wrap gap-1.5 mb-3">
        {counts.filter(([, n]) => n > 0).map(([k, n]) => <Badge key={k} tone={PERSONNEL_STATUS[k].tone}>{PERSONNEL_STATUS[k].label}: {n}</Badge>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nomor induk atau nama" />
        <Select value={area} onChange={e => setArea(e.target.value)} className="sm:w-48">
          <option value="">Semua area</option>
          {state.areas.filter(a => access.area(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select value={status} onChange={e => setStatus(e.target.value)} className="sm:w-48">
          <option value="">Semua status</option>
          {(Object.keys(PERSONNEL_STATUS) as PersonnelStatus[]).map(k => <option key={k} value={k}>{PERSONNEL_STATUS[k].label}</option>)}
        </Select>
      </div>
      <Card pad={false}>
        <Table head={['No induk', 'Nama', 'Jabatan', 'Area / site', 'Status', 'Seragam / sepatu', 'Mulai penempatan']}>
          {rows.map(p => {
            const pl = currentPlacement(p);
            return (
              <tr key={p.id}>
                <Td className="font-mono text-xs">{p.employeeNo}</Td>
                <Td><Link to={`/security/${p.id}`} className="font-semibold text-indigo-700 hover:underline">{p.name}</Link></Td>
                <Td>{lookups.position.get(p.positionId)?.name}</Td>
                <Td>
                  <div>{lookups.area.get(pl?.areaId ?? '')?.name ?? '–'}</div>
                  <div className="text-xs text-slate-500">{lookups.site.get(pl?.siteId ?? '')?.name ?? 'site belum diisi'}</div>
                </Td>
                <Td><Badge tone={PERSONNEL_STATUS[p.status].tone}>{PERSONNEL_STATUS[p.status].label}</Badge></Td>
                <Td className="whitespace-nowrap">{p.uniformSize} / {p.shoeSize}</Td>
                <Td className="whitespace-nowrap">{fmtDate(pl?.start)}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
};

const StatusChanger: React.FC<{ personnelId: string; current: PersonnelStatus }> = ({ personnelId, current }) => {
  const { actions } = useStore();
  const opts: Record<PersonnelStatus, PersonnelStatus[]> = {
    calon: ['keluar'], terdaftar: ['standby', 'keluar'], standby: ['nonaktif_sementara', 'keluar'],
    aktif: ['nonaktif_sementara', 'standby', 'keluar'], nonaktif_sementara: ['aktif', 'standby', 'keluar'], dalam_mutasi: [], keluar: [],
  };
  const [to, setTo] = useState<PersonnelStatus | ''>('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  if (!opts[current].length) return <p className="text-xs text-slate-500">{current === 'dalam_mutasi' ? 'Personel sedang dalam mutasi dan dikunci.' : 'Status akhir.'}</p>;
  return (
    <div className="space-y-3">
      <Field label="Ubah status ke" required>
        <Sel value={to} onChange={e => setTo(e.target.value as PersonnelStatus)}>
          <option value="">– pilih –</option>
          {opts[current].map(k => <option key={k} value={k}>{PERSONNEL_STATUS[k].label}</option>)}
        </Sel>
      </Field>
      <Field label="Alasan" required hint="Contoh: cuti melahirkan, skorsing 7 hari, mengundurkan diri."><Textarea value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <ErrorText>{err}</ErrorText>
      <div className="flex justify-end">
        <Btn size="sm" disabled={!to} onClick={() => { const r = actions.setPersonnelStatus(personnelId, to as PersonnelStatus, reason); if (r.ok) { toast('Status diubah'); setTo(''); setReason(''); setErr(''); } else setErr(r.error); }}>Simpan</Btn>
      </div>
    </div>
  );
};

export const SecurityDetail: React.FC<{ id: string }> = ({ id }) => {
  const { lookups, access, me } = useStore();
  const p = lookups.personnel.get(id);
  const pl = p ? currentPlacement(p) : undefined;
  if (!p || (pl && !access.area(pl.areaId))) return <NotFound what="Security" />;
  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader back="/security" title={p.name} subtitle={<span className="font-mono text-xs">{p.employeeNo}</span>} />
      <Card>
        <DL items={[
          ['Jabatan', lookups.position.get(p.positionId)?.name],
          ['Status', <Badge tone={PERSONNEL_STATUS[p.status].tone}>{PERSONNEL_STATUS[p.status].label}</Badge>],
          ['Ukuran seragam', p.uniformSize],
          ['Ukuran sepatu', p.shoeSize],
          ['Area sekarang', lookups.area.get(pl?.areaId ?? '')?.name ?? '–'],
          ['Site sekarang', lookups.site.get(pl?.siteId ?? '')?.name ?? 'belum diisi'],
        ]} />
        <p className="text-[11px] text-slate-500 mt-3">Identitas lengkap (KTP, rekening, BPJS) tidak disimpan di sistem ini.</p>
      </Card>
      {has(me, 'HR') && <Card title="Ubah status (HR)"><StatusChanger personnelId={p.id} current={p.status} /></Card>}
      <Card title="Riwayat penempatan" pad={false}>
        <Table head={['Area', 'Site', 'FPK / SPK', 'Mulai', 'Selesai']}>
          {[...p.placements].reverse().map((x, i) => (
            <tr key={i}>
              <Td>{lookups.area.get(x.areaId)?.name}</Td>
              <Td>{lookups.site.get(x.siteId ?? '')?.name ?? '–'}</Td>
              <Td className="text-xs">
                {x.fpkId && access.can('fpk.view') ? <Link to={`/fpk/${x.fpkId}`} className="text-indigo-700 hover:underline">{lookups.fpk.get(x.fpkId)?.number}</Link> : x.fpkId ? lookups.fpk.get(x.fpkId)?.number : ''}
                {x.spkId && <div>{lookups.spk.get(x.spkId)?.number}</div>}
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(x.start)}</Td>
              <Td className="whitespace-nowrap">{x.end ? fmtDate(x.end) : 'sekarang'}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
};
