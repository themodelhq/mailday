'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Plug, RefreshCw, Trash2 } from 'lucide-react';
import { usersApi, mailApi } from '@/lib/api';
import { useAppDispatch } from '@/hooks';
import { setProfile } from '@/features/session/sessionSlice';
import { useAppSelector } from '@/hooks';

export default function SettingsPage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: usersApi.me });
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  const displayName = useAppSelector((s) => s.session.displayName);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');

  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);

  useEffect(() => {
    if (me) {
      setName(me.displayName);
      setAvatar(me.avatarUrl ?? '');
    }
  }, [me]);

  const save = useMutation({
    mutationFn: () => usersApi.update({ displayName: name, avatarUrl: avatar }),
    onSuccess: (updated) => {
      dispatch(setProfile({ displayName: updated.displayName, avatarUrl: updated.avatarUrl }));
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const accounts = useQuery({ queryKey: ['imap-accounts'], queryFn: mailApi.listImap });
  const connect = useMutation({
    mutationFn: () =>
      mailApi.connectImap({
        host,
        port: port ? Number(port) : undefined,
        username,
        password,
        secure,
      }),
    onSuccess: () => {
      setHost('');
      setPort('');
      setUsername('');
      setPassword('');
      qc.invalidateQueries({ queryKey: ['imap-accounts'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => mailApi.removeImap(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imap-accounts'] }),
  });
  const sync = useMutation({
    mutationFn: (id: string) => mailApi.syncImap(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imap-accounts'] });
      qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  return (
    <div className="overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile and connected mail.</p>

        <div className="card mt-6 space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Avatar URL</label>
            <input className="input" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input className="input" value={me?.email ?? ''} disabled />
          </div>
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          {save.isError && <p className="text-sm text-red-500">{(save.error as Error).message}</p>}
        </div>

        <div className="card mt-6 p-6">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-brand-500" />
            <h2 className="font-semibold">Connected mail accounts</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Connect an IMAP account to import incoming mail into your MailDay inbox automatically.
          </p>

          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              connect.mutate();
            }}
          >
            <input
              className="input"
              placeholder="IMAP host (e.g. imap.gmail.com)"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <input
                className="input w-24"
                placeholder="Port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} /> SSL
              </label>
            </div>
            <input
              className="input"
              placeholder="Username / email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="sm:col-span-2">
              <button className="btn-primary" type="submit" disabled={connect.isPending || !host}>
                {connect.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}{' '}
                Connect account
              </button>
              {connect.isError && (
                <p className="mt-2 text-sm text-red-500">{(connect.error as Error).message}</p>
              )}
            </div>
          </form>

          <div className="mt-5 space-y-2">
            {accounts.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : (
              accounts.data?.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-3 py-2 dark:border-white/10"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.host}</div>
                    <div className="truncate text-xs text-slate-400">
                      {a.username}
                      {a.lastError ? ` · error: ${a.lastError}` : ''}
                    </div>
                  </div>
                  <button
                    className="btn-ghost h-8 w-8 !px-0"
                    title="Sync now"
                    onClick={() => sync.mutate(a.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost h-8 w-8 !px-0"
                    title="Remove"
                    onClick={() => remove.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              ))
            )}
            {accounts.data && accounts.data.length === 0 && (
              <p className="text-sm text-slate-400">No connected accounts yet.</p>
            )}
          </div>
        </div>

        <div className="card mt-6 p-6 text-sm text-slate-500">
          <h2 className="font-medium text-slate-700 dark:text-slate-200">AI features & integrations</h2>
          <p className="mt-2">
            Semantic search, AI drafting/reply (z.ai), S3 attachments and OAuth/Passkeys are wired as
            documented integration points. Configure the relevant environment variables on the backend to enable them.
          </p>
        </div>
      </div>
    </div>
  );
}
