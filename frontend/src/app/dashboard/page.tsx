'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { messagesApi, authApi, MessageSummary } from '@/lib/api';
import { useAppDispatch } from '@/hooks';
import { clearSession } from '@/features/session/sessionSlice';
import Topbar from '@/components/mail/Topbar';
import MailList from '@/components/mail/MailList';
import MessageView from '@/components/mail/MessageView';
import ComposeModal from '@/components/mail/ComposeModal';

function MailApp() {
  const sp = useSearchParams();
  const mailbox = sp.get('mailbox') ?? 'INBOX';
  const view = sp.get('view') ?? 'all';
  const search = sp.get('search') ?? '';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dispatch = useAppDispatch();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['messages', mailbox, search],
    queryFn: () => messagesApi.list({ mailbox, search, limit: 20 }),
    staleTime: 15_000,
  });

  const items: MessageSummary[] = (data?.items ?? []).filter((m) => {
    if (view === 'starred') return m.isStarred;
    if (view === 'important') return m.isImportant;
    if (view === 'unread') return !m.isRead;
    return true;
  });

  const signOut = () => {
    authApi.logout();
    dispatch(clearSession());
    window.location.href = '/login';
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar mailbox={mailbox} isFetching={isFetching} onSignOut={signOut} />
      <div className="flex min-h-0 flex-1">
        <MailList
          items={items}
          loading={isLoading}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
        <div className="hidden min-w-0 flex-1 flex-col border-l border-slate-200/70 dark:border-white/10 md:flex">
          {selectedId ? (
            <MessageView id={selectedId} onClosed={() => setSelectedId(null)} />
          ) : (
            <EmptyReadingPane />
          )}
        </div>
      </div>
      <ComposeModal />
    </div>
  );
}

function EmptyReadingPane() {
  return (
    <div className="grid h-full place-items-center text-center text-slate-400">
      <div>
        <Mail className="mx-auto h-10 w-10" />
        <p className="mt-3 text-sm">Select a message to read it.</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <MailApp />
    </Suspense>
  );
}
