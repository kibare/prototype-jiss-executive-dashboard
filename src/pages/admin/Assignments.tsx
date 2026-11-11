import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, PageHeader, Select, Table, Td, runAction } from '../../ui/kit';
import { Link } from '../../router';
import { AreaForm } from '../master/Areas';
import type { Area, Division } from '../../domain/types';

const DIVS: Division[] = ['Operasional', 'Recruitment', 'Pengadaan', 'Finance'];

export const AssignmentsPage: React.FC = () => {
  const { state, lookups, access, actions } = useStore();
  const editable = access.can('master.edit');
  const [clientId, setClientId] = useState(state.clients[0]?.id ?? '');
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [newSite, setNewSite] = useState({ siteId: '', division: 'Operasional' as Division, userId: '' });
  const client = lookups.client.get(clientId);
  const usersOf = (d: Division) => state.users.filter(u => u.active && u.roles.includes(d));
  const defaults = state.assignments.filter(a => a.clientId === clientId && !a.siteId);
  const overrides = state.assignments.filter(a => a.clientId === clientId && a.siteId);
  const sites = state.sites.filter(s => s.clientId === clientId);
  const head = (d: Division) => state.users.find(u => u.headOf.includes(d))?.name ?? 'BOD';

  return (
    <div className="space-y-5">
      <PageHeader title="Divisi terkait & PIC area" subtitle="Menentukan ke siapa tugas dan notifikasi dikirim. Bila belum diisi, tugas jatuh ke kepala divisi." />

      <Card title="PIC area (Admin Area) per area" pad={false}>
        <Table head={['Area', 'PIC utama', 'PIC cadangan', '']}>
          {state.areas.filter(a => a.active).map(a => (
            <tr key={a.id}>
              <Td>{access.area(a.id) ? <Link to={`/area/${a.id}`} className="font-semibold text-indigo-700 hover:underline">{a.name}</Link> : <span className="font-semibold">{a.name}</span>}</Td>
              <Td>{lookups.user.get(a.picUserId ?? '')?.name ?? <span className="text-rose-600 text-xs font-semibold">Belum ada</span>}</Td>
              <Td>{lookups.user.get(a.backupPicUserId ?? '')?.name ?? '–'}</Td>
              <Td>{editable && <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditArea(a)}>Ganti</Btn>}</Td>
            </tr>
          ))}
        </Table>
        <p className="text-[11px] text-slate-500 px-4 py-3 border-t border-slate-100">Mengganti PIC area langsung memindah tugas terbuka ke orang baru dan tercatat di audit log.</p>
      </Card>

      <Card title="Divisi terkait per klien">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-slate-700">Klien:</span>
          <Select value={clientId} onChange={e => setClientId(e.target.value)} className="sm:w-80">
            {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Default untuk semua site klien</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-5">
          <Table head={['Divisi', 'Orang']}>
            <tr>
              <Td className="font-medium">Marketing (account owner)</Td>
              <Td>{lookups.user.get(client?.accountOwnerId ?? '')?.name}{client?.coOwnerIds.length ? ` + co-owner ${client.coOwnerIds.map(x => lookups.user.get(x)?.name).join(', ')}` : ''}</Td>
            </tr>
            {DIVS.map(d => {
              const cur = defaults.find(a => a.division === d);
              return (
                <tr key={d}>
                  <Td className="font-medium">{d}</Td>
                  <Td>
                    {editable ? (
                      <Select
                        value={cur?.userId ?? ''}
                        className="sm:w-72"
                        onChange={e => {
                          if (!e.target.value) { if (cur) runAction(actions.saveAssignment(null, cur.id), 'Default dihapus'); return; }
                          runAction(actions.saveAssignment({ id: '', clientId, division: d, userId: e.target.value }), 'Divisi terkait disimpan');
                        }}
                      >
                        <option value="">– belum diisi (kepala divisi: {head(d)}) –</option>
                        {usersOf(d).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </Select>
                    ) : (lookups.user.get(cur?.userId ?? '')?.name ?? <span className="text-slate-400">Belum diisi, ke kepala divisi ({head(d)})</span>)}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ditimpa per site</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table head={['Site', 'Divisi', 'Orang', '']}>
            {overrides.map(o => (
              <tr key={o.id}>
                <Td>{lookups.site.get(o.siteId!)?.name}</Td>
                <Td>{o.division}</Td>
                <Td>{lookups.user.get(o.userId)?.name}</Td>
                <Td>{editable && <Btn size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => runAction(actions.saveAssignment(null, o.id), 'Override dihapus')}>Hapus</Btn>}</Td>
              </tr>
            ))}
            {overrides.length === 0 && <tr><Td className="text-slate-400">Tidak ada. Semua site memakai default klien.</Td><Td /><Td /><Td /></tr>}
          </Table>
          {editable && (
            <div className="flex flex-col sm:flex-row gap-2 p-3 bg-slate-50 border-t border-slate-200">
              <Select value={newSite.siteId} onChange={e => setNewSite({ ...newSite, siteId: e.target.value })}>
                <option value="">Pilih site</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select value={newSite.division} onChange={e => setNewSite({ ...newSite, division: e.target.value as Division, userId: '' })}>
                {DIVS.map(d => <option key={d}>{d}</option>)}
              </Select>
              <Select value={newSite.userId} onChange={e => setNewSite({ ...newSite, userId: e.target.value })}>
                <option value="">Pilih orang</option>
                {usersOf(newSite.division).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
              <Btn size="sm" disabled={!newSite.siteId || !newSite.userId} onClick={() => {
                if (runAction(actions.saveAssignment({ id: '', clientId, ...newSite }), 'Override ditambahkan')) setNewSite({ siteId: '', division: 'Operasional', userId: '' });
              }}>Tambah</Btn>
            </div>
          )}
        </div>
      </Card>
      {editArea && <AreaForm area={editArea} onClose={() => setEditArea(null)} />}
    </div>
  );
};
