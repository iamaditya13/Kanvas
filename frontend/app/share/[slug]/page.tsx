'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BoardScreen } from '@/features/board/BoardScreen';
import { boardApi } from '@/features/board/api';

export default function SharePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : null;
  const [resolvedBoardId, setResolvedBoardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      try {
        const payload = await boardApi.resolveShare(slug);
        if (!cancelled) {
          setError(null);
          setResolvedBoardId(payload.boardId);
        }
      } catch (resolveError) {
        if (!cancelled) {
          setResolvedBoardId(null);
          setError(resolveError instanceof Error ? resolveError.message : 'Unable to open share link');
        }
      }
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-700">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Share link unavailable</h1>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!slug || !resolvedBoardId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        Loading shared board...
      </div>
    );
  }

  return <BoardScreen boardId={resolvedBoardId} shareToken={slug} />;
}
