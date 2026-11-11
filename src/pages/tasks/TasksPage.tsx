import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Clock, CornerDownRight, UserCheck } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, Empty, PageHeader, Tabs, cx } from '../../ui/kit';
import { fmtDate, diffDays, TODAY } from '../../domain/time';
import { TASK_KIND_LABEL, type TaskReason, type Escalation } from '../../domain/tasks';
import type { Task } from '../../domain/types';
import { navigate } from '../../router';

export const refLink = (t: Task) =>
  t.refType === 'fpk' ? `/fpk/${t.refId}` : t.refType === 'spk' ? `/spk/${t.refId}` : t.refType === 'personnel' ? `/security/${t.refId}` : t.refType === 'site' ? `/site/${t.refId}` : '/tugas';

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
  penyesuaian_fpk: 'Tinjau',
  margin_spk: 'Putuskan',
};

const REASON: Record<TaskReason, string | null> = {
  milik: null,
  peran: 'Untuk peran Anda',
  'eskalasi-kepala': 'Eskalasi: Anda kepala divisi',
  'eskalasi-bod': 'Eskalasi ke BOD',
  wakil: 'Sebagai wakil BOD (atas nama BOD)',
};

export const TaskCard: React.FC<{ task: Task; reason: TaskReason; esc: Escalation }> = ({ task, reason, esc }) => {
  const { lookups } = useStore();
  const daysLeft = diffDays(TODAY, task.dueAt);
  const owner = task.assigneeUserId ? lookups.user.get(task.assigneeUserId)?.name : `semua ${task.assigneeRole}`;
  const target = task.kind === 'kejar_spk' || task.kind === 'urus_spk_salah'
    ? (task.kind === 'kejar_spk' ? `/spk/input?fpk=${task.refId}` : `/spk/${task.refId}/revisi`)
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
      <Btn size="sm" onClick={() => navigate(target)} icon={<ArrowRight className="w-3.5 h-3.5" />} className="shrink-0 self-start sm:self-center">
        {ACTION_LABEL[task.kind] ?? 'Buka'}
      </Btn>
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
