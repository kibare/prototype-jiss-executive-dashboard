import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store/store';
import { Btn, Card, Input, PageHeader, Table, Td, runAction, ErrorText, DateInput } from '../../ui/kit';
import { addWorkdays, fmtDate, TODAY } from '../../domain/time';

const SettingRow: React.FC<{ k: string; value: string; usedIn: string; desc: string; editable: boolean }> = ({ k, value, usedIn, desc, editable }) => {
  const { actions } = useStore();
  const [v, setV] = useState(value);
  const dirty = v !== value;
  return (
    <tr>
      <Td>
        <div className="font-mono text-xs text-slate-800">{k}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </Td>
      <Td>
        {editable ? (
          <div className="flex gap-1.5">
            <Input value={v} onChange={e => setV(e.target.value)} className="w-32" />
            {dirty && <Btn size="sm" onClick={() => runAction(actions.updateSetting(k, v), 'Pengaturan disimpan')}>Simpan</Btn>}
          </div>
        ) : <span className="font-semibold">{value}</span>}
      </Td>
      <Td className="text-xs text-slate-500">{usedIn}</Td>
    </tr>
  );
};

export const SettingsPage: React.FC = () => {
  const { state, access, actions } = useStore();
  const editable = access.can('admin.edit');
  const [h, setH] = useState({ date: '', description: '' });
  const [err, setErr] = useState('');
  return (
    <div className="space-y-5">
      <PageHeader title="Pengaturan & kalender libur" subtitle="Semua batas waktu dan ambang dibaca dari sini, tidak di-hardcode. Perubahan berlaku untuk tugas yang dibuat setelahnya." />
      <Card title={`Pengaturan (${state.settings.length} kunci)`} pad={false}>
        <Table head={['Kunci', 'Nilai', 'Dipakai di']}>
          {state.settings.map(s => <SettingRow key={s.key} k={s.key} value={s.value} usedIn={s.usedIn} desc={s.description} editable={editable} />)}
        </Table>
      </Card>
      <Card title="Kalender kerja">
        <p className="text-sm text-slate-600 mb-3">
          Hari kerja: Senin–Jumat di luar tanggal libur di bawah. Contoh fungsi bersama: 2 hari kerja dari {fmtDate(TODAY)} = <b>{fmtDate(addWorkdays(TODAY, 2, state.holidays))}</b>; 2 hari kerja dari 23 Des 2026 = <b>{fmtDate(addWorkdays('2026-12-23', 2, state.holidays))}</b>.
        </p>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table head={['Tanggal', 'Keterangan', '']}>
            {state.holidays.map(x => (
              <tr key={x.date}>
                <Td className="whitespace-nowrap">{fmtDate(x.date)}</Td>
                <Td>{x.description}</Td>
                <Td>{editable && <Btn size="sm" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => runAction(actions.removeHoliday(x.date), 'Libur dihapus')}>Hapus</Btn>}</Td>
              </tr>
            ))}
          </Table>
          {editable && (
            <div className="flex flex-col sm:flex-row gap-2 p-3 bg-slate-50 border-t border-slate-200">
              <DateInput value={h.date} onChange={e => setH({ ...h, date: e.target.value })} className="sm:w-44" />
              <Input placeholder="Keterangan (libur nasional / cuti bersama)" value={h.description} onChange={e => setH({ ...h, description: e.target.value })} />
              <Btn size="sm" onClick={() => runAction(actions.addHoliday(h), 'Libur ditambahkan', setErr) && setH({ date: '', description: '' })}>Tambah</Btn>
            </div>
          )}
        </div>
        <div className="mt-2"><ErrorText>{err}</ErrorText></div>
      </Card>
    </div>
  );
};
