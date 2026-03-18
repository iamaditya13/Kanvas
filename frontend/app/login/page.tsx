'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nextPath = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') || '/' : '/';

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message.includes('Invalid login credentials') ? 'Incorrect email or password.' : authError.message);
        return;
      }

      router.push(nextPath);
    } catch (loginError) {
      setError(getErrorMessage(loginError, 'Unable to sign in.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        throw oauthError;
      }
    } catch (oauthError) {
      setError(getErrorMessage(oauthError, 'Google sign in failed.'));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <div className="hidden flex-1 flex-col justify-between bg-slate-900 px-14 py-12 text-white lg:flex">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-semibold text-slate-900">K</div>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Kanvas cloud</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight">Multiplayer canvases with secure sharing, comments, and live presence.</h1>
        </div>
        <p className="max-w-md text-sm leading-7 text-white/70">
          Ship the same board state to every collaborator without corruption, unauthorized writes, or placeholder UI.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Welcome back</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">Sign in to your workspace</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Continue to your live boards and collaboration sessions.</p>

          {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          <div className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-900"
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-900"
                placeholder="••••••••"
              />
            </label>
            <button
              onClick={() => void handleLogin()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Sign in
            </button>
            <button
              onClick={() => void handleGoogleLogin()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-600">
                G
              </span>
              Continue with Google
            </button>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-slate-900">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
