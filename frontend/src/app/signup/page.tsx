'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { authApi, isAuthed, usersApi, UserProfile } from '@/lib/api';
import { useAppDispatch } from '@/hooks';
import { setSession, clearSession } from '@/features/session/sessionSlice';

const schema = z
  .object({
    displayName: z.string().min(1, 'Enter your name'),
    email: z.string().email('Enter a valid email'),
    username: z.string().min(3, 'At least 3 characters'),
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
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
      await authApi.register({
        email: values.email,
        username: values.username,
        password: values.password,
        displayName: values.displayName,
      });
      const me: UserProfile = await usersApi.me();
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
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Free forever for personal use.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input className="input" placeholder="Ada Lovelace" {...register('displayName')} />
              {errors.displayName && <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input className="input" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <input className="input" placeholder="ada" {...register('username')} />
              {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Password</label>
                <input className="input" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirm</label>
                <input className="input" type="password" placeholder="••••••••" {...register('confirm')} />
                {errors.confirm && <p className="mt-1 text-xs text-red-500">{errors.confirm.message}</p>}
              </div>
            </div>
            {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
            <button className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
