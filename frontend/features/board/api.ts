import { createClient } from '@/utils/supabase/client';
import { BoardInfo, BoardSessionResponse, BoardVisibility, ShareRole } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const redirectToLogin = () => {
  const next = typeof window !== 'undefined' ? window.location.pathname : '/';
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
};

const fetchJson = async <T>(
  endpoint: string,
  options: RequestInit = {},
  shareToken?: string,
  { redirectOnUnauthorized = true }: { redirectOnUnauthorized?: boolean } = {}
): Promise<T> => {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  if (shareToken) {
    headers.set('X-Board-Share-Token', shareToken);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && redirectOnUnauthorized) {
      redirectToLogin();
    }

    const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ApiError(payload?.error || response.statusText, payload?.code);
  }

  return (await response.json()) as T;
};

export const boardApi = {
  fetchSession: (boardId: string, shareToken?: string) =>
    fetchJson<BoardSessionResponse>(`/api/boards/${boardId}/session`, { method: 'GET' }, shareToken, {
      redirectOnUnauthorized: !shareToken,
    }),
  resolveShare: (slug: string) =>
    fetchJson<{
      boardId: string;
      boardName: string;
      shareSlug: string;
      access: { mode: 'member' | 'share'; role: string; canEdit: boolean };
    }>(`/api/shares/${encodeURIComponent(slug)}`, { method: 'GET' }, undefined, { redirectOnUnauthorized: false }),
  updateBoardName: (boardId: string, name: string, shareToken?: string) =>
    fetchJson<BoardInfo>(`/api/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }, shareToken),
  updateShareSettings: (
    boardId: string,
    settings: { visibility: BoardVisibility; shareRole: ShareRole; regenerate?: boolean },
    shareToken?: string
  ) =>
    fetchJson<BoardInfo>(`/api/boards/${boardId}/share`, {
      method: 'POST',
      body: JSON.stringify(settings),
    }, shareToken),
};

export { ApiError };
