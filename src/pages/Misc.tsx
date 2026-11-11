import React from 'react';
import { Construction, SearchX } from 'lucide-react';
import { Link } from '../router';
import { useStore } from '../store/store';
import { homeFor } from '../layout/Topbar';

export const NotFound: React.FC<{ what?: string }> = ({ what }) => {
  const { me } = useStore();
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <SearchX className="w-10 h-10 text-slate-300 mx-auto" />
      <h1 className="text-lg font-bold mt-3">{what ?? 'Halaman'} tidak ditemukan</h1>
      <p className="text-sm text-slate-500 mt-1">Data tidak ada atau di luar lingkup akses Anda (sistem menjawab 404, bukan "dilarang", supaya data di area lain tidak terbaca).</p>
      <Link to={homeFor(me.roles)} className="inline-block mt-4 text-sm font-semibold text-indigo-600">Kembali ke halaman utama</Link>
    </div>
  );
};

export const NoAccess: React.FC = () => <NotFound />;

export const Soon: React.FC<{ title: string; note: string }> = ({ title, note }) => (
  <div className="max-w-lg mx-auto text-center py-16">
    <Construction className="w-10 h-10 text-slate-300 mx-auto" />
    <h1 className="text-lg font-bold mt-3">{title}</h1>
    <p className="text-sm text-slate-500 mt-1">{note}</p>
  </div>
);
