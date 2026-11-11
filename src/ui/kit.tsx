import React, { useEffect, useState } from 'react';
import { ArrowLeft, Lock, Search, X, Paperclip, Download } from 'lucide-react';
import type { Tone } from '../domain/labels';
import { fmtDate, fmtRp } from '../domain/time';
import { useStore } from '../store/store';
import { navigate, Link } from '../router';
import type { Perm } from '../domain/rbac';
import type { Attachment } from '../domain/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({ tone = 'slate', children, className }) => (
  <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap', TONES[tone], className)}>
    {children}
  </span>
);

export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: string }> = ({ title, subtitle, actions, back }) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
    <div className="min-w-0">
      {back && (
        <button onClick={() => navigate(back)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </button>
      )}
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>
);

export const Card: React.FC<{ title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }> = ({ title, actions, children, className, pad = true }) => (
  <section className={cx('bg-white border border-slate-200 rounded-xl shadow-xs', className)}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {actions}
      </div>
    )}
    <div className={pad ? 'p-4' : ''}>{children}</div>
  </section>
);

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border-transparent',
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: React.ReactNode }> = ({ variant = 'primary', size = 'md', icon, className, children, ...rest }) => (
  <button
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
      size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
      BTN[variant],
      className,
    )}
  >
    {icon}
    {children}
  </button>
);

/** Nilai uang: tampil hanya untuk peran yang berhak (Finance, BOD/wakil, Marketing pemegang klien). */
export const Money: React.FC<{ value?: number; clientId?: string; className?: string }> = ({ value, clientId, className }) => {
  const { access } = useStore();
  if (!access.money(clientId)) {
    return (
      <span className={cx('inline-flex items-center gap-1 text-xs text-slate-400 font-medium', className)} title="Field terbatas: hanya Finance, BOD, dan Marketing pemegang klien">
        <Lock className="w-3 h-3" /> Terbatas
      </span>
    );
  }
  return <span className={cx('tabular-nums', className)}>{value === undefined ? '–' : fmtRp(value)}</span>;
};

export const AttachmentChip: React.FC<{ a: Attachment; clientId?: string; entity?: string; entityId?: string }> = ({ a, clientId, entity = 'lampiran', entityId = a.id }) => {
  const { access, actions } = useStore();
  const allowed = access.attachment(a, clientId);
  const open = () => {
    if (!allowed) return;
    if (a.priced) actions.openAttachment(a.fileName, entity, entityId);
    toast(`Pratinjau ${a.fileName} (simulasi)${a.priced ? ' · akses dicatat di audit log' : ''}`);
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={!allowed}
      title={allowed ? 'Buka lampiran' : 'Lampiran berisi harga: hanya Marketing pemegang klien, Finance, BOD (dan Pengadaan untuk BOQ)'}
      className={cx('inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs text-left max-w-full', allowed ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200' : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed')}
    >
      {allowed ? <Paperclip className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
      <span className="font-medium shrink-0">{a.kind}:</span>
      <span className="truncate">{allowed ? a.fileName : 'berisi harga, tidak bisa dibuka'}</span>
    </button>
  );
};

export const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }> = ({ label, required, hint, children, className }) => (
  <label className={cx('block', className)}>
    <span className="block text-xs font-semibold text-slate-700 mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
    {children}
    {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
  </label>
);

export const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500';

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
/** Input tanggal bawaan browser (formatnya ikut bahasa browser) + tanggal tertulis di bawahnya supaya tidak salah baca hari/bulan. */
export const DateInput = (p: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) => (
  <div className="min-w-0">
    <input {...p} type="date" className={cx(inputCls, p.className)} />
    {typeof p.value === 'string' && p.value && <div className="text-xs text-slate-600 mt-1">{fmtDate(p.value)}</div>}
  </div>
);
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(inputCls, p.className)} />;

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative w-full sm:w-72">
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Cari…'} className={cx(inputCls, 'pl-9')} />
  </div>
);

export const Modal: React.FC<{ open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({ open, title, onClose, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const ErrorText: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  children ? <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{children}</p> : null;

export const Empty: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="text-center py-10 px-4">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    {children && <div className="text-xs text-slate-500 mt-1">{children}</div>}
  </div>
);

export const Tabs: React.FC<{ tabs: { key: string; label: React.ReactNode }[]; value: string; onChange: (k: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-4 -mx-1 px-1">
    {tabs.map(t => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className={cx('px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px', value === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
      >
        {t.label}
      </button>
    ))}
  </div>
);

/** Tabel dengan scroll horizontal di dalam kartu (halaman tetap tidak scroll ke samping). */
export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }> = ({ head, children, empty }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50/60">
          {head.map((h, i) => (
            <th key={i} className="px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
    {empty}
  </div>
);
export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => <td className={cx('px-4 py-3 align-top', className)}>{children}</td>;

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone }> = ({ label, value, hint, tone }) => (
  <div className={cx('rounded-xl border p-4 bg-white', tone === 'red' ? 'border-rose-200' : tone === 'amber' ? 'border-amber-200' : 'border-slate-200')}>
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className={cx('text-2xl font-bold mt-1 tabular-nums', tone === 'red' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900')}>{value}</div>
    {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
  </div>
);

export const DL: React.FC<{ items: [React.ReactNode, React.ReactNode][] }> = ({ items }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
    {items.map(([k, v], i) => (
      <div key={i} className="min-w-0">
        <dt className="text-xs font-semibold text-slate-500">{k}</dt>
        <dd className="text-slate-800 mt-0.5 break-words">{v}</dd>
      </div>
    ))}
  </dl>
);

/** Ekspor sederhana ke CSV (bisa dibuka di Excel). */
export const exportCsv = (filename: string, rows: (string | number)[][]) => {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const ExportBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Btn variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={onClick}>
    Ekspor Excel
  </Btn>
);

// ---------------- Toast ----------------
type ToastMsg = { id: number; text: string; tone: 'ok' | 'err' };
let pushToast: (t: Omit<ToastMsg, 'id'>) => void = () => {};
export const toast = (text: string, tone: 'ok' | 'err' = 'ok') => pushToast({ text, tone });

export const Toaster: React.FC = () => {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = t => {
      const id = Date.now() + Math.random();
      setItems(x => [...x, { ...t, id }]);
      setTimeout(() => setItems(x => x.filter(y => y.id !== id)), 3500);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] space-y-2">
      {items.map(t => (
        <div key={t.id} className={cx('px-4 py-3 rounded-lg shadow-lg text-sm font-medium sm:max-w-sm', t.tone === 'ok' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white')}>
          {t.text}
        </div>
      ))}
    </div>
  );
};

/** Jalankan aksi store dan tampilkan toast; kembalikan true bila berhasil. */
export const runAction = (r: { ok: boolean; error?: string }, okText: string, setErr?: (e: string) => void) => {
  if (r.ok) {
    toast(okText);
    setErr?.('');
    return true;
  }
  if (setErr) setErr(r.error ?? 'Gagal'); else toast(r.error ?? 'Gagal', 'err');
  return false;
};

const DOC_PERM: [string, Perm][] = [['/fpk/', 'fpk.view'], ['/spk/', 'spk.view'], ['/memo/', 'memo.view'], ['/security/', 'security.view']];
/** Link ke dokumen yang hanya jadi link bila user boleh membukanya; selain itu teks biasa (tidak menyesatkan ke halaman 404). */
export const DocLink: React.FC<{ to: string; className?: string; children: React.ReactNode }> = ({ to, className, children }) => {
  const { access } = useStore();
  const perm = DOC_PERM.find(([p]) => to.startsWith(p))?.[1];
  if (perm && !access.can(perm)) return <span className={(className ?? '').replace(/text-indigo-\d+|hover:underline/g, '')}>{children}</span>;
  return <Link to={to} className={className}>{children}</Link>;
};
