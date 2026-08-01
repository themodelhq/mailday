'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send, Sparkles, Loader2 } from 'lucide-react';
import { messagesApi, aiApi, AiTone } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { closeCompose, clearComposeDraft } from '@/features/ui/uiSlice';
import { MailboxName } from '@/lib/api';

const TONES: { value: AiTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'short', label: 'Shorter' },
  { value: 'expand', label: 'Expand' },
];

export default function ComposeModal() {
  const open = useAppSelector((s) => s.ui.composeOpen);
  const draft = useAppSelector((s) => s.ui.composeDraft);
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<AiTone>('professional');
  const [aiError, setAiError] = useState('');

  // Prefill from a compose draft (e.g. an AI-generated reply) then clear it.
  useEffect(() => {
    if (open && (draft.to || draft.subject || draft.body)) {
      setTo(draft.to ?? '');
      setSubject(draft.subject ?? '');
      setBody(draft.body ?? '');
      dispatch(clearComposeDraft());
    }
  }, [open, draft, dispatch]);

  const send = useMutation({
    mutationFn: () =>
      messagesApi.create({
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        body,
        mailbox: 'SENT' as MailboxName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      setTo('');
      setSubject('');
      setBody('');
      dispatch(closeCompose());
    },
  });

  const generate = useMutation({
    mutationFn: () => aiApi.generate({ mode: 'draft', text: body || subject, subject, tone }),
    onSuccess: (res) => {
      setBody(res.text);
      setAiError('');
    },
    onError: (e) => setAiError((e as Error).message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => dispatch(closeCompose())} />
      <div className="card relative z-10 m-3 w-full max-w-2xl animate-fade-up">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <h2 className="font-semibold">New message</h2>
          <button className="btn-ghost h-8 w-8 !px-0" onClick={() => dispatch(closeCompose())}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <input
            className="input"
            placeholder="To (comma-separated emails)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <input
            className="input"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="input min-h-[180px] resize-y"
            placeholder="Write your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost border border-slate-300 text-xs dark:border-white/10"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                type="button"
                title="Generate a draft with AI (requires ZAI_API_KEY on the backend)"
              >
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-brand-500" />
                )}
                AI draft
              </button>
              <select
                className="input !w-auto py-1 text-xs"
                value={tone}
                onChange={(e) => setTone(e.target.value as AiTone)}
                title="Tone"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={() => send.mutate()} disabled={send.isPending || !to}>
              <Send className="h-4 w-4" /> {send.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
          {aiError && <p className="text-sm text-amber-500">AI unavailable: {aiError}</p>}
          {send.isError && <p className="text-sm text-red-500">{(send.error as Error).message}</p>}
        </div>
      </div>
    </div>
  );
}
