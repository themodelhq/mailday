import Link from 'next/link';

export default function Cta() {
  return (
    <section id="status" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-14 text-center text-white shadow-xl">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to reclaim your inbox?</h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          Join MailDay and let AI handle the busywork. Free to start — no credit card required.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn bg-white text-brand-700 hover:bg-brand-50 px-6 py-3 text-base">
            Create your account
          </Link>
          <Link href="/login" className="btn border border-white/40 px-6 py-3 text-base hover:bg-white/10">
            Sign in
          </Link>
        </div>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm">
          <span className="h-2 w-2 rounded-full bg-green-400" /> All systems operational
        </div>
      </div>
    </section>
  );
}
