'use client';

import { Star, Paperclip, Mail, AlertCircle, Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import { MessageSummary } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';

export default function MailList({
  items,
  loading,
  selectedId,
  onSelect,
  page,
  pages,
  total,
  onPageChange,
}: {
  items: MessageSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
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

  return (
    <div className="flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden lg:border-r lg:border-slate-200/70 lg:dark:border-white/10">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-slate-400">
            <Mail className="h-10 w-10" />
            <p className="text-sm">No messages here yet.</p>
          </div>
        ) : items.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            aria-pressed={selectedId === m.id}
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
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-sm">{m.subject || '(no subject)'}</div>
                {m.mailbox === 'SENT' && m.state === 'FAILED' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600"><AlertCircle className="h-3 w-3" /> Failed</span>}
                {m.mailbox === 'SENT' && m.state === 'QUEUED' && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600"><Clock3 className="h-3 w-3" /> Queued</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="truncate">{m.snippet}</span>
                {m.isStarred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0" />}
              </div>
            </div>
          </button>
        ))}
      </div>
      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200/70 px-3 py-2 text-xs text-slate-500 dark:border-white/10">
        <span>{total === 0 ? '0 messages' : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`}</span>
        <div className="flex items-center gap-1">
          <button className="btn-ghost h-8 w-8 !px-0" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center">{pages > 0 ? `${page} / ${pages}` : '—'}</span>
          <button className="btn-ghost h-8 w-8 !px-0" onClick={() => onPageChange(page + 1)} disabled={pages === 0 || page >= pages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
