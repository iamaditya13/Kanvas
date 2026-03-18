import { createClient } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiErrorPayload {
  error?: string;
  code?: string;
}

const redirectToLogin = () => {
  const next = typeof window !== 'undefined' ? window.location.pathname : '/';
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
};

async function fetchWithAuth<TResponse>(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin();
    }
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new Error(payload?.error || response.statusText);
  }

  return (await response.json()) as TResponse;
}

export const api = {
  get: <TResponse>(endpoint: string, options?: RequestInit) => fetchWithAuth<TResponse>(endpoint, { ...options, method: 'GET' }),
  post: <TResponse>(endpoint: string, body: unknown, options?: RequestInit) =>
    fetchWithAuth<TResponse>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: <TResponse>(endpoint: string, body: unknown, options?: RequestInit) =>
    fetchWithAuth<TResponse>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  put: <TResponse>(endpoint: string, body: unknown, options?: RequestInit) =>
    fetchWithAuth<TResponse>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <TResponse>(endpoint: string, options?: RequestInit) => fetchWithAuth<TResponse>(endpoint, { ...options, method: 'DELETE' }),
};
