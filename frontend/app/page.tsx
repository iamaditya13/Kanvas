'use client';

import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import { api } from '@/utils/api';

interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

interface BoardSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  visibility: 'private' | 'link';
}

interface DashboardUser {
  email?: string;
}

const gradients = [
  'from-[#d7f7ff] via-[#fff7de] to-[#ffe4ec]',
  'from-[#e0f7ff] via-[#f0f6ff] to-[#e6fff7]',
  'from-[#fff6d8] via-[#fff0f2] to-[#e1f2ff]',
];

export default function HomePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.push('/login');
        return;
      }

      if (!cancelled) {
        setUser({ email: currentUser.email });
      }

      try {
        const nextWorkspaces = await api.get<WorkspaceSummary[]>('/api/workspaces');
        if (cancelled) {
          return;
        }
        setWorkspaces(nextWorkspaces);
        if (nextWorkspaces.length > 0) {
          setActiveWorkspace(nextWorkspaces[0]);
          const nextBoards = await api.get<BoardSummary[]>(`/api/workspaces/${nextWorkspaces[0].id}/boards`);
          if (!cancelled) {
            setBoards(nextBoards);
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const fetchBoards = async (workspace: WorkspaceSummary) => {
    setActiveWorkspace(workspace);
    try {
      const nextBoards = await api.get<BoardSummary[]>(`/api/workspaces/${workspace.id}/boards`);
      setBoards(nextBoards);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load boards');
    }
  };

  const handleCreateBoard = async () => {
    let workspace = activeWorkspace;

    if (!workspace) {
      try {
        workspace = await api.post<WorkspaceSummary>('/api/workspaces', { name: 'My Workspace' });
        setWorkspaces((current) => [workspace as WorkspaceSummary, ...current]);
        setActiveWorkspace(workspace);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create workspace');
        return;
      }
    }

    const boardName = window.prompt('Board name');
    if (!boardName?.trim()) {
      return;
    }

    try {
      const board = await api.post<BoardSummary>(`/api/workspaces/${workspace.id}/boards`, { name: boardName.trim() });
      router.push(`/board/${board.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create board');
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef5ff,_#fbf7ef_48%,_#f5efe6)] text-slate-900">
      <Toaster position="top-center" />

      <aside className="hidden w-72 flex-col border-r border-white/60 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#135BEC] text-lg font-semibold text-white">K</div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Workspace hub</p>
            <h1 className="text-xl font-semibold">Kanvas</h1>
          </div>
        </div>

        <button
          onClick={() => void handleCreateBoard()}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New board
        </button>

        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Teams</p>
          <div className="mt-4 space-y-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => void fetchBoards(workspace)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  activeWorkspace?.id === workspace.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'bg-white/70 text-slate-700 hover:bg-white'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl font-semibold ${activeWorkspace?.id === workspace.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {workspace.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{workspace.name}</p>
                  <p className={`text-xs ${activeWorkspace?.id === workspace.id ? 'text-white/70' : 'text-slate-400'}`}>{workspace.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto rounded-3xl border border-white/60 bg-white/80 p-4 backdrop-blur">
          <p className="text-sm font-medium text-slate-700">{user?.email || 'Workspace member'}</p>
          <button onClick={handleLogout} className="mt-3 text-sm font-medium text-slate-500 transition hover:text-slate-800">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Dashboard</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">{activeWorkspace?.name || 'Start your first workspace'}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  Secure, persistent real-time boards with share links, presence, comments, drawing, and structured canvas tools.
                </p>
              </div>
              <button
                onClick={() => void handleCreateBoard()}
                className="inline-flex items-center gap-2 self-start rounded-full bg-[#135BEC] px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                Create board
              </button>
            </div>
          </div>

          <div className="mt-8">
            {loading ? (
              <div className="rounded-[32px] border border-white/60 bg-white/70 p-10 text-center text-slate-500 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                Loading dashboard...
              </div>
            ) : boards.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/60 p-12 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <p className="text-lg font-semibold text-slate-700">No boards yet</p>
                <p className="mt-2 text-sm text-slate-500">Create a board to start collaborating in real time.</p>
                <button
                  onClick={() => void handleCreateBoard()}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  New board
                </button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {boards.map((board, index) => (
                  <button
                    key={board.id}
                    onClick={() => router.push(`/board/${board.id}`)}
                    className="group overflow-hidden rounded-[30px] border border-white/60 bg-white/65 text-left shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.16)]"
                  >
                    <div className={`h-40 bg-gradient-to-br ${gradients[index % gradients.length]} p-6`}>
                      <div className="flex h-full items-end justify-between">
                        <div className="space-y-2">
                          <div className="h-3 w-24 rounded-full bg-white/70" />
                          <div className="h-3 w-40 rounded-full bg-white/60" />
                        </div>
                        <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-500">
                          {board.visibility === 'link' ? 'Shared link' : 'Private'}
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800 transition group-hover:text-[#135BEC]">{board.name}</h3>
                          <p className="mt-2 text-sm text-slate-400">Updated {new Date(board.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Live</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
