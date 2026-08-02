'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Users,
  Mail,
  Trash2,
  Loader2,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { adminApi, AdminUser } from '@/lib/api';
import { useAppSelector } from '@/hooks';
import { timeAgo } from '@/lib/utils';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const role = useAppSelector((s) => s.session.role);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const page = 1;

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  const users = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => adminApi.users({ page, limit: 20, search }),
  });
  const messages = useQuery({
    queryKey: ['admin', 'messages', 1],
    queryFn: () => adminApi.messages({ page: 1, limit: 10 }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: 'USER' | 'ADMIN'; isActive?: boolean } }) =>
      adminApi.updateUser(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
  const removeUser = useMutation({
    mutationFn: (id: string) => adminApi.removeUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  if (role !== 'ADMIN') {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">Admin access required</h1>
          <p className="mt-1 text-sm text-slate-500">Your account does not have administrator privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand-500" />
          <h1 className="text-xl font-semibold">Admin console</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Platform overview, users and message moderation.</p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Users" value={stats.data?.totalUsers ?? '—'} />
          <StatCard label="Messages" value={stats.data?.totalMessages ?? '—'} />
          <StatCard label="Admins" value={stats.data?.admins ?? '—'} />
          <StatCard label="New (24h)" value={stats.data?.activeToday ?? '—'} />
        </div>

        {stats.data && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(stats.data.byMailbox).map(([k, v]) => (
              <span key={k} className="rounded-full bg-brand-600/10 px-2.5 py-1 text-xs font-medium text-brand-600">
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        {/* Users */}
        <div className="card mt-8 p-5">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-brand-500" />
            <h2 className="font-semibold">Users</h2>
            <div className="relative ml-auto w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Mail</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {users.isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : (
                  users.data?.items.map((u: AdminUser) => (
                    <tr key={u.id} className="border-t border-slate-200/70 dark:border-white/10">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{u.displayName}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          className="input !w-auto py-1"
                          value={u.role}
                          onChange={(e) =>
                            updateUser.mutate({ id: u.id, body: { role: e.target.value as 'USER' | 'ADMIN' } })
                          }
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            u.isActive ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
                          }`}
                          onClick={() => updateUser.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                        >
                          {u.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{u._count?.messages ?? 0}</td>
                      <td className="py-2 text-right">
                        <button
                          className="btn-ghost h-8 w-8 !px-0"
                          title="Delete user"
                          onClick={() => {
                            if (confirm(`Delete ${u.email}?`)) removeUser.mutate(u.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {users.data && (
            <p className="mt-3 text-xs text-slate-400">
              {users.data.total} user{users.data.total === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {/* Recent messages */}
        <div className="card mt-6 p-5">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-brand-500" />
            <h2 className="font-semibold">Recent messages</h2>
          </div>
          <div className="mt-4 space-y-2">
            {messages.isLoading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
            ) : (
              messages.data?.items.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-2 dark:border-white/10">
                  <span className="rounded-md bg-brand-600/10 px-2 py-0.5 text-xs font-medium text-brand-600">
                    {m.mailbox}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.subject || '(no subject)'}</div>
                    <div className="truncate text-xs text-slate-400">
                      {m.from} → {m.to.join(', ')}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(m.sentAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
