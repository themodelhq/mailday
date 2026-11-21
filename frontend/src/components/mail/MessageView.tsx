'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Archive, Trash2, Reply, Loader2, Sparkles, FileText, Copy, X, Pencil, RefreshCw, CheckCircle2, AlertTriangle, Clock, Send } from 'lucide-react';
import { messagesApi, Message, aiApi, AiMode, AttachmentInfo, DeliveryStatus } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useAppDispatch } from '@/hooks';
import { openComposeWith } from '@/features/ui/uiSlice';

function stripHtml(html: string): string {
  if (!html) return '';
  const withoutDangerousBlocks = html.replace(
    /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ' ',
  );
  const text = withoutDangerousBlocks
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return text.replace(/[\t\r ]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
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

  const deliveryQuery = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => messagesApi.deliveryStatus(id),
    enabled: data?.mailbox === 'SENT',
    refetchInterval: (query) => {
      const status = (query.state.data as DeliveryStatus | undefined)?.status;
      return ['QUEUED', 'PROCESSING', 'RETRYING'].includes(status ?? '') ? 5000 : false;
    },
  });

  const retryDelivery = useMutation({
    mutationFn: () => messagesApi.retryDelivery(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', id] });
      invalidate();
    },
  });

  const { data: messageAttachments = [] } = useQuery({ queryKey: ['attachments', id], queryFn: () => messagesApi.attachments(id), enabled: Boolean(data?.hasAttachments) });

  const { data: threadMessages = [] } = useQuery({ queryKey: ['thread', data?.threadId], queryFn: () => messagesApi.thread(data!.threadId!), enabled: Boolean(data?.threadId), staleTime: 30_000 });

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
          {m.mailbox === 'DRAFT' && <button className="btn-primary" title="Edit draft" onClick={() => dispatch(openComposeWith({ to: m.to.join(', '), cc: m.cc.join(', '), bcc: m.bcc.join(', '), subject: m.subject, body: m.body, draftId: m.id }))}><Pencil className="h-4 w-4" /> Edit draft</button>}
          <button className="btn-ghost border border-slate-300 dark:border-white/10" title="Reply all" onClick={() => dispatch(openComposeWith({ to: [m.from, ...m.to].join(', '), cc: m.cc.join(', '), subject: `Re: ${m.subject}`, body: '', threadId: m.threadId ?? m.id, inReplyTo: m.id }))}><Reply className="h-4 w-4" /> Reply all</button>
          <button className="btn-ghost border border-slate-300 dark:border-white/10" title="Forward" onClick={() => dispatch(openComposeWith({ subject: `Fwd: ${m.subject}`, body: `\n\n---------- Forwarded message ----------\nFrom: ${m.from}\nTo: ${m.to.join(', ')}\nSubject: ${m.subject}\n\n${stripHtml(m.body)}` }))}><Reply className="h-4 w-4 rotate-180" /> Forward</button>
          <button className="btn-primary" title="Reply" onClick={() => dispatch(openComposeWith({ to: m.from, subject: `Re: ${m.subject}`, body: '', threadId: m.threadId ?? m.id, inReplyTo: m.id }))}>
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

      {m.mailbox === 'SENT' && deliveryQuery.data && <DeliveryPanel delivery={deliveryQuery.data} onRetry={() => retryDelivery.mutate()} retrying={retryDelivery.isPending} retryError={retryDelivery.error as Error | null} />}

      <div className="flex-1 overflow-y-auto p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {stripHtml(m.body)}
        </p>
        {messageAttachments.length > 0 && <section className="mt-6 rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <h3 className="mb-2 text-sm font-medium">Attachments ({messageAttachments.length})</h3>
          {messageAttachments.map((a: AttachmentInfo) => <div key={a.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="truncate">{a.originalName} <span className="text-xs text-slate-500">({Math.ceil(a.size / 1024)} KB)</span></span>
            <button className="btn-ghost text-xs" onClick={() => messagesApi.downloadAttachment(a.id, a.originalName)}>Download</button>
          </div>)}
        </section>}
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

function DeliveryPanel({ delivery, onRetry, retrying, retryError }: {
  delivery: DeliveryStatus;
  onRetry: () => void;
  retrying: boolean;
  retryError: Error | null;
}) {
  const statusStyles: Record<string, string> = {
    SENT: 'text-emerald-600 bg-emerald-500/10',
    QUEUED: 'text-blue-600 bg-blue-500/10',
    PROCESSING: 'text-blue-600 bg-blue-500/10',
    RETRYING: 'text-amber-600 bg-amber-500/10',
    FAILED: 'text-red-600 bg-red-500/10',
    BOUNCED: 'text-red-600 bg-red-500/10',
  };
  const statusIcons: Record<string, ReactNode> = {
    SENT: <CheckCircle2 className="h-4 w-4" />,
    QUEUED: <Clock className="h-4 w-4" />,
    PROCESSING: <Send className="h-4 w-4" />,
    RETRYING: <RefreshCw className="h-4 w-4 animate-spin" />,
    FAILED: <AlertTriangle className="h-4 w-4" />,
    BOUNCED: <AlertTriangle className="h-4 w-4" />,
  };
  return (
    <section className="border-b border-slate-200/70 bg-slate-50/70 px-5 py-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[delivery.status] ?? 'text-slate-500 bg-slate-500/10'}`}>
            {statusIcons[delivery.status]} {delivery.status}
          </span>
          <span className="text-xs text-slate-500">Attempts: {delivery.attempts}/{delivery.maxAttempts}</span>
          {delivery.sentAt && <span className="text-xs text-slate-500">Accepted {timeAgo(delivery.sentAt)} ago</span>}
        </div>
        {delivery.status === 'FAILED' && <button className="btn-ghost border border-slate-300 text-xs dark:border-white/10" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Retry delivery
        </button>}
      </div>
      {delivery.lastError && <p className="mt-2 text-xs text-red-500">{delivery.lastError}</p>}
      {retryError && <p className="mt-2 text-xs text-red-500">Retry failed: {retryError.message}</p>}
      {delivery.events?.length ? <div className="mt-3 border-t border-slate-200/70 pt-2 dark:border-white/10">
        <p className="mb-1 text-xs font-medium text-slate-500">Delivery events</p>
        <ul className="space-y-1.5">
          {delivery.events.slice(0, 5).map((event) => <li key={event.id} className="flex flex-wrap gap-x-2 text-xs text-slate-500">
            <span>{new Date(event.occurredAt).toLocaleString()}</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{event.eventType}</span>
            {event.recipient && <span>{event.recipient}</span>}
            {event.detail && <span>{event.detail}</span>}
          </li>)}
        </ul>
      </div> : null}
    </section>
  );
}
