import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, DL, ErrorText, ExportBtn, Field, Input, Modal, PageHeader, SearchBox, Select, Table, Td, Textarea, exportCsv, runAction } from '../../ui/kit';
import { Link } from '../../router';
import { ActiveBadge, FpkMiniTable, QuotaTable, SpkMiniTable, muted, runningIn } from './common';
import { NotFound } from '../Misc';
import type { Division, Site } from '../../domain/types';

export const SiteForm: React.FC<{ site: Site | null; onClose: () => void }> = ({ site, onClose }) => {
  const { state, actions } = useStore();
  const [f, setF] = useState<Site>(site ?? { id: '', code: '', name: '', address: '', clientId: '', areaId: '', active: true });
  const [err, setErr] = useState('');
  const save = () => runAction(actions.saveSite(f), site ? 'Site disimpan' : 'Site dibuat', setErr) && onClose();
  return (
    <Modal open title={site ? `Ubah site ${site.code}` : 'Tambah site'} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={save}>Simpan</Btn></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Kode" required><Input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Nama" required className="col-span-2"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Klien (siapa yang bayar)" required>
          <Select value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })}>
            <option value="">– pilih –</option>
            {state.clients.filter(c => c.active || c.id === f.clientId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Area (siapa yang mengurus)" required>
          <Select value={f.areaId} onChange={e => setF({ ...f, areaId: e.target.value })}>
            <option value="">– pilih –</option>
            {state.areas.filter(a => a.active || a.id === f.areaId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Alamat" required><Textarea value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
      <Field label="Catatan"><Input value={f.note ?? ''} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Aktif</label>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

export const SitesPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [client, setClient] = useState('');
  const [edit, setEdit] = useState<Site | null | 'new'>(null);
  const editable = access.can('master.edit');
  const rows = state.sites
    .filter(s => access.area(s.areaId))
    .filter(s => (!area || s.areaId === area) && (!client || s.clientId === client))
    .filter(s => `${s.code} ${s.name} ${lookups.client.get(s.clientId)?.name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Site"
        subtitle="Lokasi jaga. Setiap site milik satu klien dan diurus satu area."
        actions={<>
          <ExportBtn onClick={() => exportCsv('site.csv', [['Kode', 'Nama', 'Klien', 'Area', 'Alamat', 'Status'], ...rows.map(s => [s.code, s.name, lookups.client.get(s.clientId)?.name ?? '', lookups.area.get(s.areaId)?.name ?? '', s.address, s.active ? 'Aktif' : 'Nonaktif'])])} />
          {editable && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEdit('new')}>Tambah site</Btn>}
        </>}
      />
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <SearchBox value={q} onChange={setQ} placeholder="Cari site atau klien" />
        <Select value={area} onChange={e => setArea(e.target.value)} className="sm:w-48">
          <option value="">Semua area</option>
          {state.areas.filter(a => access.area(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select value={client} onChange={e => setClient(e.target.value)} className="sm:w-56">
          <option value="">Semua klien</option>
          {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <Card pad={false}>
        <Table head={['Kode', 'Site', 'Klien', 'Area', 'Status', '']}>
          {rows.map(s => (
            <tr key={s.id} className={muted(s.active)}>
              <Td className="font-mono text-xs">{s.code}</Td>
              <Td>
                <Link to={`/site/${s.id}`} className="font-semibold text-indigo-700 hover:underline">{s.name}</Link>
                <div className="text-xs text-slate-500">{s.address}</div>
              </Td>
              <Td><Link to={`/klien/${s.clientId}`} className="hover:underline">{lookups.client.get(s.clientId)?.name}</Link></Td>
              <Td><Link to={`/area/${s.areaId}`} className="hover:underline">{lookups.area.get(s.areaId)?.name}</Link></Td>
              <Td><ActiveBadge active={s.active} /></Td>
              <Td>{editable && <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(s)}>Ubah</Btn>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <SiteForm site={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
};

const DIVS: Division[] = ['Operasional', 'Recruitment', 'Pengadaan', 'Finance'];

export const SiteDetail: React.FC<{ id: string }> = ({ id }) => {
  const { state, lookups, access } = useStore();
  const [edit, setEdit] = useState(false);
  const s = lookups.site.get(id);
  if (!s || !access.area(s.areaId)) return <NotFound what="Site" />;
  const area = lookups.area.get(s.areaId);
  const client = lookups.client.get(s.clientId);
  const running = runningIn(state, new Set([s.id]));
  const assignee = (d: Division) => {
    const bySite = state.assignments.find(a => a.siteId === s.id && a.division === d);
    const byClient = state.assignments.find(a => a.clientId === s.clientId && !a.siteId && a.division === d);
    const head = state.users.find(u => u.headOf.includes(d));
    if (bySite) return <>{lookups.user.get(bySite.userId)?.name} <span className="text-xs text-slate-500">(khusus site ini)</span></>;
    if (byClient) return <>{lookups.user.get(byClient.userId)?.name} <span className="text-xs text-slate-500">(default klien)</span></>;
    return <>{head?.name ?? 'BOD'} <span className="text-xs text-slate-500">(kepala divisi, karena belum diisi)</span></>;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        back="/site"
        title={s.name}
        subtitle={<span className="font-mono text-xs">{s.code}</span>}
        actions={access.can('master.edit') && <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(true)}>Ubah</Btn>}
      />
      <Card>
        <DL items={[
          ['Klien (yang bayar)', <Link to={`/klien/${s.clientId}`} className="text-indigo-700 font-semibold hover:underline">{client?.name}</Link>],
          ['Area (yang mengurus)', <Link to={`/area/${s.areaId}`} className="text-indigo-700 font-semibold hover:underline">{area?.name}</Link>],
          ['Alamat', s.address],
          ['PIC area (AA)', lookups.user.get(area?.picUserId ?? '')?.name ?? 'Belum ada'],
          ['Status', <ActiveBadge active={s.active} />],
          ['Catatan', s.note ?? '–'],
        ]} />
      </Card>
      <Card title="Divisi terkait untuk site ini" actions={<Link to="/admin/divisi-terkait" className="text-xs font-semibold text-indigo-600">Atur</Link>}>
        <DL items={[
          ['Marketing (account owner)', lookups.user.get(client?.accountOwnerId ?? '')?.name],
          ...DIVS.map(d => [d, assignee(d)] as [string, React.ReactNode]),
        ]} />
      </Card>
      <QuotaTable areaId={s.areaId} siteId={s.id} />
      {access.can('fpk.view') && <FpkMiniTable fpks={running.fpks} />}
      {access.can('spk.view') && <SpkMiniTable spks={running.spks} title="SPK aktif dan dalam proses" />}
      {edit && <SiteForm site={s} onClose={() => setEdit(false)} />}
    </div>
  );
};
