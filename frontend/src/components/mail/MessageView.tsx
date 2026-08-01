'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Archive, Trash2, Reply, Loader2, Sparkles, FileText, Copy, X } from 'lucide-react';
import { messagesApi, Message, aiApi, AiMode } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useAppDispatch } from '@/hooks';
import { openComposeWith } from '@/features/ui/uiSlice';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function MessageView({ id, onClosed }: { id: string; onClosed: () => void }) {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  const [ai, setAi] = useState<{ mode: AiMode; text: string } | null>(null);
  const [aiError, setAiError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['message', id],
    queryFn: () => messagesApi.get(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['message', id] });
    qc.invalidateQueries({ queryKey: ['messages'] });
  };

  const star = useMutation({
    mutationFn: () => messagesApi.update(id, { isStarred: !data?.isStarred }),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: () => messagesApi.update(id, { mailbox: 'ARCHIVE' }),
    onSuccess: () => {
      invalidate();
      onClosed();
    },
  });
  const trash = useMutation({
    mutationFn: () => messagesApi.update(id, { mailbox: 'TRASH' }),
    onSuccess: () => {
      invalidate();
      onClosed();
    },
  });
  const remove = useMutation({
    mutationFn: () => messagesApi.remove(id),
    onSuccess: () => {
      invalidate();
      onClosed();
    },
  });

  const aiGen = useMutation({
    mutationFn: (mode: AiMode) =>
      aiApi.generate({ mode, text: data ? stripHtml(data.body) : '', subject: data?.subject }),
    onSuccess: (res, mode) => {
      setAi({ mode, text: res.text });
      setAiError('');
    },
    onError: (e) => setAiError((e as Error).message),
  });

  if (isLoading || !data) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const m = data as Message;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 p-5 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{m.subject || '(no subject)'}</h2>
          <div className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-200">{m.from}</span> → {m.to.join(', ')}
          </div>
          <div className="text-xs text-slate-400">{timeAgo(m.sentAt)} ago</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="btn-ghost h-9 w-9 !px-0" onClick={() => star.mutate()} title="Star">
            <Star className={`h-4 w-4 ${m.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
          <button className="btn-ghost h-9 w-9 !px-0" onClick={() => archive.mutate()} title="Archive">
            <Archive className="h-4 w-4" />
          </button>
          <button className="btn-ghost h-9 w-9 !px-0" onClick={() => trash.mutate()} title="Move to trash">
            <Trash2 className="h-4 w-4" />
          </button>
          <button className="btn-primary" title="Reply" onClick={() => aiGen.mutate('reply')}>
            <Reply className="h-4 w-4" /> Reply
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 px-5 py-2 dark:border-white/10">
        <button
          className="btn-ghost border border-slate-300 text-xs dark:border-white/10"
          onClick={() => aiGen.mutate('reply')}
          disabled={aiGen.isPending}
        >
          {aiGen.isPending && aiGen.variables === 'reply' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-brand-500" />
          )}
          AI reply
        </button>
        <button
          className="btn-ghost border border-slate-300 text-xs dark:border-white/10"
          onClick={() => aiGen.mutate('summarize')}
          disabled={aiGen.isPending}
        >
          {aiGen.isPending && aiGen.variables === 'summarize' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 text-brand-500" />
          )}
          Summarize
        </button>
        {aiError && <span className="text-xs text-amber-500">AI unavailable: {aiError}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {stripHtml(m.body)}
        </p>
        {m.labels.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {m.labels
              .filter((l) => !l.startsWith('mid:'))
              .map((l) => (
                <span key={l} className="rounded-full bg-brand-600/10 px-2.5 py-1 text-xs font-medium text-brand-600">
                  {l}
                </span>
              ))}
          </div>
        )}
        <div className="mt-6 border-t border-slate-200/70 pt-4 dark:border-white/10">
          <button className="btn-ghost h-9 w-9 !px-0" onClick={() => remove.mutate()} title="Delete permanently">
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>

      {ai && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/40 p-4">
          <div className="card relative w-full max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
              <h3 className="font-semibold capitalize">{ai.mode === 'reply' ? 'Suggested reply' : 'Summary'}</h3>
              <button className="btn-ghost h-8 w-8 !px-0" onClick={() => setAi(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{ai.text}</pre>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
              <button
                className="btn-ghost"
                onClick={() => navigator.clipboard?.writeText(ai.text)}
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
              {ai.mode === 'reply' && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    dispatch(openComposeWith({ to: m.from, subject: `Re: ${m.subject}`, body: ai.text }));
                    setAi(null);
                  }}
                >
                  Use in reply
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
