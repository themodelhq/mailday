'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Mail, Github, Chrome } from 'lucide-react';
import { authApi, isAuthed } from '@/lib/api';
import { useAppDispatch } from '@/hooks';
import { setSession, clearSession } from '@/features/session/sessionSlice';
import { UserProfile } from '@/lib/api';

const schema = z.object({
  identifier: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isAuthed()) router.replace('/dashboard');
  }, [router]);

  async function onSubmit(values: FormValues) {
    try {
      await authApi.login(values);
      const me: UserProfile = await (await import('@/lib/api')).usersApi.me();
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
      router.push('/dashboard');
    } catch (e) {
      dispatch(clearSession());
      setError('root', { message: (e as Error).message });
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <Mail className="h-5 w-5" />
          </span>
          Mail<span className="text-brand-500">Day</span>
        </Link>

        <div className="card p-6">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your mailbox.</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="btn-ghost border border-slate-300 dark:border-white/10" type="button">
              <Chrome className="h-4 w-4" /> Google
            </button>
            <button className="btn-ghost border border-slate-300 dark:border-white/10" type="button">
              <Github className="h-4 w-4" /> GitHub
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            or with email
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email or username</label>
              <input className="input" placeholder="you@example.com" {...register('identifier')} />
              {errors.identifier && <p className="mt-1 text-xs text-red-500">{errors.identifier.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input className="input" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>
            {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
            <button className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          No account?{' '}
          <Link href="/signup" className="font-medium text-brand-600">Create one</Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Demo: <span className="font-mono">demo@mailday.app</span> / <span className="font-mono">demo1234</span>
        </p>
      </div>
    </main>
  );
}
