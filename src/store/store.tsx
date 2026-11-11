import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type {
  Area, AuditEntry, Client, Delegation, Fpk, Holiday, Memo, Notification, Personnel, Position,
  Setting, Site, SiteAssignment, Spk, Task, User, RefType,
} from '../domain/types';
import * as seed from '../domain/seed';
import { NOW, SEED_TODAY, setToday } from '../domain/time';
import { can as canPerm, canSeeArea, canSeeMoney, canOpenAttachment, isBodLike, type Perm } from '../domain/rbac';
import { taskReason, escalationOf, escalationHeadRole, resolveAssignee, type TaskCtx } from '../domain/tasks';
import { buildFpkActions } from './fpkActions';
import { buildSpkActions } from './spkActions';
import { buildMemoActions } from './memoActions';
import { buildTaskActions } from './taskActions';
import { buildDailyActions } from './dailyJob';
import { validateMemoOrder, validateSetting } from '../domain/settings';

export interface State {
  users: User[];
  areas: Area[];
  clients: Client[];
  sites: Site[];
  positions: Position[];
  assignments: SiteAssignment[];
  settings: Setting[];
  holidays: Holiday[];
  delegations: Delegation[];
  fpks: Fpk[];
  spks: Spk[];
  memos: Memo[];
  personnel: Personnel[];
  tasks: Task[];
  notifications: Notification[];
  audit: AuditEntry[];
  currentUserId: string;
  seq: number;
  /** Tanggal simulasi (disimpan di state supaya tampilan ikut dihitung ulang saat tanggal dimajukan). */
  today: string;
}

const initialState = (): State => ({
  users: seed.SEED_USERS,
  areas: seed.SEED_AREAS,
  clients: seed.SEED_CLIENTS,
  sites: seed.SEED_SITES,
  positions: seed.SEED_POSITIONS,
  assignments: seed.SEED_ASSIGNMENTS,
  settings: seed.DEFAULT_SETTINGS,
  holidays: seed.SEED_HOLIDAYS,
  delegations: seed.SEED_DELEGATIONS,
  fpks: seed.SEED_FPKS,
  spks: seed.SEED_SPKS,
  memos: seed.SEED_MEMOS,
  personnel: seed.SEED_PERSONNEL,
  tasks: seed.SEED_TASKS,
  notifications: seed.SEED_NOTIFICATIONS,
  audit: seed.SEED_AUDIT,
  currentUserId: 'u-mkt1',
  seq: 100,
  today: SEED_TODAY,
});

export type Result = { ok: true; id?: string } | { ok: false; error: string };
export const ok = (id?: string): Result => ({ ok: true, id });
export const fail = (error: string): Result => ({ ok: false, error });

/** Alat bantu untuk aksi: draft state yang boleh diubah langsung + pencatat audit/notifikasi. */
export interface Tx {
  s: State;
  me: User;
  id: (prefix: string) => string;
  audit: (e: Omit<AuditEntry, 'id' | 'at' | 'actorId'> & { actorId?: string }) => void;
  notify: (text: string, toUserIds: (string | undefined)[], ref?: { refType: RefType; refId: string }) => void;
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
  closeTasks: (pred: (t: Task) => boolean, status?: Task['status']) => void;
}

const makeTx = (s: State): Tx => {
  const me = s.users.find(u => u.id === s.currentUserId)!;
  const id = (prefix: string) => `${prefix}-${++s.seq}`;
  return {
    s,
    me,
    id,
    audit: e => s.audit.unshift({ id: id('au'), at: NOW, actorId: e.actorId ?? me.id, ...e }),
    notify: (text, to, ref) => {
      const toUserIds = [...new Set(to.filter(Boolean) as string[])];
      if (toUserIds.length) s.notifications.unshift({ id: id('n'), at: NOW, text, toUserIds, readBy: [], ...ref });
    },
    addTask: t => s.tasks.unshift({ ...t, id: id('t'), createdAt: NOW.slice(0, 10), status: 'terbuka' }),
    closeTasks: (pred, status = 'selesai') => {
      s.tasks.forEach(t => {
        if (t.status === 'terbuka' && pred(t)) {
          t.status = status;
          t.doneBy = me.id;
          t.doneAt = NOW;
        }
      });
    },
  };
};

/** Konteks mesin tugas dari state (dipakai tampilan dan aksi). */
export const makeTaskCtx = (st: State): TaskCtx => {
  const siteOf = (t: Task) => {
    if (t.refType === 'fpk') return st.fpks.find(f => f.id === t.refId)?.versions.at(-1)?.siteId;
    if (t.refType === 'spk') return st.spks.find(x => x.id === t.refId)?.siteId;
    if (t.refType === 'memo') { const m = st.memos.find(x => x.id === t.refId); return st.spks.find(x => x.id === m?.spkId)?.siteId; }
    return undefined;
  };
  return {
    delegations: st.delegations,
    settings: st.settings,
    holidays: st.holidays,
    creatorOf: t => (t.refType === 'fpk' ? st.fpks.find(f => f.id === t.refId)?.createdBy
      : t.refType === 'spk' ? st.spks.find(x => x.id === t.refId)?.inputBy
      : t.refType === 'memo' ? st.memos.find(x => x.id === t.refId)?.createdBy : undefined),
    areaOf: t => { const sid = siteOf(t); return sid ? st.sites.find(x => x.id === sid)?.areaId : undefined; },
    users: st.users,
  };
};

const useStoreValue = () => {
  const [state, setState] = useState<State>(initialState);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  /** Jalankan aksi pada salinan state; bila validasi gagal, state tidak berubah. */
  const exec = useCallback((fn: (tx: Tx) => Result): Result => {
    const draft: State = structuredClone(stateRef.current);
    const result = fn(makeTx(draft));
    if (result.ok) {
      stateRef.current = draft;
      setState(draft);
    }
    return result;
  }, []);

  const me = state.users.find(u => u.id === state.currentUserId)!;

  const lookups = useMemo(() => {
    const by = <T extends { id: string }>(arr: T[]) => new Map(arr.map(x => [x.id, x]));
    return {
      user: by(state.users),
      area: by(state.areas),
      client: by(state.clients),
      site: by(state.sites),
      position: by(state.positions),
      fpk: by(state.fpks),
      spk: by(state.spks),
      personnel: by(state.personnel),
      memo: by(state.memos),
    };
  }, [state]);

  const taskCtx: TaskCtx = useMemo(() => makeTaskCtx(state), [state]);

  const access = useMemo(() => ({
    can: (p: Perm) => canPerm(me, p, state.delegations),
    money: (clientId?: string) => canSeeMoney(me, clientId, state.clients, state.delegations),
    area: (areaId: string) => canSeeArea(me, areaId, state.delegations),
    /** true bila user tidak dibatasi lingkup area. */
    allAreas: () => canSeeArea(me, '*', state.delegations),
    attachment: (a: Parameters<typeof canOpenAttachment>[1], clientId?: string) => canOpenAttachment(me, a, clientId, state.clients, state.delegations),
    bodLike: () => isBodLike(me, state.delegations),
  }), [me, state.delegations, state.clients]);

  const myTasks = useMemo(
    () => state.tasks
      .map(t => ({ task: t, reason: taskReason(me, t, taskCtx), esc: escalationOf(t, state.settings, state.holidays) }))
      .filter(x => x.reason !== null)
      .sort((a, b) => a.task.dueAt.localeCompare(b.task.dueAt)),
    [state.tasks, me, taskCtx, state.settings, state.holidays],
  );

  const myNotifications = state.notifications.filter(n => n.toUserIds.includes(me.id));

  const actions = useMemo(() => ({
    switchUser: (id: string) => setState(s => ({ ...s, currentUserId: id })),
    markAllRead: () => exec(tx => {
      tx.s.notifications.forEach(n => { if (n.toUserIds.includes(tx.me.id) && !n.readBy.includes(tx.me.id)) n.readBy.push(tx.me.id); });
      return ok();
    }),
    reset: () => { setToday(SEED_TODAY); const fresh = initialState(); stateRef.current = fresh; setState(fresh); },
    ...buildDailyActions(exec),
    ...buildMasterActions(exec),
    ...buildFpkActions(exec),
    ...buildSpkActions(exec),
    ...buildMemoActions(exec),
    ...buildTaskActions(exec, () => makeTaskCtx(stateRef.current)),
  }), [exec]);

  return { state, me, lookups, access, myTasks, myNotifications, taskCtx, actions };
};

// ---------------- Aksi master data & admin ----------------

const norm = (s: string) => s.trim().toLowerCase();

function buildMasterActions(exec: (fn: (tx: Tx) => Result) => Result) {
  return {
    saveArea: (a: Area) => exec(tx => {
      if (!a.code.trim() || !a.name.trim()) return fail('Kode dan nama wajib diisi.');
      if (tx.s.areas.some(x => x.id !== a.id && norm(x.code) === norm(a.code))) return fail('Kode area sudah dipakai.');
      if (tx.s.areas.some(x => x.id !== a.id && norm(x.name) === norm(a.name))) return fail('Nama area sudah dipakai.');
      const i = tx.s.areas.findIndex(x => x.id === a.id);
      const before = i >= 0 ? tx.s.areas[i] : undefined;
      if (before && before.picUserId !== a.picUserId) {
        // Ganti PIC area: tugas terbuka pindah ke PIC baru.
        tx.s.tasks.forEach(t => {
          if (t.status === 'terbuka' && t.assigneeRole === 'PIC Area' && t.assigneeUserId === before.picUserId) {
            const siteId = t.refType === 'fpk' ? tx.s.fpks.find(f => f.id === t.refId)?.versions.at(-1)?.siteId : undefined;
            const areaId = siteId ? tx.s.sites.find(x => x.id === siteId)?.areaId : undefined;
            if (areaId === a.id) t.assigneeUserId = a.picUserId;
          }
        });
      }
      const saved = i >= 0 ? a : { ...a, id: tx.id('a') };
      if (i >= 0) tx.s.areas[i] = saved; else tx.s.areas.push(saved);
      // Cakupan PIC ikut data area: PIC/backup baru mendapat area ini, PIC lama yang tidak lagi memegangnya kehilangan cakupan.
      const holders = new Set([saved.picUserId, saved.backupPicUserId].filter(Boolean) as string[]);
      const name = (id: string) => tx.s.users.find(u => u.id === id)?.name ?? id;
      tx.s.users.forEach(u => {
        if (!u.roles.includes('PIC Area')) return;
        const hadIt = u.areaIds.includes(saved.id);
        if (holders.has(u.id) && !hadIt) {
          u.areaIds = [...u.areaIds, saved.id];
          tx.audit({ entity: 'pengguna', entityId: u.id, action: `Cakupan PIC: tambah ${saved.name}`, after: name(u.id) });
        } else if (!holders.has(u.id) && hadIt && before && (before.picUserId === u.id || before.backupPicUserId === u.id)) {
          u.areaIds = u.areaIds.filter(x => x !== saved.id);
          tx.audit({ entity: 'pengguna', entityId: u.id, action: `Cakupan PIC: lepas ${saved.name}`, after: name(u.id) });
        }
      });
      tx.audit({ entity: 'area', entityId: saved.id, action: i >= 0 ? 'Ubah area' : 'Buat area', before: before ? `${before.code} ${before.name}${before.active ? '' : ' (nonaktif)'}` : undefined, after: `${a.code} ${a.name}${a.active ? '' : ' (nonaktif)'}` });
      return ok();
    }),

    saveClient: (c: Client) => exec(tx => {
      if (!c.code.trim() || !c.name.trim() || !c.billingAddress.trim()) return fail('Kode, nama, dan alamat penagihan wajib diisi.');
      if (!c.accountOwnerId) return fail('Account owner wajib diisi.');
      if (tx.s.clients.some(x => x.id !== c.id && norm(x.code) === norm(c.code))) return fail('Kode klien sudah dipakai.');
      if (tx.s.clients.some(x => x.id !== c.id && norm(x.name) === norm(c.name))) return fail('Nama klien sudah dipakai.');
      const i = tx.s.clients.findIndex(x => x.id === c.id);
      const before = i >= 0 ? tx.s.clients[i] : undefined;
      if (i >= 0) tx.s.clients[i] = c; else tx.s.clients.push({ ...c, id: tx.id('c') });
      if (before && before.accountOwnerId !== c.accountOwnerId) {
        const name = (id: string) => tx.s.users.find(u => u.id === id)?.name ?? id;
        tx.audit({ entity: 'klien', entityId: c.id, action: 'Ganti account owner', before: name(before.accountOwnerId), after: name(c.accountOwnerId) });
        tx.notify(`Account owner ${c.name} diganti dari ${name(before.accountOwnerId)} ke ${name(c.accountOwnerId)}.`, [before.accountOwnerId, c.accountOwnerId], { refType: 'client', refId: c.id });
      } else {
        tx.audit({ entity: 'klien', entityId: c.id || 'baru', action: before ? 'Ubah klien' : 'Buat klien', after: `${c.code} ${c.name}${c.active ? '' : ' (nonaktif)'}` });
      }
      return ok();
    }),

    saveSite: (x: Site) => exec(tx => {
      if (!x.code.trim() || !x.name.trim() || !x.address.trim()) return fail('Kode, nama, dan alamat wajib diisi.');
      if (!x.clientId || !x.areaId) return fail('Site wajib punya klien dan area.');
      if (tx.s.sites.some(y => y.id !== x.id && norm(y.code) === norm(x.code))) return fail('Kode site sudah dipakai.');
      if (tx.s.sites.some(y => y.id !== x.id && y.clientId === x.clientId && norm(y.name) === norm(x.name))) return fail('Nama site sudah dipakai untuk klien ini.');
      const i = tx.s.sites.findIndex(y => y.id === x.id);
      const prevArea = i >= 0 ? tx.s.sites[i].areaId : undefined;
      if (i >= 0) tx.s.sites[i] = x; else tx.s.sites.push({ ...x, id: tx.id('s') });
      if (prevArea && prevArea !== x.areaId) {
        // Site pindah area: tugas terbuka PIC area dan Operasional ikut ke pemegang area baru.
        const area = tx.s.areas.find(a => a.id === x.areaId);
        const siteOf = (t: Task) => t.refType === 'fpk' ? tx.s.fpks.find(f => f.id === t.refId)?.versions.at(-1)?.siteId
          : t.refType === 'spk' ? tx.s.spks.find(y => y.id === t.refId)?.siteId
          : t.refType === 'memo' ? tx.s.spks.find(y => y.id === tx.s.memos.find(m => m.id === t.refId)?.spkId)?.siteId : undefined;
        tx.s.tasks.forEach(t => {
          if (t.status !== 'terbuka' || siteOf(t) !== x.id) return;
          const next = t.assigneeRole === 'PIC Area' ? area?.picUserId
            : t.assigneeRole === 'Operasional' ? resolveAssignee('Operasional', x.clientId, x.id, tx.s.assignments, tx.s.users, tx.s.sites) : undefined;
          if (!next || next === t.assigneeUserId) return;
          t.assigneeUserId = next;
          tx.audit({ entity: 'tugas', entityId: t.id, action: `Tugas ikut pindah area site ${x.name}: ${t.title}`, after: tx.s.users.find(u => u.id === next)?.name });
          tx.notify(`Site ${x.name} pindah ke area ${area?.name}. Tugas ini sekarang milik Anda: ${t.title}`, [next], { refType: t.refType, refId: t.refId });
        });
      }
      tx.audit({ entity: 'site', entityId: x.id || 'baru', action: i >= 0 ? 'Ubah site' : 'Buat site', after: `${x.code} ${x.name}${x.active ? '' : ' (nonaktif)'}` });
      return ok();
    }),

    savePosition: (x: Position) => exec(tx => {
      if (!x.code.trim() || !x.name.trim()) return fail('Kode dan nama wajib diisi.');
      if (tx.s.positions.some(y => y.id !== x.id && (norm(y.code) === norm(x.code) || norm(y.name) === norm(x.name)))) return fail('Kode atau nama jabatan sudah dipakai.');
      const i = tx.s.positions.findIndex(y => y.id === x.id);
      if (i >= 0) tx.s.positions[i] = x; else tx.s.positions.push({ ...x, id: tx.id('p') });
      tx.audit({ entity: 'jabatan', entityId: x.id || 'baru', action: i >= 0 ? 'Ubah jabatan' : 'Buat jabatan', after: `${x.code} ${x.name}${x.active ? '' : ' (nonaktif)'}` });
      return ok();
    }),

    saveAssignment: (a: SiteAssignment | null, removeId?: string) => exec(tx => {
      if (removeId) {
        tx.s.assignments = tx.s.assignments.filter(x => x.id !== removeId);
        tx.audit({ entity: 'divisi terkait', entityId: removeId, action: 'Hapus override divisi terkait' });
        return ok();
      }
      if (!a) return fail('Data kosong.');
      const existing = tx.s.assignments.find(x => x.clientId === a.clientId && (x.siteId ?? '') === (a.siteId ?? '') && x.division === a.division);
      const oldUser = existing?.userId;
      if (existing) existing.userId = a.userId; else tx.s.assignments.push({ ...a, id: tx.id('sa') });
      if (oldUser && oldUser !== a.userId) {
        // Tugas terbuka pindah ke orang baru.
        tx.s.tasks.forEach(t => {
          if (t.status === 'terbuka' && t.assigneeUserId === oldUser && t.division === a.division) {
            const clientId = t.refType === 'fpk' ? tx.s.fpks.find(f => f.id === t.refId)?.versions.at(-1)?.clientId : tx.s.spks.find(x => x.id === t.refId)?.clientId;
            if (clientId === a.clientId) t.assigneeUserId = a.userId;
          }
        });
      }
      const name = (id?: string) => tx.s.users.find(u => u.id === id)?.name ?? '–';
      tx.audit({ entity: 'divisi terkait', entityId: a.clientId, action: `Atur ${a.division}${a.siteId ? ' (per site)' : ' (default klien)'}`, before: name(oldUser), after: name(a.userId) });
      return ok();
    }),

    saveUser: (u: User) => exec(tx => {
      if (!u.name.trim() || !u.email.trim()) return fail('Nama dan email wajib diisi.');
      if (!u.roles.length) return fail('Pilih minimal satu peran.');
      if (tx.s.users.some(x => x.id !== u.id && norm(x.email) === norm(u.email))) return fail('Email sudah dipakai.');
      const i = tx.s.users.findIndex(x => x.id === u.id);
      const before = i >= 0 ? tx.s.users[i] : undefined;
      if (before) {
        // Nonaktif atau peran dicabut: jangan tinggalkan klien/area/tugas tanpa pemilik.
        const lostMkt = before.roles.includes('Marketing') && (!u.active || !u.roles.includes('Marketing'));
        const lostPic = before.roles.includes('PIC Area') && (!u.active || !u.roles.includes('PIC Area'));
        const owned = tx.s.clients.filter(c => c.accountOwnerId === u.id);
        if (lostMkt && owned.length) return fail(`Masih account owner ${owned.map(c => c.name).join(', ')}. Ganti account owner di data klien dulu.`);
        const picOf = tx.s.areas.filter(a => a.picUserId === u.id || a.backupPicUserId === u.id);
        if (lostPic && picOf.length) return fail(`Masih PIC area ${picOf.map(a => a.name).join(', ')}. Ganti PIC di data area dulu.`);
        if (lostMkt) tx.s.clients.forEach(c => { if (c.coOwnerIds.includes(u.id)) { c.coOwnerIds = c.coOwnerIds.filter(x => x !== u.id); tx.audit({ entity: 'klien', entityId: c.id, action: `Co-owner dilepas: ${u.name} (nonaktif/peran dicabut)` }); } });
        tx.s.tasks.forEach(t => {
          if (t.status !== 'terbuka' || t.assigneeUserId !== u.id) return;
          if (u.active && u.roles.includes(t.assigneeRole)) return;
          // Pindah ke kepala divisi; bila tidak ada, kembali ke semua user dengan peran itu.
          const head = tx.s.users.find(x => x.id !== u.id && x.active && x.headOf.includes(escalationHeadRole(t.assigneeRole)) && x.roles.includes(t.assigneeRole));
          t.assigneeUserId = head?.id;
          tx.audit({ entity: 'tugas', entityId: t.id, action: `Tugas dipindah (${u.name} nonaktif/peran dicabut): ${t.title}`, after: head?.name ?? `semua ${t.assigneeRole}` });
          if (head) tx.notify(`Tugas dipindah ke Anda karena ${u.name} nonaktif: ${t.title}`, [head.id], { refType: t.refType, refId: t.refId });
        });
      }
      if (i >= 0) tx.s.users[i] = u; else tx.s.users.push({ ...u, id: tx.id('u') });
      tx.audit({
        entity: 'user', entityId: u.id || 'baru', action: before ? 'Ubah user' : 'Buat user',
        before: before ? `${before.roles.join(', ')}${before.active ? '' : ' (nonaktif)'}` : undefined,
        after: `${u.roles.join(', ')}${u.active ? '' : ' (nonaktif)'}`,
      });
      return ok();
    }),

    updateSetting: (key: string, value: string) => exec(tx => {
      const st = tx.s.settings.find(x => x.key === key);
      if (!st) return fail('Kunci tidak ditemukan.');
      const err = validateSetting(key, value);
      if (err) return fail(err);
      const before = st.value;
      st.value = value.trim();
      const orderErr = key.startsWith('memo.') ? validateMemoOrder(tx.s.settings) : null;
      if (orderErr) return fail(orderErr);
      tx.audit({ entity: 'pengaturan', entityId: key, action: 'Ubah pengaturan', before, after: st.value });
      return ok();
    }),

    addHoliday: (h: Holiday) => exec(tx => {
      if (!h.date || !h.description.trim()) return fail('Tanggal dan keterangan wajib diisi.');
      if (tx.s.holidays.some(x => x.date === h.date)) return fail('Tanggal sudah ada.');
      tx.s.holidays.push(h);
      tx.s.holidays.sort((a, b) => a.date.localeCompare(b.date));
      tx.audit({ entity: 'kalender libur', entityId: h.date, action: 'Tambah libur', after: h.description });
      return ok();
    }),

    removeHoliday: (date: string) => exec(tx => {
      tx.s.holidays = tx.s.holidays.filter(x => x.date !== date);
      tx.audit({ entity: 'kalender libur', entityId: date, action: 'Hapus libur' });
      return ok();
    }),

    saveDelegation: (d: Delegation) => exec(tx => {
      if (!d.deputyUserId) return fail('Pilih wakil.');
      if (d.mode === 'periode' && (!d.startDate || !d.endDate)) return fail('Isi periode delegasi.');
      const i = tx.s.delegations.findIndex(x => x.id === d.id);
      if (i >= 0) tx.s.delegations[i] = d; else tx.s.delegations.push({ ...d, id: tx.id('d') });
      const name = (id: string) => tx.s.users.find(u => u.id === id)?.name ?? id;
      tx.audit({ entity: 'delegasi', entityId: d.id || 'baru', action: 'Atur delegasi BOD', after: `${name(d.deputyUserId)} (${d.mode})` });
      tx.notify(`Delegasi BOD aktif: ${name(d.deputyUserId)} (${d.mode === 'tetap' ? 'tetap' : 'periode'}).`, [d.bodUserId, d.deputyUserId]);
      return ok();
    }),
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<Store | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const v = useContext(StoreContext);
  if (!v) throw new Error('StoreProvider hilang');
  return v;
};
