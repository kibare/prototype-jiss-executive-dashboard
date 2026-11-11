import React, { useState } from 'react';
import { CheckSquare, Shuffle, Hand, Eye } from 'lucide-react';
import { Field, Modal, Select, Textarea, ErrorText, DateInput, toast } from '../../ui/kit';
import { MANUAL_KINDS } from '../../store/taskActions';
import { AlertTriangle, ArrowRight, Clock, CornerDownRight, UserCheck } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, Empty, PageHeader, Tabs, cx } from '../../ui/kit';
import { fmtDate, diffDays, addWorkdays, TODAY } from '../../domain/time';
import { TASK_KIND_LABEL, escalationHeadRole, type TaskReason, type Escalation } from '../../domain/tasks';
import type { Task } from '../../domain/types';
import { latest } from '../../domain/selectors';
import { navigate } from '../../router';

export const refLink = (t: Task) =>
  t.refType === 'fpk' ? `/fpk/${t.refId}` : t.refType === 'spk' ? `/spk/${t.refId}` : t.refType === 'memo' ? `/memo/${t.refId}` : t.refType === 'personnel' ? `/security/${t.refId}` : t.refType === 'site' ? `/site/${t.refId}` : '/tugas';

const ACTION_LABEL: Partial<Record<Task['kind'], string>> = {
  cek_fpk: 'Cek FPK',
  survei: 'Isi hasil survei',
  cek_margin: 'Cek margin',
  setujui_fpk: 'Putuskan',
  perbaiki_fpk: 'Perbaiki FPK',
  serah_hr: 'Serahkan ke HR',
  tandai_terdaftar: 'Tandai terdaftar',
  mulai_jaga: 'Konfirmasi mulai jaga',
  lepas_mutasi: 'Pilih personel',
  ubah_penempatan: 'Ubah penempatan',
  verifikasi_spk: 'Verifikasi',
  urus_spk_salah: 'Input revisi SPK',
  kejar_spk: 'Input SPK',
  margin_spk: 'Buka SPK',
  memo: 'Pilih jenis memo',
  kirim_memo: 'Kirim memo',
  catat_jawaban: 'Catat jawaban',
  setujui_memo: 'Putuskan',
  cek_margin_memo: 'Cek margin',
  input_spk_perpanjangan: 'Input SPK perpanjangan',
  spk_berakhir_jaga: 'Input SPK perpanjangan',
  penyesuaian_fpk: 'Buka FPK',
  cari_pengganti: 'Buka',
  demobilisasi: 'Buka',
};

/** Tutup tugas manual langsung dari kartu (satu klik + catatan bila wajib). */
const CompleteModal: React.FC<{ task: Task; onClose: () => void }> = ({ task, onClose }) => {
  const { actions } = useStore();
  const [note, setNote] = useState('');
  const [choice, setChoice] = useState<'terima' | 'nego' | ''>('');
  const [err, setErr] = useState('');
  const hint: Partial<Record<Task['kind'], string>> = {
    penyesuaian_fpk: 'Konfirmasi divisi Anda sudah menyesuaikan persiapan dengan FPK perubahan (isi SPK yang jadi acuan).',
    cari_pengganti: 'Tulis siapa penggantinya atau rencana pemenuhannya.',
    demobilisasi: task.assigneeRole === 'HR' ? 'Penempatan personel di site ini diakhiri dan personel kembali berstatus standby.' : 'Konfirmasi personel sudah ditarik dari site.',
    margin_spk: 'Margin SPK di bawah minimum. Terima, atau minta Marketing nego ulang lewat addendum.',
  };
  const go = () => {
    const r = actions.completeTask(task.id, note, choice || undefined);
    if (!r.ok) return setErr(r.error);
    toast('Tugas selesai');
    onClose();
  };
  return (
    <Modal open title={task.title} onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={go}>Selesaikan</Btn></>}>
      <p className="text-sm text-slate-600">{hint[task.kind]}</p>
      {task.kind === 'margin_spk' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={choice === 'terima'} onChange={() => setChoice('terima')} /> Terima margin ini</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={choice === 'nego'} onChange={() => setChoice('nego')} /> Nego ulang lewat addendum</label>
        </div>
      )}
      <Field label="Catatan" required={task.kind === 'cari_pengganti' || task.kind === 'demobilisasi'}><Textarea value={note} onChange={e => setNote(e.target.value)} /></Field>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

/** Tugas yang hanya bisa dikerjakan pemiliknya (pembuat dokumen / Marketing pemegang klien). Penerima eskalasi cukup turun tangan. */
const OWNER_ONLY: Task['kind'][] = ['perbaiki_fpk', 'memo', 'kirim_memo', 'catat_jawaban', 'input_spk_perpanjangan', 'kejar_spk', 'urus_spk_salah', 'spk_berakhir_jaga'];

const InterveneModal: React.FC<{ task: Task; onClose: () => void }> = ({ task, onClose }) => {
  const { state, actions } = useStore();
  const [note, setNote] = useState('');
  const [due, setDue] = useState(addWorkdays(TODAY, 2, state.holidays));
  const [err, setErr] = useState('');
  const go = () => {
    const r = actions.interveneTask(task.id, note, due);
    if (!r.ok) return setErr(r.error);
    toast('Tindakan dicatat, pemilik tugas diberi tahu');
    onClose();
  };
  return (
    <Modal open title="Turun tangan" onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={go}>Simpan</Btn></>}>
      <p className="text-sm text-slate-600">{task.title}</p>
      <Field label="Tindakan yang Anda ambil" required hint="Mis. sudah menelepon klien, minta PIC area konfirmasi hari ini."><Textarea value={note} onChange={e => setNote(e.target.value)} /></Field>
      <Field label="Target tanggal baru" required><DateInput value={due} onChange={e => setDue(e.target.value)} /></Field>
      <p className="text-[11px] text-slate-500">Tugas tetap milik pemilik awal. Hitungan lewat batas dan eskalasi mulai lagi dari target baru. Tercatat di audit log.</p>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

const ReassignModal: React.FC<{ task: Task; onClose: () => void }> = ({ task, onClose }) => {
  const { state, actions } = useStore();
  const [userId, setUserId] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    const r = actions.reassignTask(task.id, userId);
    if (!r.ok) return setErr(r.error);
    toast('Tugas dialihkan');
    onClose();
  };
  return (
    <Modal open title="Alihkan tugas" onClose={onClose} footer={<><Btn variant="secondary" onClick={onClose}>Batal</Btn><Btn onClick={go} disabled={!userId}>Alihkan</Btn></>}>
      <p className="text-sm text-slate-600">{task.title}</p>
      <Field label={`Alihkan ke (${task.assigneeRole})`} required>
        <Select value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">– pilih –</option>
          {state.users.filter(u => u.active && u.roles.includes(task.assigneeRole) && u.id !== task.assigneeUserId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      <p className="text-[11px] text-slate-500">Eskalasi tidak memindahkan tugas; mengalihkan berarti mengganti pemiliknya dan tercatat di audit log.</p>
      <ErrorText>{err}</ErrorText>
    </Modal>
  );
};

const REASON: Record<TaskReason, string | null> = {
  milik: null,
  peran: 'Untuk peran Anda',
  'eskalasi-kepala': 'Eskalasi: Anda kepala divisi',
  'eskalasi-bod': 'Eskalasi ke BOD',
  wakil: 'Sebagai wakil BOD (atas nama BOD)',
};

export const TaskCard: React.FC<{ task: Task; reason: TaskReason; esc: Escalation }> = ({ task, reason, esc }) => {
  const { lookups, me, taskCtx } = useStore();
  const [modal, setModal] = useState<'done' | 'move' | 'intervene' | null>(null);
  const escalated = reason === 'eskalasi-kepala' || reason === 'eskalasi-bod';
  const taskArea = taskCtx.areaOf(task);
  const scoped = task.assigneeRole === 'Operasional' || task.assigneeRole === 'PIC Area';
  // Penerima eskalasi yang bukan pelaksana aslinya cukup melihat dokumen lalu turun tangan atau mengalihkan.
  const canAct = !escalated || (me.roles.includes(task.assigneeRole) && !OWNER_ONLY.includes(task.kind) && (!scoped || !taskArea || me.areaIds.includes(taskArea)));
  const startFpk = task.kind === 'mulai_jaga' ? lookups.fpk.get(task.refId) : undefined;
  const notYet = !!startFpk && diffDays(TODAY, latest(startFpk).plannedStart) > 0;
  const daysLeft = diffDays(TODAY, task.dueAt);
  const canMove = task.assigneeRole !== 'BOD' && (reason === 'eskalasi-kepala' || reason === 'eskalasi-bod' || me.headOf.includes(escalationHeadRole(task.assigneeRole)) || me.roles.includes('BOD'));
  const owner = task.assigneeUserId ? lookups.user.get(task.assigneeUserId)?.name : `semua ${task.assigneeRole}`;
  const target = task.kind === 'kejar_spk' ? `/spk/input?fpk=${task.refId}`
    : task.kind === 'urus_spk_salah' ? `/spk/${task.refId}/revisi`
    : task.kind === 'memo' && task.refType === 'spk' ? `/memo/baru?spk=${task.refId}`
    : task.kind === 'input_spk_perpanjangan' || task.kind === 'spk_berakhir_jaga' ? `/spk/input?induk=${task.refId}`
    : refLink(task);
  return (
    <div className={cx('bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3', esc.overdue ? 'border-rose-300' : 'border-slate-200')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <Badge tone="slate">{TASK_KIND_LABEL[task.kind]}</Badge>
          {REASON[reason] && <Badge tone={reason === 'wakil' ? 'violet' : 'amber'}><CornerDownRight className="w-3 h-3" />{REASON[reason]}</Badge>}
          {esc.label && <Badge tone="red"><AlertTriangle className="w-3 h-3" />{esc.label}</Badge>}
        </div>
        <div className="text-sm font-semibold text-slate-900">{task.title}</div>
        {task.interventions?.map((x, i) => (
          <div key={i} className="text-xs text-violet-800 bg-violet-50 rounded-md px-2 py-1 mt-1.5">
            Turun tangan {lookups.user.get(x.by)?.name}: {x.note} · target baru {fmtDate(x.newDue)}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
          <span className={cx('inline-flex items-center gap-1 font-semibold', esc.overdue ? 'text-rose-600' : daysLeft <= 1 ? 'text-amber-600' : 'text-slate-600')}>
            <Clock className="w-3.5 h-3.5" />
            Batas {fmtDate(task.dueAt)}
            {esc.overdue ? ` · lewat ${esc.daysLate} hari` : daysLeft === 0 ? ' · hari ini' : daysLeft === 1 ? ' · besok' : ''}
          </span>
          {reason !== 'milik' && <span className="inline-flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />Pemilik: {owner}</span>}
          {task.customEscalation && <span>{task.customEscalation}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 shrink-0 self-start sm:self-center">
        {canMove && <Btn size="sm" variant="ghost" icon={<Shuffle className="w-3.5 h-3.5" />} onClick={() => setModal('move')}>Alihkan</Btn>}
        {escalated && <Btn size="sm" variant="secondary" icon={<Hand className="w-3.5 h-3.5" />} onClick={() => setModal('intervene')}>Turun tangan</Btn>}
        {canAct && MANUAL_KINDS.includes(task.kind) && <Btn size="sm" variant="success" icon={<CheckSquare className="w-3.5 h-3.5" />} onClick={() => setModal('done')}>Selesaikan</Btn>}
        {canAct
          ? <Btn size="sm" variant={MANUAL_KINDS.includes(task.kind) || notYet ? 'secondary' : 'primary'} onClick={() => navigate(target)} icon={<ArrowRight className="w-3.5 h-3.5" />}>
            {notYet ? `Mulai ${fmtDate(latest(startFpk!).plannedStart)}` : ACTION_LABEL[task.kind] ?? 'Buka'}
          </Btn>
          : <Btn size="sm" variant="secondary" onClick={() => navigate(refLink(task))} icon={<Eye className="w-3.5 h-3.5" />}>Lihat dokumen</Btn>}
      </div>
      {modal === 'done' && <CompleteModal task={task} onClose={() => setModal(null)} />}
      {modal === 'move' && <ReassignModal task={task} onClose={() => setModal(null)} />}
      {modal === 'intervene' && <InterveneModal task={task} onClose={() => setModal(null)} />}
    </div>
  );
};

export const TasksPage: React.FC = () => {
  const { myTasks, me, state } = useStore();
  const [tab, setTab] = useState('semua');
  const overdue = myTasks.filter(x => x.esc.overdue);
  const escalated = myTasks.filter(x => x.reason !== 'milik' && x.reason !== 'peran');
  const list = tab === 'lewat' ? overdue : tab === 'eskalasi' ? escalated : myTasks;
  const recentDone = state.tasks.filter(t => t.status === 'selesai' && t.doneBy === me.id).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Tugas Saya"
        subtitle={`Tugas milik ${me.name} dan perannya, urut dari batas terdekat. Yang lewat batas berwarna merah.`}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'semua', label: `Semua (${myTasks.length})` },
          { key: 'lewat', label: `Lewat batas (${overdue.length})` },
          { key: 'eskalasi', label: `Eskalasi ke saya (${escalated.length})` },
        ]}
      />
      <div className="space-y-2.5">
        {list.map(x => <TaskCard key={x.task.id} task={x.task} reason={x.reason!} esc={x.esc} />)}
        {list.length === 0 && (
          <Card><Empty title="Tidak ada tugas di sini.">Coba ganti user simulasi di kanan atas untuk melihat tugas peran lain.</Empty></Card>
        )}
      </div>
      {recentDone.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-700 mb-2">Baru Anda selesaikan</h2>
          <div className="space-y-1.5">
            {recentDone.map(t => (
              <div key={t.id} className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
                ✓ {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
