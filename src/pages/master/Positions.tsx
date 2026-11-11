import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, ErrorText, ExportBtn, Field, Input, Modal, PageHeader, Table, Td, exportCsv, runAction } from '../../ui/kit';
import { ActiveBadge, muted } from './common';
import type { Position } from '../../domain/types';

const EditModal: React.FC<{ row: Position | null; onClose: () => void }> = ({ row, onClose }) => {
  const { actions } = useStore();
  const [f, setF] = useState<Position>(row ?? { id: '', code: '', name: '', active: true });
  const [err, setErr] = useState('');
  const save = () => { if (runAction(actions.savePosition(f), 'Tersimpan', setErr)) onClose(); };
  return (
    <Modal open title={row ? 'Ubah jabatan' : 'Tambah jabatan'} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={save}>Simpan</Btn></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Kode" required><Input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Nama" required className="col-span-2"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <Field label="Keterangan"><Input value={f.description ?? ''} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Aktif</label>
      <p className="text-[11px] text-slate-500">Jabatan nonaktif tidak muncul di pilihan form baru, tapi tetap tampil di dokumen lama.</p>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

export const PositionsPage: React.FC = () => {
  const { state, access } = useStore();
  const [edit, setEdit] = useState<Position | null | 'new'>(null);
  const editable = access.can('master.edit');
  const rows = state.positions;
  return (
    <div className="space-y-5">
      <PageHeader title="Jabatan" subtitle="Posisi security di baris FPK dan SPK. Dibuat master supaya hitungan kuota per jabatan konsisten. Hanya Admin sistem yang bisa mengubah." />
      <Card
        pad={false}
        actions={<div className="flex gap-2">
          <ExportBtn onClick={() => exportCsv('jabatan.csv', [['Kode', 'Nama', 'Keterangan', 'Status'], ...rows.map(r => [r.code, r.name, r.description ?? '', r.active ? 'Aktif' : 'Nonaktif'])])} />
          {editable && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEdit('new')}>Tambah</Btn>}
        </div>}
        title={`Daftar jabatan (${rows.length})`}
      >
        <Table head={['Kode', 'Nama', 'Keterangan', 'Status', '']}>
          {rows.map(r => (
            <tr key={r.id} className={muted(r.active)}>
              <Td className="font-mono text-xs">{r.code}</Td>
              <Td className="font-semibold">{r.name}</Td>
              <Td className="text-xs text-slate-500">{r.description ?? '–'}</Td>
              <Td><ActiveBadge active={r.active} /></Td>
              <Td>{editable && <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(r)}>Ubah</Btn>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && <EditModal row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
};
