'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <Mail className="h-5 w-5" />
          </span>
          <span className="tracking-tight">
            Mail<span className="text-brand-500">Day</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="hover:text-brand-600">Features</a>
          <a href="#pricing" className="hover:text-brand-600">Pricing</a>
          <a href="#faq" className="hover:text-brand-600">FAQ</a>
          <a href="#status" className="hover:text-brand-600">Status</a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </div>
      </div>
    </header>
  );
}
