import React, { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store/store';
import { match, navigate, usePath } from './router';
import { Sidebar } from './layout/Sidebar';
import { Topbar, homeFor } from './layout/Topbar';
import { Toaster } from './ui/kit';
import type { Perm } from './domain/rbac';
import { NoAccess, NotFound, Soon } from './pages/Misc';
import { TasksPage } from './pages/tasks/TasksPage';
import { DecisionsPage } from './pages/tasks/DecisionsPage';
import { AreasPage, AreaDetail } from './pages/master/Areas';
import { ClientsPage, ClientDetail } from './pages/master/Clients';
import { SitesPage, SiteDetail } from './pages/master/Sites';
import { PositionsPage } from './pages/master/Positions';
import { UsersPage } from './pages/admin/Users';
import { AssignmentsPage } from './pages/admin/Assignments';
import { SettingsPage } from './pages/admin/Settings';
import { DelegationPage } from './pages/admin/Delegation';
import { AuditPage } from './pages/admin/Audit';
import { FpkListPage } from './pages/fpk/FpkList';
import { FpkDetailPage } from './pages/fpk/FpkDetail';
import { FpkFormPage } from './pages/fpk/FpkForm';
import { SpkListPage } from './pages/spk/SpkList';
import { SpkDetailPage } from './pages/spk/SpkDetail';
import { SpkFormPage } from './pages/spk/SpkForm';
import { WithoutSpkPage } from './pages/spk/WithoutSpk';
import { SecurityPage, SecurityDetail } from './pages/people/Security';
import { MemoListPage, MemoNewPage, MemoDetailPage } from './pages/memo/Memo';

type Route = { path: string; perm: Perm; render: (p: Record<string, string>) => React.ReactNode };

const ROUTES: Route[] = [
  { path: '/tugas', perm: 'tasks.view', render: () => <TasksPage /> },
  { path: '/keputusan', perm: 'decisions.view', render: () => <DecisionsPage /> },
  { path: '/fpk', perm: 'fpk.view', render: () => <FpkListPage /> },
  { path: '/fpk/baru', perm: 'fpk.create', render: () => <FpkFormPage /> },
  { path: '/fpk/:id/ubah', perm: 'fpk.create', render: p => <FpkFormPage fpkId={p.id} /> },
  { path: '/fpk/:id', perm: 'fpk.view', render: p => <FpkDetailPage id={p.id} /> },
  { path: '/spk', perm: 'spk.view', render: () => <SpkListPage /> },
  { path: '/spk/input', perm: 'spk.input', render: () => <SpkFormPage /> },
  { path: '/spk/:id/revisi', perm: 'spk.input', render: p => <SpkFormPage reviseId={p.id} /> },
  { path: '/spk/:id', perm: 'spk.view', render: p => <SpkDetailPage id={p.id} /> },
  { path: '/jalan-tanpa-spk', perm: 'spk.view', render: () => <WithoutSpkPage /> },
  { path: '/memo', perm: 'memo.view', render: () => <MemoListPage /> },
  { path: '/memo/baru', perm: 'spk.input', render: () => <MemoNewPage /> },
  { path: '/memo/:id', perm: 'memo.view', render: p => <MemoDetailPage id={p.id} /> },
  { path: '/area', perm: 'master.view', render: () => <AreasPage /> },
  { path: '/area/:id', perm: 'master.view', render: p => <AreaDetail id={p.id} /> },
  { path: '/klien', perm: 'master.view', render: () => <ClientsPage /> },
  { path: '/klien/:id', perm: 'master.view', render: p => <ClientDetail id={p.id} /> },
  { path: '/site', perm: 'master.view', render: () => <SitesPage /> },
  { path: '/site/:id', perm: 'master.view', render: p => <SiteDetail id={p.id} /> },
  { path: '/jabatan', perm: 'master.view', render: () => <PositionsPage /> },
  { path: '/security', perm: 'security.view', render: () => <SecurityPage /> },
  { path: '/security/:id', perm: 'security.view', render: p => <SecurityDetail id={p.id} /> },
  { path: '/admin/pengguna', perm: 'admin.view', render: () => <UsersPage /> },
  { path: '/admin/divisi-terkait', perm: 'master.view', render: () => <AssignmentsPage /> },
  { path: '/admin/pengaturan', perm: 'admin.view', render: () => <SettingsPage /> },
  { path: '/admin/delegasi', perm: 'delegation.edit', render: () => <DelegationPage /> },
  { path: '/audit', perm: 'audit.view', render: () => <AuditPage /> },
  { path: '/dashboard', perm: 'dashboard.view', render: () => <Soon title="Dashboard eksekutif" note="Di luar PRD Rilis 1. Dashboard Direksi lengkap dibuat di rilis berikutnya." /> },
];

const Router: React.FC = () => {
  const path = usePath();
  const { me, access } = useStore();

  useEffect(() => {
    if (path === '/' || path === '/dashboard-lama') navigate(homeFor(me.roles));
  }, [path, me.roles]);

  for (const r of ROUTES) {
    const params = match(r.path, path);
    if (params) return access.can(r.perm) ? <>{r.render(params)}</> : <NoAccess />;
  }
  if (path === '/') return null;
  return <NotFound />;
};

const Shell: React.FC = () => {
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenu={() => setMenu(true)} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
          <Router />
        </main>
      </div>
      <Toaster />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
