import Link from 'next/link';
import { Mail } from 'lucide-react';

const columns = [
  { title: 'Product', links: ['Features', 'Pricing', 'Download', 'Changelog'] },
  { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
  { title: 'Legal', links: ['Privacy', 'Terms', 'Cookie Policy', 'Security'] },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 px-4 py-12 sm:px-6 dark:border-white/10">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
              <Mail className="h-5 w-5" />
            </span>
            Mail<span className="text-brand-500">Day</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            AI-powered email for people who live in their inbox. Private, fast, and available everywhere.
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold">{c.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {c.links.map((l) => (
                <li key={l}>
                  <a href="#" className="hover:text-brand-600">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-6xl text-xs text-slate-400">
        © {new Date().getFullYear()} MailDay. All rights reserved.
      </div>
    </footer>
  );
}
