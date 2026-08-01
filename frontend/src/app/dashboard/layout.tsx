'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { usersApi, isAuthed } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { setSession, clearSession } from '@/features/session/sessionSlice';
import Sidebar from '@/components/mail/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.session.status);

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: usersApi.me,
    enabled: isAuthed(),
    retry: false,
  });

  useEffect(() => {
    if (!isAuthed()) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (me) {
      dispatch(
        setSession({
          id: me.id,
          email: me.email,
          username: me.username,
          displayName: me.displayName,
          avatarUrl: me.avatarUrl,
          role: me.role,
        }),
      );
    }
  }, [me, dispatch]);

  useEffect(() => {
    if (isError) {
      dispatch(clearSession());
      router.replace('/login');
    }
  }, [isError, dispatch, router]);

  if (!isAuthed() || (isLoading && status !== 'authenticated')) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<div className="w-64 shrink-0 border-r border-slate-200/70 dark:border-white/10" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
