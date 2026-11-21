'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Send, Sparkles, Loader2, Paperclip, Download, Trash2 } from 'lucide-react';
import { messagesApi, aiApi, AiTone, usersApi, AttachmentInfo } from '@/lib/api';
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
  const { data: profile } = useQuery({ queryKey: ['me'], queryFn: usersApi.me });
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [threadId, setThreadId] = useState<string | undefined>();
  const [inReplyTo, setInReplyTo] = useState<string | undefined>();
  const [draftId, setDraftId] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [autosaveNotice, setAutosaveNotice] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<AiTone>('professional');
  const [aiError, setAiError] = useState('');
  const [deliveryNotice, setDeliveryNotice] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [uploading, setUploading] = useState(false);
  const { data: attachments = [] } = useQuery({ queryKey: ['attachments', draftId], queryFn: () => messagesApi.attachments(draftId!), enabled: Boolean(draftId) });

  // Prefill from a compose draft (e.g. an AI-generated reply) then clear it.
  useEffect(() => {
    if (open && (draft.draftId || draft.to || draft.subject || draft.body || draft.cc || draft.bcc)) {
      setTo(draft.to ?? '');
      setCc(draft.cc ?? '');
      setBcc(draft.bcc ?? '');
      setSubject(draft.subject ?? '');
      setBody(draft.body ?? '');
      setThreadId(draft.threadId);
      setInReplyTo(draft.inReplyTo);
      setDraftId(draft.draftId);
      setDirty(false);
      dispatch(clearComposeDraft());
    }
  }, [open, draft, dispatch]);

  const bodyWithSignature = () => { const sig = profile?.signature?.trim(); return sig && !body.includes(sig) ? `${body.trim()}\n\n${sig}` : body; };

  const send = useMutation({
    mutationFn: async () => {
      const key = idempotencyKey || crypto.randomUUID();
      if (draftId) {
        if (dirty) await messagesApi.update(draftId, { to: to.split(',').map(s => s.trim()).filter(Boolean), cc: cc.split(',').map(s => s.trim()).filter(Boolean), bcc: bcc.split(',').map(s => s.trim()).filter(Boolean), subject, body: bodyWithSignature() });
        return messagesApi.sendDraft(draftId, key, scheduledAt ? new Date(scheduledAt).toISOString() : undefined);
      }
      return messagesApi.create({
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        cc: cc.split(',').map((s) => s.trim()).filter(Boolean),
        bcc: bcc.split(',').map((s) => s.trim()).filter(Boolean),
        threadId, inReplyTo,
        subject,
        body: bodyWithSignature(),
        mailbox: 'SENT' as MailboxName,
        idempotencyKey: key,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
    },
    onSuccess: (message) => {
      setDeliveryNotice('Your message has been queued for delivery.');
      setIdempotencyKey('');
      setDraftId(undefined);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['messages'] });
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBody('');
      dispatch(closeCompose());
    },
  });

  const saveDraft = useMutation({
    mutationFn: () => {
      const payload = { to: to.split(',').map(s => s.trim()).filter(Boolean), cc: cc.split(',').map(s => s.trim()).filter(Boolean), bcc: bcc.split(',').map(s => s.trim()).filter(Boolean), subject, body, mailbox: 'DRAFT' as MailboxName };
      return draftId ? messagesApi.update(draftId, payload) : messagesApi.create(payload);
    },
    onSuccess: (saved) => { setDraftId(saved.id); setDirty(false); setAutosaveNotice('Draft saved'); qc.invalidateQueries({ queryKey: ['messages'] }); },
  });

  useEffect(() => {
    if (!open || !dirty) return;
    const timer = window.setTimeout(() => saveDraft.mutate(), 1200);
    return () => window.clearTimeout(timer);
  }, [open, dirty, to, cc, bcc, subject, body, draftId]);

  const generate = useMutation({
    mutationFn: () => aiApi.generate({ mode: 'draft', text: body || subject, subject, tone }),
    onSuccess: (res) => {
      setBody(res.text);
      setDirty(true);
      setAiError('');
    },
    onError: (e) => setAiError((e as Error).message),
  });

  const closeAndSave = () => { if (dirty) saveDraft.mutate(); dispatch(closeCompose()); };

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachmentError('');
    setUploading(true);
    try {
      let targetId = draftId;
      if (!targetId) {
        const saved = await saveDraft.mutateAsync();
        targetId = saved.id;
        setDraftId(targetId);
        setDirty(false);
      }
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) throw new Error('Each attachment must be 20 MB or smaller.');
        await messagesApi.uploadAttachment(targetId, file);
      }
      qc.invalidateQueries({ queryKey: ['attachments', targetId] });
      qc.invalidateQueries({ queryKey: ['messages'] });
    } catch (e) {
      setAttachmentError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={closeAndSave} />
      <div className="card relative z-10 m-3 w-full max-w-2xl animate-fade-up">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <h2 className="font-semibold">New message</h2>
          <button className="btn-ghost h-8 w-8 !px-0" onClick={closeAndSave}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <input
            className="input"
            placeholder="To (comma-separated emails)"
            value={to}
            onChange={(e) => { setTo(e.target.value); setDirty(true); }}
          />
          <input className="input" placeholder="CC (comma-separated emails)" value={cc} onChange={(e) => { setCc(e.target.value); setDirty(true); }} />
          <input className="input" placeholder="BCC (comma-separated emails)" value={bcc} onChange={(e) => { setBcc(e.target.value); setDirty(true); }} />
          <input
            className="input"
            placeholder="Subject"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
          />
          <textarea
            className="input min-h-[180px] resize-y"
            placeholder="Write your message…"
            value={body}
            onChange={(e) => { setBody(e.target.value); setDirty(true); }}
          />
          <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <label className="btn-ghost border border-slate-300 text-xs dark:border-white/10 cursor-pointer">
                <Paperclip className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Attach files'}
                <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => { void attachFiles(e.target.files); e.currentTarget.value = ''; }} />
              </label>
              <span className="text-xs text-slate-500">Maximum 20 MB per file</span>
            </div>
            {attachments.map((a: AttachmentInfo) => <div key={a.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{a.originalName} <span className="text-xs text-slate-500">({Math.ceil(a.size / 1024)} KB)</span></span>
              <div className="flex shrink-0 gap-1">
                <button className="btn-ghost h-7 w-7 !px-0" title="Download" onClick={() => messagesApi.downloadAttachment(a.id, a.originalName)}><Download className="h-3.5 w-3.5" /></button>
                <button className="btn-ghost h-7 w-7 !px-0 text-red-500" title="Remove" onClick={() => messagesApi.deleteAttachment(a.id).then(() => qc.invalidateQueries({ queryKey: ['attachments', draftId] }))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>)}
            {attachmentError && <p className="mt-2 text-xs text-red-500">{attachmentError}</p>}
          </div>
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
            <button className="btn-ghost border border-slate-300 dark:border-white/10" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? 'Saving…' : 'Save draft'}
            </button>
            <div className="flex flex-col gap-1">
              <input className="input text-xs" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-label="Schedule delivery" />
              <button className="btn-primary" onClick={() => send.mutate()} disabled={send.isPending || !(to || cc || bcc) || (scheduledAt && new Date(scheduledAt) <= new Date())}>
                <Send className="h-4 w-4" /> {send.isPending ? 'Queuing…' : scheduledAt ? 'Schedule send' : 'Queue send'}
              </button>
            </div>
          </div>
          {(autosaveNotice || saveDraft.isPending) && <p className="text-xs text-slate-500">{saveDraft.isPending ? 'Saving draft…' : autosaveNotice}</p>}
          {deliveryNotice && <p className="text-sm text-emerald-600">{deliveryNotice}</p>}
          {aiError && <p className="text-sm text-amber-500">AI unavailable: {aiError}</p>}
          {send.isError && <p className="text-sm text-red-500">{(send.error as Error).message}</p>}
        </div>
      </div>
    </div>
  );
}
