import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { Btn, Card, ErrorText, Field, Input, PageHeader, Select, runAction, DateInput } from '../../ui/kit';
import type { Delegation } from '../../domain/types';

export const DelegationPage: React.FC = () => {
  const { state, actions } = useStore();
  const bod = state.users.find(u => u.roles.includes('BOD'))!;
  const current = state.delegations.find(d => d.bodUserId === bod.id);
  const [f, setF] = useState<Delegation>(current ?? { id: '', bodUserId: bod.id, deputyUserId: '', mode: 'tetap' });
  const [err, setErr] = useState('');
  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Delegasi BOD" subtitle="BOD menunjuk wakil. Keputusan wakil tercatat atas nama BOD." />
      <Card>
        <div className="space-y-4">
          <Field label="BOD"><Input value={bod.name} disabled /></Field>
          <Field label="Wakil" required>
            <Select value={f.deputyUserId} onChange={e => setF({ ...f, deputyUserId: e.target.value })}>
              <option value="">– pilih –</option>
              {state.users.filter(u => u.active && u.id !== bod.id && !u.roles.includes('Admin sistem')).map(u => <option key={u.id} value={u.id}>{u.name} ({u.roles.join(', ')})</option>)}
            </Select>
          </Field>
          <Field label="Mode">
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" checked={f.mode === 'tetap'} onChange={() => setF({ ...f, mode: 'tetap' })} className="mt-1" />
                <span><b>Tetap</b>: tugas BOD yang lewat batas otomatis juga muncul di wakil.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" checked={f.mode === 'periode'} onChange={() => setF({ ...f, mode: 'periode' })} className="mt-1" />
                <span><b>Periode</b> (misalnya BOD cuti): semua tugas BOD langsung masuk ke wakil selama periode ini.</span>
              </label>
            </div>
          </Field>
          {f.mode === 'periode' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mulai"><DateInput value={f.startDate ?? ''} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
              <Field label="Selesai"><DateInput value={f.endDate ?? ''} onChange={e => setF({ ...f, endDate: e.target.value })} /></Field>
            </div>
          )}
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Aturan pembuat ≠ penyetuju tetap berlaku: bila wakil adalah pembuat FPK atau memo, persetujuannya tetap harus oleh BOD.</p>
          <ErrorText>{err}</ErrorText>
          <div className="flex justify-end"><Btn onClick={() => runAction(actions.saveDelegation(f), 'Delegasi disimpan', setErr)}>Simpan</Btn></div>
        </div>
      </Card>
    </div>
  );
};
