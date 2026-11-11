import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, DL, ErrorText, ExportBtn, Field, Input, Modal, PageHeader, SearchBox, Select, Table, Td, Textarea, exportCsv, runAction } from '../../ui/kit';
import { Link } from '../../router';
import { ActiveBadge, FpkMiniTable, SpkMiniTable, muted, runningIn } from './common';
import { NotFound } from '../Misc';
import { settingNum } from '../../domain/settings';
import type { Client, Division } from '../../domain/types';

export const ClientForm: React.FC<{ client: Client | null; onClose: () => void }> = ({ client, onClose }) => {
  const { state, actions } = useStore();
  const marketing = state.users.filter(u => u.active && u.roles.includes('Marketing'));
  const [f, setF] = useState<Client>(client ?? {
    id: '', code: '', name: '', accountOwnerId: '', coOwnerIds: [], billingAddress: '',
    termDays: settingNum(state.settings, 'client.payment_terms_days', 30), active: true,
  });
  const [err, setErr] = useState('');
  const save = () => runAction(actions.saveClient(f), client ? 'Klien disimpan' : 'Klien dibuat', setErr) && onClose();
  return (
    <Modal open title={client ? `Ubah klien ${client.code}` : 'Tambah klien'} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={save}>Simpan</Btn></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Kode" required><Input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Nama" required className="col-span-2"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <Field label="Account owner (Marketing)" required>
        <Select value={f.accountOwnerId} onChange={e => setF({ ...f, accountOwnerId: e.target.value, coOwnerIds: f.coOwnerIds.filter(x => x !== e.target.value) })}>
          <option value="">– pilih –</option>
          {marketing.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      {client && client.accountOwnerId !== f.accountOwnerId && f.accountOwnerId && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Pergantian account owner tercatat di audit log, langsung mengubah lingkup Marketing lama dan baru, dan keduanya diberi notifikasi.</p>
      )}
      <Field label="Co-owner" hint="Marketing yang ikut memegang klien ini dan boleh melihat nilai uangnya.">
        <div className="flex flex-wrap gap-3">
          {marketing.filter(u => u.id !== f.accountOwnerId).map(u => (
            <label key={u.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={f.coOwnerIds.includes(u.id)} onChange={e => setF({ ...f, coOwnerIds: e.target.checked ? [...f.coOwnerIds, u.id] : f.coOwnerIds.filter(x => x !== u.id) })} />
              {u.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Alamat penagihan" required hint="Nama klien di atas dipakai sebagai nama PT di invoice."><Textarea value={f.billingAddress} onChange={e => setF({ ...f, billingAddress: e.target.value })} /></Field>
      <Field label="NPWP klien" hint="Untuk invoice dan faktur pajak. Boleh diisi belakangan."><Input value={f.npwp ?? ''} onChange={e => setF({ ...f, npwp: e.target.value || undefined })} placeholder="00.000.000.0-000.000" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Termin bayar (hari kalender)" required><Input type="number" value={f.termDays} onChange={e => setF({ ...f, termDays: Number(e.target.value) })} /></Field>
        <Field label="Kontak PIC klien"><Input value={f.picContact ?? ''} onChange={e => setF({ ...f, picContact: e.target.value })} /></Field>
      </div>
      <Field label="Catatan"><Textarea value={f.note ?? ''} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Aktif</label>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

export const ClientsPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [edit, setEdit] = useState<Client | null | 'new'>(null);
  const editable = access.can('master.edit');
  const visibleSites = state.sites.filter(s => access.area(s.areaId));
  const rows = state.clients
    .filter(c => visibleSites.some(s => s.clientId === c.id) || access.allAreas())
    .filter(c => !area || state.sites.some(s => s.clientId === c.id && s.areaId === area))
    .filter(c => `${c.code} ${c.name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Klien"
        subtitle="Perusahaan yang membayar jasa. Satu klien bisa punya site di beberapa area."
        actions={<>
          <ExportBtn onClick={() => exportCsv('klien.csv', [['Kode', 'Nama', 'Account owner', 'Termin', 'Jumlah site', 'Status'], ...rows.map(c => [c.code, c.name, lookups.user.get(c.accountOwnerId)?.name ?? '', c.termDays, state.sites.filter(s => s.clientId === c.id).length, c.active ? 'Aktif' : 'Nonaktif'])])} />
          {editable && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEdit('new')}>Tambah klien</Btn>}
        </>}
      />
      {access.can('fpk.create') && (
        <p className="text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2 mb-3">Marketing membuat klien dan site baru langsung dari form FPK. Perubahan berikutnya oleh Admin sistem.</p>
      )}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <SearchBox value={q} onChange={setQ} placeholder="Cari kode atau nama klien" />
        <Select value={area} onChange={e => setArea(e.target.value)} className="sm:w-56">
          <option value="">Semua area</option>
          {state.areas.filter(a => access.area(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>
      <Card pad={false}>
        <Table head={['Kode', 'Nama', 'Account owner', 'Site per area', 'Termin', 'Status', '']}>
          {rows.map(c => {
            const sites = state.sites.filter(s => s.clientId === c.id);
            const areas = [...new Set(sites.map(s => s.areaId))];
            return (
              <tr key={c.id} className={muted(c.active)}>
                <Td className="font-mono text-xs">{c.code}</Td>
                <Td><Link to={`/klien/${c.id}`} className="font-semibold text-indigo-700 hover:underline">{c.name}</Link></Td>
                <Td>
                  <div>{lookups.user.get(c.accountOwnerId)?.name}</div>
                  {c.coOwnerIds.length > 0 && <div className="text-xs text-slate-500">Co-owner: {c.coOwnerIds.map(id => lookups.user.get(id)?.name).join(', ')}</div>}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {areas.map(aid => <Badge key={aid} tone="blue">{lookups.area.get(aid)?.name}: {sites.filter(s => s.areaId === aid).length}</Badge>)}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{c.termDays} hari</Td>
                <Td><ActiveBadge active={c.active} /></Td>
                <Td>{editable && <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(c)}>Ubah</Btn>}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {edit && <ClientForm client={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
};

const DIVS: Division[] = ['Operasional', 'Recruitment', 'Pengadaan', 'Finance'];

export const ClientDetail: React.FC<{ id: string }> = ({ id }) => {
  const { state, lookups, access } = useStore();
  const [edit, setEdit] = useState(false);
  const c = lookups.client.get(id);
  const sites = state.sites.filter(s => s.clientId === id && access.area(s.areaId));
  if (!c || (!sites.length && !access.allAreas())) return <NotFound what="Klien" />;
  const running = runningIn(state, new Set(sites.map(s => s.id)));
  const areas = [...new Set(sites.map(s => s.areaId))];
  const defaults = state.assignments.filter(a => a.clientId === id && !a.siteId);

  return (
    <div className="space-y-5">
      <PageHeader
        back="/klien"
        title={c.name}
        subtitle={<span className="font-mono text-xs">{c.code}</span>}
        actions={access.can('master.edit') && <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(true)}>Ubah</Btn>}
      />
      <Card>
        <DL items={[
          ['Account owner', lookups.user.get(c.accountOwnerId)?.name],
          ['Co-owner', c.coOwnerIds.map(x => lookups.user.get(x)?.name).join(', ') || '–'],
          ['Termin bayar', `${c.termDays} hari kalender`],
          ['Alamat penagihan', c.billingAddress],
          ['NPWP', c.npwp ?? '–'],
          ['Kontak PIC klien', c.picContact ?? '–'],
          ['Status', <ActiveBadge active={c.active} />],
        ]} />
      </Card>
      <Card title="Divisi terkait (default untuk semua site klien ini)" actions={<Link to="/admin/divisi-terkait" className="text-xs font-semibold text-indigo-600">Atur</Link>}>
        <DL items={DIVS.map(d => [d, lookups.user.get(defaults.find(x => x.division === d)?.userId ?? '')?.name ?? <span className="text-slate-400">Belum diisi, tugas jatuh ke kepala divisi</span>])} />
      </Card>
      <Card title={`Site per area (${sites.length})`} pad={false}>
        <Table head={['Area', 'Site', 'Alamat', 'Status']}>
          {areas.flatMap(aid => sites.filter(s => s.areaId === aid).map((s, i) => (
            <tr key={s.id} className={muted(s.active)}>
              <Td>{i === 0 && <Link to={`/area/${aid}`} className="font-semibold text-indigo-700 hover:underline">{lookups.area.get(aid)?.name}</Link>}</Td>
              <Td><Link to={`/site/${s.id}`} className="font-medium hover:underline">{s.name}</Link></Td>
              <Td className="text-xs text-slate-500">{s.address}</Td>
              <Td><ActiveBadge active={s.active} /></Td>
            </tr>
          )))}
        </Table>
      </Card>
      {access.can('fpk.view') && <FpkMiniTable fpks={running.fpks} />}
      {access.can('spk.view') && <SpkMiniTable spks={running.spks} title="SPK aktif dan dalam proses" />}
      {edit && <ClientForm client={c} onClose={() => setEdit(false)} />}
    </div>
  );
};
