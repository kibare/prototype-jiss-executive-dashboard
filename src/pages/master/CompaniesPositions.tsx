import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, ErrorText, ExportBtn, Field, Input, Modal, PageHeader, Table, Td, exportCsv, runAction } from '../../ui/kit';
import { ActiveBadge, muted } from './common';
import type { Company, Position } from '../../domain/types';

type Kind = 'pt' | 'jabatan';
type Row = { id: string; code: string; name: string; extra?: string; active: boolean };

const EditModal: React.FC<{ kind: Kind; row: Row | null; onClose: () => void }> = ({ kind, row, onClose }) => {
  const { actions } = useStore();
  const [f, setF] = useState<Row>(row ?? { id: '', code: '', name: '', active: true });
  const [err, setErr] = useState('');
  const save = () => {
    const r = kind === 'pt'
      ? actions.saveCompany({ id: f.id, code: f.code, name: f.name, address: f.extra, active: f.active } as Company)
      : actions.savePosition({ id: f.id, code: f.code, name: f.name, description: f.extra, active: f.active } as Position);
    if (runAction(r, 'Tersimpan', setErr)) onClose();
  };
  const label = kind === 'pt' ? 'PT' : 'jabatan';
  return (
    <Modal open title={row ? `Ubah ${label}` : `Tambah ${label}`} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={save}>Simpan</Btn></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Kode" required><Input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Nama" required className="col-span-2"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <Field label={kind === 'pt' ? 'Alamat' : 'Keterangan'}><Input value={f.extra ?? ''} onChange={e => setF({ ...f, extra: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Aktif</label>
      <p className="text-[11px] text-slate-500">Data nonaktif tidak muncul di pilihan form baru, tapi tetap tampil di dokumen lama.</p>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

const MasterCard: React.FC<{ kind: Kind; title: string; desc: string; rows: Row[] }> = ({ kind, title, desc, rows }) => {
  const { access } = useStore();
  const [edit, setEdit] = useState<Row | null | 'new'>(null);
  const editable = access.can('master.edit');
  return (
    <Card
      title={title}
      pad={false}
      actions={<div className="flex gap-2">
        <ExportBtn onClick={() => exportCsv(`${kind}.csv`, [['Kode', 'Nama', kind === 'pt' ? 'Alamat' : 'Keterangan', 'Status'], ...rows.map(r => [r.code, r.name, r.extra ?? '', r.active ? 'Aktif' : 'Nonaktif'])])} />
        {editable && <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEdit('new')}>Tambah</Btn>}
      </div>}
    >
      <p className="text-xs text-slate-500 px-4 pt-3">{desc}</p>
      <Table head={['Kode', 'Nama', kind === 'pt' ? 'Alamat' : 'Keterangan', 'Status', '']}>
        {rows.map(r => (
          <tr key={r.id} className={muted(r.active)}>
            <Td className="font-mono text-xs">{r.code}</Td>
            <Td className="font-semibold">{r.name}</Td>
            <Td className="text-xs text-slate-500">{r.extra ?? '–'}</Td>
            <Td><ActiveBadge active={r.active} /></Td>
            <Td>{editable && <Btn size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEdit(r)}>Ubah</Btn>}</Td>
          </tr>
        ))}
      </Table>
      {edit && <EditModal kind={kind} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
};

export const CompaniesPositionsPage: React.FC = () => {
  const { state } = useStore();
  return (
    <div className="space-y-5">
      <PageHeader title="PT & jabatan" subtitle="Data rujukan untuk FPK dan SPK. Hanya Admin sistem yang bisa mengubah." />
      <MasterCard kind="pt" title="PT" desc="Badan usaha JISS yang tercantum di FPK dan SPK (pihak penjual)." rows={state.companies.map(c => ({ id: c.id, code: c.code, name: c.name, extra: c.address, active: c.active }))} />
      <MasterCard kind="jabatan" title="Jabatan" desc="Posisi security di baris FPK dan SPK. Dibuat master supaya hitungan kuota per jabatan konsisten." rows={state.positions.map(p => ({ id: p.id, code: p.code, name: p.name, extra: p.description, active: p.active }))} />
    </div>
  );
};
