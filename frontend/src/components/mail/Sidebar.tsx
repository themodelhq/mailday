'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Inbox,
  Star,
  Flame,
  Send,
  FileText,
  Archive,
  AlertOctagon,
  Trash2,
  PenSquare,
  Calendar,
  Users,
  CheckSquare,
  Settings,
  Shield,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { openCompose } from '@/features/ui/uiSlice';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: typeof Inbox;
  badge?: number;
  soon?: boolean;
}

const primary: NavItem[] = [
  { label: 'Inbox', href: '/dashboard?mailbox=INBOX', icon: Inbox },
  { label: 'Starred', href: '/dashboard?mailbox=INBOX&view=starred', icon: Star },
  { label: 'Important', href: '/dashboard?mailbox=INBOX&view=important', icon: Flame },
  { label: 'Sent', href: '/dashboard?mailbox=SENT', icon: Send },
  { label: 'Drafts', href: '/dashboard?mailbox=DRAFT', icon: FileText },
  { label: 'Archive', href: '/dashboard?mailbox=ARCHIVE', icon: Archive },
  { label: 'Spam', href: '/dashboard?mailbox=SPAM', icon: AlertOctagon },
  { label: 'Trash', href: '/dashboard?mailbox=TRASH', icon: Trash2 },
];

const secondary: NavItem[] = [
  { label: 'Calendar', href: '#', icon: Calendar, soon: true },
  { label: 'Contacts', href: '#', icon: Users, soon: true },
  { label: 'Tasks', href: '#', icon: CheckSquare, soon: true },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const sp = useSearchParams();
  const mailbox = sp.get('mailbox') ?? 'INBOX';
  const view = sp.get('view') ?? 'all';
  const activeKey = `${mailbox}:${view}`;
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector((s) => s.session.role === 'ADMIN');

  const isActive = (item: NavItem) => {
    const u = new URLSearchParams(item.href.split('?')[1] ?? '');
    return `${u.get('mailbox') ?? 'INBOX'}:${u.get('view') ?? 'all'}` === activeKey;
  };

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-slate-200/70 p-2 sm:w-64 sm:p-3 dark:border-white/10">
      <button onClick={() => dispatch(openCompose())} className="btn-primary w-full px-2 sm:px-4" aria-label="Compose email" title="Compose email">
        <PenSquare className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Compose</span>
      </button>

      <nav aria-label="Mailbox navigation" className="mt-4 flex-1 space-y-1 overflow-y-auto">
        {primary.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            aria-current={isActive(item) ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-colors sm:justify-start sm:px-3',
              isActive(item)
                ? 'bg-brand-600/10 text-brand-600'
                : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-white/5',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ))}

        <div className="my-3 h-px bg-slate-200/70 dark:bg-white/10" />

        {secondary.map((item) =>
          item.soon ? (
            <span
              key={item.label}
              title={`${item.label}: coming soon`}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center justify-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-slate-400 sm:justify-start sm:px-3"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="ml-auto hidden rounded-full bg-slate-200/70 px-1.5 text-[10px] sm:inline-flex dark:bg-white/10">soon</span>
            </span>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              className="flex items-center justify-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/50 sm:justify-start sm:px-3 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ),
        )}
      </nav>

      {isAdmin && (
        <>
          <div className="my-3 h-px bg-slate-200/70 dark:bg-white/10" />
          <Link
            href="/dashboard/admin"
            title="Admin"
            className="flex items-center justify-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/50 sm:justify-start sm:px-3 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </>
      )}
    </aside>
  );
}
