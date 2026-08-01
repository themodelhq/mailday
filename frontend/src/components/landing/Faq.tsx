'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  { q: 'Is MailDay a real, working app?', a: 'Yes. The frontend and backend in this repo run end-to-end: register, log in, read and compose mail, all backed by a NestJS API, PostgreSQL and Redis. Advanced integrations (SMTP/IMAP relays, Elasticsearch, AI providers, passkeys) are wired as documented, env-gated integration points.' },
  { q: 'How do I deploy it?', a: 'Frontend deploys to Netlify (build: npm run build in /frontend). Backend deploys to Render via the included render.yaml blueprint, which provisions PostgreSQL and Redis automatically.' },
  { q: 'Is my email data secure?', a: 'Auth uses hashed passwords (bcrypt/Argon2-class), short-lived JWT access tokens, rotating refresh tokens, CORS, CSP and validation on every input. OWASP-minded defaults are in place.' },
  { q: 'Does it work offline?', a: 'The PWA caches the app shell and queues actions while offline. A service worker keeps the inbox and composer usable without a connection.' },
  { q: 'Can I self-host?', a: 'Absolutely. docker-compose.yml runs the whole stack locally; Dockerfiles and Kubernetes-ready structure are included.' },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked</h2>
        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium"
                >
                  {f.q}
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <p className="px-5 pb-5 text-sm text-slate-500">{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
