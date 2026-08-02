'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Zap, Mail } from 'lucide-react';

const stats = [
  { label: 'Uptime', value: '99.98%' },
  { label: 'Avg. load', value: '<200ms' },
  { label: 'AI replies', value: '1-tap' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 sm:px-6 sm:pt-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(51,102,255,0.18),transparent)]" />
      <div className="mx-auto max-w-3xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-brand-600"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI copilot built into every inbox
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl"
        >
          Email, but <span className="text-brand-500">actually smart.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-slate-500 sm:text-lg"
        >
          MailDay is an enterprise-grade, offline-ready mailbox with an AI assistant that writes,
          summarizes, and organizes your mail — so you can reach inbox zero before your coffee gets cold.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Start for free
          </Link>
          <a href="#features" className="btn-ghost px-6 py-3 text-base">
            See features
          </a>
        </motion.div>

        <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-6 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-brand-500" /> Instant</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand-500" /> Private</span>
          <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4 text-brand-500" /> Everywhere</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4"
      >
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-bold text-brand-600">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
