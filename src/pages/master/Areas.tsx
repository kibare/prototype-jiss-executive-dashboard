import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, DL, ErrorText, ExportBtn, Field, Input, Modal, PageHeader, SearchBox, Select, Table, Td, Textarea, exportCsv, runAction, Badge } from '../../ui/kit';
import { Link } from '../../router';
import { ActiveBadge, FpkMiniTable, QuotaTable, SpkMiniTable, muted, runningIn } from './common';
import { NotFound } from '../Misc';
import { activeByPosition, quotaByPosition } from '../../domain/selectors';
import type { Area } from '../../domain/types';

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

export const AreaForm: React.FC<{ area: Area | null; onClose: () => void }> = ({ area, onClose }) => {
  const { state, actions } = useStore();
  const [f, setF] = useState<Area>(area ?? { id: '', code: '', name: '', active: true });
  const [err, setErr] = useState('');
  const pics = state.users.filter(u => u.active && u.roles.includes('PIC Area'));
  const save = () => runAction(actions.saveArea(f), area ? 'Area disimpan' : 'Area dibuat', setErr) && onClose();
  return (
    <Modal open title={area ? `Ubah area ${area.code}` : 'Tambah area'} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={save}>Simpan</Btn></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kode" required><Input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="AR-XXX" /></Field>
        <Field label="Nama" required><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIC area utama">
          <Select value={f.picUserId ?? ''} onChange={e => setF({ ...f, picUserId: e.target.value || undefined })}>
            <option value="">– belum ada –</option>
            {pics.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
        <Field label="PIC area cadangan">
          <Select value={f.backupPicUserId ?? ''} onChange={e => setF({ ...f, backupPicUserId: e.target.value || undefined })}>
            <option value="">– belum ada –</option>
            {pics.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
      </div>
      {area && area.picUserId !== f.picUserId && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Tugas terbuka milik PIC lama di area ini akan pindah ke PIC baru.</p>}
      <Field label="Keterangan"><Textarea value={f.note ?? ''} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Aktif</label>
      <p className="text-[11px] text-slate-500">Data yang sudah dipakai dokumen lain tidak bisa dihapus, hanya dinonaktifkan.</p>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

export const AreasPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Area | null | 'new'>(null);
  const editable = access.can('master.edit');
  const rows = state.areas
    .filter(a => access.area(a.id))
    .filter(a => `${a.code} ${a.name}`.toLowerCase().includes(q.toLowerCase()));

  const stats = (a: Area) => {
    const siteIds = new Set(state.sites.filter(s => s.areaId === a.id).map(s => s.id));
    const clients = new Set(state.sites.filter(s => s.areaId === a.id).map(s => s.clientId));
    return { sites: siteIds.size, clients: clients.size, quota: sum(quotaByPosition(state.spks, siteIds)), actual: sum(activeByPosition(state.personnel, a.id)) };
  };

  return (
    <div>
      <PageHeader
        title="Area"
        subtitle="Wilayah operasional JISS. Satu area mengurus banyak site dari banyak klien."
        actions={<>
          <ExportBtn onClick={() => exportCsv('area.csv', [['Kode', 'Nama', 'PIC utama', 'PIC cadangan', 'Site', 'Status'], ...rows.map(a => [a.code, a.name, lookups.user.get(a.picUserId ?? '')?.name ?? '', lookups.user.get(a.backupPicUserId ?? '')?.name ?? '', stats(a).sites, a.active ? 'Aktif' : 'Nonaktif'])])} />
          {editable && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEdit('new')}>Tambah area</Btn>}
        </>}
      />
      <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Cari kode atau nama area" /></div>
      <Card pad={false}>
        <Table head={['Kode', 'Nama', 'PIC area (AA)', 'Site / klien', 'Security aktif / kuota', 'Status', '']}>
          {rows.map(a => {
            const st = stats(a);
            return (
              <tr key={a.id} className={muted(a.active)}>
                <Td className="font-mono text-xs">{a.code}</Td>
                <Td><Link to={`/area/${a.id}`} className="font-semibold text-indigo-700 hover:underline">{a.name}</Link></Td>
                <Td>
                  <div>{lookups.user.get(a.picUserId ?? '')?.name ?? <span className="text-rose-600 text-xs font-semibold">Belum ada PIC</span>}</div>
                  {a.backupPicUserId && <div className="text-xs text-slate-500">Cadangan: {lookups.user.get(a.backupPicUserId)?.name}</div>}
                </Td>
                <Td className="tabular-nums">{st.sites} site · {st.clients} klien</Td>
                <Td className="tabular-nums">
                  {st.actual} / {st.quota}
                  {st.actual < st.quota && <Badge tone="red" className="ml-2">Kurang {st.quota - st.actual}</Badge>}
                </Td>
                <Td><ActiveBadge active={a.active} /></Td>
                <Td>{editable && <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(a)}>Ubah</Btn>}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {edit && <AreaForm area={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
};

export const AreaDetail: React.FC<{ id: string }> = ({ id }) => {
  const { state, lookups, access } = useStore();
  const [edit, setEdit] = useState(false);
  const a = lookups.area.get(id);
  if (!a || !access.area(a.id)) return <NotFound what="Area" />;
  const sites = state.sites.filter(s => s.areaId === a.id);
  const siteIds = new Set(sites.map(s => s.id));
  const running = runningIn(state, siteIds);
  const byClient = [...new Set(sites.map(s => s.clientId))];

  return (
    <div className="space-y-5">
      <PageHeader
        back="/area"
        title={`Area ${a.name}`}
        subtitle={<span className="font-mono text-xs">{a.code}</span>}
        actions={access.can('master.edit') && <Btn size="sm" variant="secondary" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(true)}>Ubah</Btn>}
      />
      <Card>
        <DL items={[
          ['PIC area utama (AA)', lookups.user.get(a.picUserId ?? '')?.name ?? 'Belum ada, tugas jatuh ke kepala Operasional'],
          ['PIC area cadangan', lookups.user.get(a.backupPicUserId ?? '')?.name ?? '–'],
          ['Status', <ActiveBadge active={a.active} />],
          ['Keterangan', a.note ?? '–'],
        ]} />
      </Card>
      <QuotaTable areaId={a.id} />
      <Card title={`Site di area ini (${sites.length}), dikelompokkan per klien`} pad={false}>
        <Table head={['Klien', 'Site', 'Alamat', 'Status']}>
          {byClient.flatMap(cid =>
            sites.filter(s => s.clientId === cid).map((s, i) => (
              <tr key={s.id} className={muted(s.active)}>
                <Td>{i === 0 && <Link to={`/klien/${cid}`} className="font-semibold text-indigo-700 hover:underline">{lookups.client.get(cid)?.name}</Link>}</Td>
                <Td><Link to={`/site/${s.id}`} className="font-medium hover:underline">{s.name}</Link></Td>
                <Td className="text-xs text-slate-500">{s.address}</Td>
                <Td><ActiveBadge active={s.active} /></Td>
              </tr>
            )),
          )}
        </Table>
      </Card>
      {access.can('fpk.view') && <FpkMiniTable fpks={running.fpks} />}
      {access.can('spk.view') && <SpkMiniTable spks={running.spks} title="SPK aktif dan dalam proses" />}
      {edit && <AreaForm area={a} onClose={() => setEdit(false)} />}
    </div>
  );
};
