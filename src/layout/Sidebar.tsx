import React from 'react';
import {
  ListChecks, Gavel, FileText, FileCheck2, Timer, Mail, MapPinned, Building2, MapPin, Briefcase,
  Users, UserCog, Network, Settings, ShieldCheck, History, LayoutDashboard, X, Layers,
} from 'lucide-react';
import { useStore } from '../store/store';
import { Link, usePath } from '../router';
import { cx } from '../ui/kit';
import type { Perm } from '../domain/rbac';

interface Item { to: string; label: string; icon: React.ElementType; perm: Perm; badge?: number; soon?: boolean }

export const Sidebar: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { access, myTasks } = useStore();
  const path = usePath();
  const decisions = myTasks.filter(x => x.task.assigneeRole === 'BOD' || x.reason === 'eskalasi-bod').length;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Ruang kerja',
      items: [
        { to: '/tugas', label: 'Tugas Saya', icon: ListChecks, perm: 'tasks.view', badge: myTasks.length },
        { to: '/keputusan', label: 'Menunggu keputusan saya', icon: Gavel, perm: 'decisions.view', badge: decisions },
      ],
    },
    {
      title: 'Kontrak',
      items: [
        { to: '/fpk', label: 'FPK', icon: FileText, perm: 'fpk.view' },
        { to: '/spk', label: 'SPK', icon: FileCheck2, perm: 'spk.view' },
        { to: '/jalan-tanpa-spk', label: 'Jalan tanpa SPK', icon: Timer, perm: 'spk.view' },
        { to: '/memo', label: 'Memo eksternal', icon: Mail, perm: 'memo.view' },
      ],
    },
    {
      title: 'Client + Area + Site',
      items: [
        { to: '/area', label: 'Area', icon: MapPinned, perm: 'master.view' },
        { to: '/klien', label: 'Klien', icon: Building2, perm: 'master.view' },
        { to: '/site', label: 'Site', icon: MapPin, perm: 'master.view' },
        { to: '/jabatan', label: 'Jabatan', icon: Briefcase, perm: 'master.view' },
      ],
    },
    {
      title: 'People in Act',
      items: [{ to: '/security', label: 'Daftar security', icon: Users, perm: 'security.view' }],
    },
    {
      title: 'Admin',
      items: [
        { to: '/admin/pengguna', label: 'Pengguna & peran', icon: UserCog, perm: 'admin.view' },
        { to: '/admin/divisi-terkait', label: 'Divisi terkait & PIC area', icon: Network, perm: 'master.view' },
        { to: '/admin/pengaturan', label: 'Pengaturan & libur', icon: Settings, perm: 'admin.view' },
        { to: '/admin/delegasi', label: 'Delegasi BOD', icon: ShieldCheck, perm: 'delegation.edit' },
        { to: '/audit', label: 'Audit log', icon: History, perm: 'audit.view' },
      ],
    },
    {
      title: 'Rilis berikutnya',
      items: [{ to: '/dashboard', label: 'Dashboard eksekutif', icon: LayoutDashboard, perm: 'dashboard.view', soon: true }],
    },
  ];

  const content = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white leading-tight">Kontrol Operasional</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Prototipe PRD v1.2</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white lg:hidden" aria-label="Tutup menu navigasi">
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map(g => {
          const items = g.items.filter(i => access.can(i.perm));
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{g.title}</div>
              <div className="space-y-0.5">
                {items.map(i => {
                  const active = path === i.to || path.startsWith(i.to + '/');
                  const Icon = i.icon;
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      className={cx(
                        'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] font-medium',
                        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50',
                      )}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{i.label}</span>
                      </span>
                      {!!i.badge && <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5 py-0.5">{i.badge}</span>}
                      {i.soon && <span className="text-[9px] font-bold text-slate-400 border border-slate-600 rounded px-1">NANTI</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
        Semua data di prototipe ini fiktif.
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block w-64 shrink-0 bg-slate-900">
        <aside className="h-screen sticky top-0">{content}</aside>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-slate-900" onClick={e => (e.target as HTMLElement).closest('a') && onClose()}>
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
