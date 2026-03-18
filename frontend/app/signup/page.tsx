'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to create account.');
      }

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        throw authError;
      }

      router.push('/');
    } catch (signupError) {
      setError(getErrorMessage(signupError, 'Unable to create account.'));
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
      setError(getErrorMessage(oauthError, 'Google sign up failed.'));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[linear-gradient(135deg,#fff7e6_0%,#f8fbff_50%,#eef2ff_100%)] text-slate-900">
      <div className="hidden flex-1 flex-col justify-between bg-[radial-gradient(circle_at_top_left,#f59e0b,#7c3aed_62%,#111827)] px-14 py-12 text-white lg:flex">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-semibold text-amber-500">K</div>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Start collaborating</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight">Create a shared canvas your team can trust in production.</h1>
        </div>
        <p className="max-w-md text-sm leading-7 text-white/70">
          Link sharing, unique presence colors, live cursors, structured comments, and persisted drawing data out of the box.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white/78 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Create account</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">Start building with your team</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Create your workspace account and open your first secure shared board.</p>

          {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

          <div className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-[#135BEC]"
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-[#135BEC]"
                placeholder="Minimum 8 characters"
              />
            </label>
            <button
              onClick={() => void handleSignup()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Create account
            </button>
            <button
              onClick={() => void handleGoogleLogin()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.873h5.382a4.602 4.602 0 0 1-1.996 3.018v2.505h3.227c1.89-1.741 2.987-4.309 2.987-7.351Z" /><path fill="#34A853" d="M12 22c2.7 0 4.964-.896 6.619-2.422l-3.227-2.505c-.896.6-2.045.955-3.392.955-2.609 0-4.818-1.764-5.609-4.136H3.055v2.586A9.997 9.997 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.892A5.996 5.996 0 0 1 6.055 12c0-.655.118-1.291.336-1.892V7.523H3.055A9.997 9.997 0 0 0 2 12c0 1.6.382 3.109 1.055 4.477l3.336-2.585Z" /><path fill="#EA4335" d="M12 5.973c1.468 0 2.786.505 3.823 1.495l2.864-2.864C16.955 2.99 14.69 2 12 2A9.997 9.997 0 0 0 3.055 7.523l3.336 2.585C7.182 7.736 9.39 5.973 12 5.973Z" /></svg>
              Continue with Google
            </button>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#135BEC]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
