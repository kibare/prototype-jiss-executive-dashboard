import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, CalendarDays, RotateCcw, FastForward, Play } from 'lucide-react';
import { useStore } from '../store/store';
import { navigate } from '../router';
import { cx, toast } from '../ui/kit';
import { fmtDate, fmtDateTime, TODAY } from '../domain/time';
import { isDeputy } from '../domain/rbac';

const useOutside = (ref: React.RefObject<HTMLElement | null>, on: () => void) => {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && on();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, on]);
};

export const homeFor = (roles: string[]) => (roles.includes('Admin sistem') ? '/area' : '/tugas');

const NOTIF_LINK = (refType?: string, refId?: string) =>
  refType === 'fpk' ? `/fpk/${refId}` : refType === 'spk' ? `/spk/${refId}` : refType === 'memo' ? `/memo/${refId}` : refType === 'client' ? `/klien/${refId}` : undefined;

export const Topbar: React.FC<{ onMenu: () => void }> = ({ onMenu }) => {
  const { state, me, actions, myNotifications } = useStore();
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  useOutside(userRef, () => setUserOpen(false));
  useOutside(bellRef, () => setBellOpen(false));
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  useOutside(dateRef, () => setDateOpen(false));
  const unread = myNotifications.filter(n => !n.readBy.includes(me.id)).length;
  const deputy = isDeputy(me, state.delegations);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenu} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Buka menu navigasi">
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative" ref={dateRef}>
          <button onClick={() => setDateOpen(o => !o)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md px-2 py-1" aria-label="Kontrol tanggal simulasi">
            <CalendarDays className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tanggal simulasi:</span> {fmtDate(TODAY)} <ChevronDown className="w-3 h-3" />
          </button>
          {dateOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
              <p className="px-4 py-2.5 text-[11px] text-slate-500 border-b border-slate-100">Simulasi job harian: SPK berakhir, tugas memo H-75, pengingat kejar SPK hari ke-7/14/21, dan eskalasi ikut tanggal ini.</p>
              {([[0, 'Jalankan job harian untuk hari ini', Play], [1, 'Majukan 1 hari', FastForward], [7, 'Majukan 7 hari', FastForward], [30, 'Majukan 30 hari', FastForward]] as const).map(([n, text, Icon]) => (
                <button key={n} onClick={() => {
                  const r = actions.advanceDays(n);
                  setDateOpen(false);
                  const shown = r.summary.slice(0, 3).join('; ');
                  toast(r.summary.length ? `Job harian: ${shown}${r.summary.length > 3 ? `; +${r.summary.length - 3} lainnya` : ''}` : n ? `Tanggal sekarang ${fmtDate(TODAY)}. Tidak ada kejadian baru.` : 'Job harian selesai. Tidak ada kejadian baru.');
                }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
                  <Icon className="w-3.5 h-3.5 text-slate-500" /> {text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={bellRef}>
          <button onClick={() => setBellOpen(o => !o)} className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Notifikasi">
            <Bell className="w-5 h-5" />
            {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-bold">Notifikasi</span>
                <button className="text-xs font-semibold text-indigo-600" onClick={() => actions.markAllRead()}>Tandai semua dibaca</button>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {myNotifications.length === 0 && <p className="text-sm text-slate-500 p-4">Belum ada notifikasi.</p>}
                {myNotifications.map(n => {
                  const link = NOTIF_LINK(n.refType, n.refId);
                  return (
                    <button
                      key={n.id}
                      onClick={() => { if (link) { navigate(link); setBellOpen(false); } }}
                      className={cx('w-full text-left px-4 py-3 hover:bg-slate-50', !n.readBy.includes(me.id) && 'bg-indigo-50/50')}
                    >
                      <div className="text-[13px] text-slate-800">{n.text}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{fmtDateTime(n.at)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button onClick={() => setUserOpen(o => !o)} className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Ganti user simulasi">
            <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
              {me.name.split(' ').map(x => x[0]).slice(0, 2).join('')}
            </span>
            <span className="hidden sm:block text-left">
              <span className="block text-xs font-bold text-slate-900 leading-tight">{me.name}</span>
              <span className="block text-[10px] text-slate-500 leading-tight">{me.roles.join(', ')}{deputy ? ' · wakil BOD' : ''}</span>
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          {userOpen && (
            <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-bold">Masuk sebagai (simulasi)</div>
                <div className="text-[11px] text-slate-500">Menu, aksi, dan nilai uang mengikuti peran user.</div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto py-1">
                {state.users.filter(u => u.active).map(u => (
                  <button
                    key={u.id}
                    onClick={() => { actions.switchUser(u.id); setUserOpen(false); navigate(homeFor(u.roles)); }}
                    className={cx('w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between gap-2', u.id === me.id && 'bg-indigo-50')}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-800 truncate">{u.name}</span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {u.roles.join(', ')}
                        {u.headOf.length ? ' · kepala divisi' : ''}
                        {isDeputy(u, state.delegations) ? ' · wakil BOD' : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => { actions.reset(); setUserOpen(false); navigate('/tugas'); }} className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <RotateCcw className="w-3.5 h-3.5" /> Reset data contoh
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
