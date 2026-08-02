'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '@/hooks';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Topbar({
  mailbox,
  isFetching,
  onSignOut,
}: {
  mailbox: string;
  isFetching: boolean;
  onSignOut: () => void;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const displayName = useAppSelector((s) => s.session.displayName);
  const initial = (displayName ?? 'U').charAt(0).toUpperCase();

  const [search, setSearch] = useState(sp.get('search') ?? '');

  useEffect(() => {
    setSearch(sp.get('search') ?? '');
  }, [sp]);

  function updateSearch(value: string) {
    setSearch(value);
    const params = new URLSearchParams(sp.toString());
    if (value) params.set('search', value);
    else params.delete('search');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <header className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
      <h1 className="w-28 shrink-0 text-sm font-semibold capitalize">{mailbox.toLowerCase()}</h1>

      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          placeholder="Search mail…"
          className="input pl-9"
        />
      </div>

      <button
        className="btn-ghost h-9 w-9 !px-0"
        onClick={() => qc.invalidateQueries({ queryKey: ['messages'] })}
        aria-label="Refresh"
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </button>

      <ThemeToggle />

      <button className="btn-ghost h-9 w-9 !px-0" onClick={onSignOut} aria-label="Sign out" title="Sign out">
        <LogOut className="h-4 w-4" />
      </button>

      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
        {initial}
      </span>
    </header>
  );
}
