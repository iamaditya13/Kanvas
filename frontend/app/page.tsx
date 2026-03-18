'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  visibility: 'private' | 'link';
}

interface DashboardUser {
  email?: string;
}

interface DialogMessage {
  tone: 'success' | 'error';
  title: string;
  text: string;
}

const boardCoverColors = ['bg-[#f3f4f6]', 'bg-[#f8fafc]', 'bg-[#f1f5f9]'];

export default function HomePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardToDelete, setBoardToDelete] = useState<BoardSummary | null>(null);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [createBoardDialogOpen, setCreateBoardDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [createBoardWorkspaceId, setCreateBoardWorkspaceId] = useState<string | null>(null);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [messageDialog, setMessageDialog] = useState<DialogMessage | null>(null);

  const showMessageDialog = useCallback((tone: DialogMessage['tone'], title: string, text: string) => {
    setMessageDialog({ tone, title, text });
  }, []);

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
          showMessageDialog('error', 'Unable to load dashboard', error instanceof Error ? error.message : 'Failed to load dashboard');
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
  }, [router, showMessageDialog]);

  const fetchBoards = async (workspace: WorkspaceSummary) => {
    setActiveWorkspace(workspace);
    try {
      const nextBoards = await api.get<BoardSummary[]>(`/api/workspaces/${workspace.id}/boards`);
      setBoards(nextBoards);
    } catch (error) {
      showMessageDialog('error', 'Unable to load boards', error instanceof Error ? error.message : 'Failed to load boards');
    }
  };

  const ensureWorkspaceForBoardCreation = useCallback(async () => {
    let workspace = activeWorkspace;

    if (!workspace) {
      try {
        const createdWorkspace = await api.post<WorkspaceSummary>('/api/workspaces', { name: 'My Workspace' });
        workspace = createdWorkspace;
        setWorkspaces((current) => [createdWorkspace, ...current]);
        setActiveWorkspace(createdWorkspace);
      } catch (error) {
        showMessageDialog('error', 'Unable to create workspace', error instanceof Error ? error.message : 'Failed to create workspace');
        return null;
      }
    }

    return workspace;
  }, [activeWorkspace, showMessageDialog]);

  const handleCreateBoard = async () => {
    const workspace = await ensureWorkspaceForBoardCreation();
    if (!workspace) {
      return;
    }

    setCreateBoardWorkspaceId(workspace.id);
    setNewBoardName('');
    setCreateBoardDialogOpen(true);
  };

  const handleCreateBoardSubmit = async () => {
    const workspaceId = createBoardWorkspaceId;
    if (!workspaceId) {
      return;
    }

    const trimmedName = newBoardName.trim();
    if (!trimmedName) {
      showMessageDialog('error', 'Board name required', 'Enter a board name before creating the board.');
      return;
    }

    setCreatingBoard(true);
    try {
      const board = await api.post<BoardSummary>(`/api/workspaces/${workspaceId}/boards`, { name: trimmedName });
      setCreateBoardDialogOpen(false);
      setCreateBoardWorkspaceId(null);
      setNewBoardName('');
      router.push(`/board/${board.id}`);
    } catch (error) {
      showMessageDialog('error', 'Unable to create board', error instanceof Error ? error.message : 'Failed to create board');
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete) {
      return;
    }

    setDeletingBoard(true);
    try {
      await api.delete(`/api/workspaces/${boardToDelete.workspaceId}/boards/${boardToDelete.id}`);
      setBoards((current) => current.filter((board) => board.id !== boardToDelete.id));
      setBoardToDelete(null);
      showMessageDialog('success', 'Board deleted', 'The board and its contents were deleted successfully.');
    } catch (error) {
      showMessageDialog('error', 'Unable to delete board', error instanceof Error ? error.message : 'Failed to delete board');
    } finally {
      setDeletingBoard(false);
    }
  };

  const canDeleteBoards = activeWorkspace?.role === 'admin' || activeWorkspace?.role === 'member';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-72 flex-col border-r border-white/60 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white">K</div>
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
                className="inline-flex items-center gap-2 self-start rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
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
                  <div
                    key={board.id}
                    className="group relative overflow-hidden rounded-[30px] border border-white/60 bg-white/65 text-left shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.16)]"
                  >
                    {canDeleteBoards && (
                      <button
                        onClick={() => setBoardToDelete(board)}
                        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white/95 text-red-500 shadow-sm transition hover:bg-red-50"
                        title="Delete board"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => router.push(`/board/${board.id}`)} className="block w-full text-left">
                      <div className={`h-40 ${boardCoverColors[index % boardCoverColors.length]} p-6`}>
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
                            <h3 className="text-lg font-semibold text-slate-800 transition group-hover:text-slate-700">{board.name}</h3>
                            <p className="mt-2 text-sm text-slate-400">Updated {new Date(board.updatedAt).toLocaleDateString()}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Live</span>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {boardToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete board?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This will permanently delete <span className="font-medium text-slate-700">{boardToDelete.name}</span> and all of its canvas
              elements, comments, and activity history.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setBoardToDelete(null)}
                disabled={deletingBoard}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteBoard()}
                disabled={deletingBoard}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingBoard ? 'Deleting...' : 'Delete board'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createBoardDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Create board</h3>
            <p className="mt-2 text-sm text-slate-500">Enter a name for the new board.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Board name
              <input
                autoFocus
                value={newBoardName}
                onChange={(event) => setNewBoardName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleCreateBoardSubmit();
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-900"
                placeholder="Project planning"
              />
            </label>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (creatingBoard) {
                    return;
                  }
                  setCreateBoardDialogOpen(false);
                  setCreateBoardWorkspaceId(null);
                  setNewBoardName('');
                }}
                disabled={creatingBoard}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateBoardSubmit()}
                disabled={creatingBoard}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingBoard ? 'Creating...' : 'Create board'}
              </button>
            </div>
          </div>
        </div>
      )}

      {messageDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{messageDialog.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">{messageDialog.text}</p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setMessageDialog(null)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
