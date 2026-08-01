'use client';

import { Star, Paperclip, Mail } from 'lucide-react';
import { MessageSummary } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

export default function MailList({
  items,
  loading,
  selectedId,
  onSelect,
}: {
  items: MessageSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="w-full max-w-xl space-y-2 overflow-y-auto p-3 lg:border-r lg:border-slate-200/70 lg:dark:border-white/10">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="card flex gap-3 p-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center justify-center gap-3 p-10 text-center text-slate-400 lg:border-r lg:border-slate-200/70 lg:dark:border-white/10">
        <Mail className="h-10 w-10" />
        <p className="text-sm">No messages here yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-2 overflow-y-auto p-3 lg:border-r lg:border-slate-200/70 lg:dark:border-white/10">
      {items.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={cn(
            'card flex w-full gap-3 p-3 text-left transition-colors',
            selectedId === m.id ? 'ring-2 ring-brand-500' : 'hover:bg-slate-50 dark:hover:bg-white/5',
            !m.isRead && 'border-l-4 border-l-brand-500',
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-sm font-semibold text-brand-600">
            {m.from.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('truncate text-sm', !m.isRead ? 'font-semibold' : '')}>{m.from}</span>
              <span className="shrink-0 text-xs text-slate-400">{timeAgo(m.sentAt)}</span>
            </div>
            <div className="truncate text-sm">{m.subject || '(no subject)'}</div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="truncate">{m.snippet}</span>
              {m.isStarred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
              {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0" />}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
