import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/store';
import { Badge, Btn, Card, Empty, Money, PageHeader } from '../../ui/kit';
import { TaskCard } from './TasksPage';
import { latest } from '../../domain/selectors';
import { fmtDate } from '../../domain/time';
import { settingNum } from '../../domain/settings';
import { navigate } from '../../router';

export const DecisionsPage: React.FC = () => {
  const { state, lookups, myTasks, me } = useStore();
  const minMargin = settingNum(state.settings, 'margin.minimum_pct', 10);
  const approvals = myTasks.filter(x => x.task.assigneeRole === 'BOD');
  const escalations = myTasks.filter(x => x.reason === 'eskalasi-bod');

  return (
    <div>
      <PageHeader title="Menunggu keputusan saya" subtitle="Persetujuan FPK dan memo, serta semua tugas yang naik ke BOD." />

      <h2 className="text-sm font-bold text-slate-700 mb-2">Persetujuan ({approvals.length})</h2>
      <div className="space-y-2.5 mb-8">
        {approvals.map(({ task, esc, reason }) => {
          const f = task.refType === 'fpk' ? lookups.fpk.get(task.refId) : undefined;
          if (!f) return <TaskCard key={task.id} task={task} reason={reason!} esc={esc} />;
          const v = latest(f);
          const low = (v.estMarginPct ?? 100) < minMargin;
          return (
            <Card key={task.id}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <Badge tone="violet">{reason === 'wakil' ? 'Persetujuan FPK · sebagai wakil' : 'Persetujuan FPK'}</Badge>
                  </div>
                  <div className="text-sm font-semibold">{f.number} · {lookups.client.get(v.clientId)?.name}</div>
                  {(esc.overdue || low || f.notFeasible) && (
                    <div className="flex items-start gap-1.5 text-sm text-rose-700 mt-1">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{[
                        esc.overdue && `Lewat ${esc.daysLate} hari dari batas`,
                        low && `margin ${v.estMarginPct?.toLocaleString('id-ID')}% di bawah minimum ${minMargin}%`,
                        f.notFeasible && `ditandai tidak layak oleh ${f.notFeasible.division}`,
                      ].filter(Boolean).join(' · ')}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
                    {lookups.site.get(v.siteId)?.name} · mulai {fmtDate(v.plannedStart)} · nilai/bulan <Money value={v.monthlyValue} clientId={v.clientId} /> · margin {v.estMarginPct?.toLocaleString('id-ID')}% · batas {fmtDate(task.dueAt)}
                  </div>
                  {f.createdBy === me.id && <div className="text-xs text-rose-600 mt-1">Anda pembuat FPK ini, jadi tidak bisa menyetujuinya.</div>}
                </div>
                <Btn size="sm" onClick={() => navigate(`/fpk/${f.id}`)}>Tinjau & putuskan</Btn>
              </div>
            </Card>
          );
        })}
        {approvals.length === 0 && <Card><Empty title="Tidak ada persetujuan yang menunggu." /></Card>}
      </div>

      <h2 className="text-sm font-bold text-slate-700 mb-2">Eskalasi ke BOD ({escalations.length})</h2>
      <div className="space-y-2.5">
        {escalations.map(x => <TaskCard key={x.task.id} task={x.task} reason={x.reason!} esc={x.esc} />)}
        {escalations.length === 0 && <Card><Empty title="Tidak ada eskalasi." /></Card>}
      </div>
    </div>
  );
};
