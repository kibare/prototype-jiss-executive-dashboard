import React, { useState } from 'react';
import { Plus, Pencil, Send } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, ErrorText, Field, Input, Modal, PageHeader, SearchBox, Table, Td, runAction, toast } from '../../ui/kit';
import { ROLES, type Role, type User } from '../../domain/types';
import { isDeputy } from '../../domain/rbac';
import { muted } from '../master/common';

const UserForm: React.FC<{ user: User | null; onClose: () => void }> = ({ user, onClose }) => {
  const { state, actions } = useStore();
  const [f, setF] = useState<User>(user ?? { id: '', name: '', email: '', title: '', roles: [], headOf: [], areaIds: [], active: true });
  const [err, setErr] = useState('');
  const scoped = f.roles.includes('PIC Area') || f.roles.includes('Operasional');
  const toggle = <T,>(arr: T[], v: T, on: boolean) => (on ? [...arr, v] : arr.filter(x => x !== v));
  const save = () => runAction(actions.saveUser({ ...f, headOf: f.headOf.filter(r => f.roles.includes(r)) }), user ? 'User disimpan' : 'User dibuat', setErr) && onClose();
  return (
    <Modal open wide title={user ? `Ubah ${user.name}` : 'Tambah user'} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={save}>Simpan</Btn></>}>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Nama" required><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" required><Input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Jabatan internal"><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      </div>
      <Field label="Peran" required hint="Satu user boleh punya beberapa peran; aksesnya gabungan. Centang 'kepala' untuk tujuan eskalasi pertama peran itu.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
          {ROLES.map(r => (
            <div key={r} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.roles.includes(r)} onChange={e => setF({ ...f, roles: toggle(f.roles, r, e.target.checked) })} />
                {r}
              </label>
              {f.roles.includes(r) && r !== 'BOD' && r !== 'Admin sistem' && (
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input type="checkbox" checked={f.headOf.includes(r)} onChange={e => setF({ ...f, headOf: toggle<Role>(f.headOf, r, e.target.checked) })} />
                  kepala
                </label>
              )}
            </div>
          ))}
        </div>
      </Field>
      {scoped && (
        <Field label="Lingkup area" hint="PIC Area dan Operasional hanya melihat data di area yang dicentang.">
          <div className="flex flex-wrap gap-3 mt-1">
            {state.areas.filter(a => a.active).map(a => (
              <label key={a.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={f.areaIds.includes(a.id)} onChange={e => setF({ ...f, areaIds: toggle(f.areaIds, a.id, e.target.checked) })} />
                {a.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Aktif (nonaktif: keluar dari semua sesi, tugas terbukanya pindah ke kepala divisi)</label>
      <p className="text-[11px] text-slate-500">Admin tidak pernah melihat atau mengetik kata sandi. User membuat kata sandi sendiri lewat email undangan. 2FA untuk BOD dan Finance menyusul sebagai modul terpisah.</p>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

export const UsersPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<User | null | 'new'>(null);
  const editable = access.can('admin.edit');
  const rows = state.users.filter(u => `${u.name} ${u.email} ${u.roles.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader
        title="Pengguna & peran"
        subtitle="Akun dibuat Admin sistem; tidak ada pendaftaran mandiri."
        actions={editable && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEdit('new')}>Tambah user</Btn>}
      />
      <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Cari nama, email, peran" /></div>
      <Card pad={false}>
        <Table head={['Nama', 'Peran', 'Kepala divisi', 'Lingkup area', 'Status', '']}>
          {rows.map(u => (
            <tr key={u.id} className={muted(u.active)}>
              <Td>
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email} · {u.title}</div>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {u.roles.map(r => <Badge key={r} tone="blue">{r}</Badge>)}
                  {isDeputy(u, state.delegations) && <Badge tone="violet">Wakil BOD</Badge>}
                </div>
              </Td>
              <Td className="text-xs">{u.headOf.join(', ') || '–'}</Td>
              <Td className="text-xs">{u.areaIds.length ? u.areaIds.map(a => lookups.area.get(a)?.name).join(', ') : (u.roles.some(r => r === 'PIC Area' || r === 'Operasional') ? '–' : 'Semua')}</Td>
              <Td>{u.active ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</Td>
              <Td>
                {editable && (
                  <div className="flex gap-1">
                    <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(u)}>Ubah</Btn>
                    <Btn size="sm" variant="ghost" icon={<Send className="w-3.5 h-3.5" />} onClick={() => toast(`Undangan dikirim ke ${u.email} (simulasi)`)}>Undang</Btn>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <UserForm user={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
};
