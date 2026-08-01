'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  Search,
  ShieldCheck,
  WifiOff,
  Calendar,
  CheckCheck,
  Bell,
  Lock,
} from 'lucide-react';

const features = [
  { icon: Bot, title: 'AI copilot', desc: 'Draft, reply, summarize threads and extract action items with one tap.' },
  { icon: Search, title: 'Smart search', desc: 'Find anything instantly with natural language and boolean filters.' },
  { icon: ShieldCheck, title: 'Enterprise security', desc: 'JWT auth, MFA-ready sessions, CSP, and OWASP-minded defaults.' },
  { icon: WifiOff, title: 'Offline mode', desc: 'Read, compose and queue mail — sends when you reconnect. Installable PWA.' },
  { icon: Calendar, title: 'Calendar & tasks', desc: 'Meeting detection turns emails into events and to-dos automatically.' },
  { icon: CheckCheck, title: 'Priority inbox', desc: 'Important mail surfaces first; newsletters and noise are tucked away.' },
  { icon: Bell, title: 'Smart reminders', desc: 'Get nudged to follow up on threads you might have forgotten.' },
  { icon: Lock, title: 'Your data', desc: 'Clear data model, export-ready, with encryption at rest by default.' },
];

export default function Features() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything your inbox needs</h2>
          <p className="mt-3 text-slate-500">
            A complete mail experience plus AI productivity — built as original, deployable code.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card p-5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600/10 text-brand-500">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
