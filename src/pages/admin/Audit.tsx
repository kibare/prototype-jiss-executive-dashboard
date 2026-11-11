import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '../../store/store';
import { Card, Input, PageHeader, Select, Table, Td } from '../../ui/kit';
import { fmtDateTime } from '../../domain/time';

export const AuditPage: React.FC = () => {
  const { state, lookups, access } = useStore();
  const [entity, setEntity] = useState('');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const entities = [...new Set(state.audit.map(a => a.entity))].sort();
  const seeMoney = access.money('__semua__') || access.bodLike();
  const rows = state.audit.filter(a =>
    (!entity || a.entity === entity) && (!user || a.actorId === user) &&
    (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to));
  const val = (v: string | undefined, money?: boolean) =>
    !v ? '–' : money && !seeMoney ? <span className="inline-flex items-center gap-1 text-slate-400"><Lock className="w-3 h-3" />nilai disamarkan</span> : v;

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Append-only: tidak ada yang bisa mengubah atau menghapus. Nilai uang disamarkan untuk peran yang tidak boleh melihat uang." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Select value={entity} onChange={e => setEntity(e.target.value)}>
          <option value="">Semua entitas</option>
          {entities.map(e => <option key={e}>{e}</option>)}
        </Select>
        <Select value={user} onChange={e => setUser(e.target.value)}>
          <option value="">Semua user</option>
          {state.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <Card pad={false}>
        <Table head={['Waktu', 'Oleh', 'Entitas', 'Aksi', 'Sebelum', 'Sesudah']}>
          {rows.map(a => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-xs">{fmtDateTime(a.at)}</Td>
              <Td className="text-xs">
                {lookups.user.get(a.actorId)?.name ?? (a.actorId === 'sistem' ? 'Sistem (job harian)' : a.actorId)}
                {a.onBehalfOfId && <div className="text-slate-500">atas nama {lookups.user.get(a.onBehalfOfId)?.name}</div>}
              </Td>
              <Td className="text-xs"><span className="font-semibold">{a.entity}</span><div className="font-mono text-slate-400">{a.entityId}</div></Td>
              <Td className="text-sm">{a.action}</Td>
              <Td className="text-xs text-slate-600">{val(a.before, a.hasMoney)}</Td>
              <Td className="text-xs text-slate-600">{val(a.after, a.hasMoney)}</Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && <p className="text-sm text-slate-500 p-4">Tidak ada catatan.</p>}
      </Card>
    </div>
  );
};
