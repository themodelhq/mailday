'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    tagline: 'For personal use',
    features: ['1 mailbox', '10 GB storage', 'AI drafts (50/mo)', 'Offline PWA', 'Priority inbox'],
    cta: 'Get started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/mo',
    tagline: 'For power users',
    features: ['Unlimited mailboxes', '1 TB storage', 'Unlimited AI', 'Custom domains', 'Smart follow-ups', 'Priority support'],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Business',
    price: '$24',
    period: '/mo',
    tagline: 'For teams',
    features: ['Everything in Pro', 'Admin console', 'SSO / SAML', 'Audit logs', 'Data residency', 'SLA 99.9%'],
    cta: 'Contact sales',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, scalable pricing</h2>
          <p className="mt-3 text-slate-500">Start free. Upgrade when your inbox (and team) grows.</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`card relative flex flex-col p-6 ${t.highlight ? 'ring-2 ring-brand-500' : ''}`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p className="text-sm text-slate-500">{t.tagline}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-extrabold">{t.price}</span>
                {t.period && <span className="mb-1 text-sm text-slate-500">{t.period}</span>}
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <span className="text-slate-600 dark:text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={`mt-8 ${t.highlight ? 'btn-primary' : 'btn-ghost border border-slate-300 dark:border-white/10'}`}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
