"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { api } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "schedule", label: "Recent", href: "/" },
  { icon: "star", label: "Starred", href: "/" },
  { icon: "delete", label: "Trash", href: "/" },
];

const BOARD_COLORS = [
  ["#FFF9C4","#B2EBF2","#F8BBD0"],
  ["#C8E6C9","#FFE0B2","#E1BEE7"],
  ["#B3E5FC","#FFCCBC","#D1C4E9"],
];

function BoardCard({ board, index, onClick }: { board: any; index: number; onClick: () => void }) {
  const colors = BOARD_COLORS[index % BOARD_COLORS.length];
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden bg-white"
    >
      {/* Thumbnail */}
      <div className="h-36 relative overflow-hidden" style={{ background: "#F5F5F0" }}>
        <div className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)",
            backgroundSize: "20px 20px"
          }} />
        <div className="absolute inset-4 grid grid-cols-3 gap-2">
          {colors.map((c, i) => (
            <div key={i} className="rounded-lg shadow-sm border border-gray-200/50 flex items-center justify-center"
              style={{ background: c }}>
              <div className="w-8 h-1 bg-gray-300/60 rounded" />
            </div>
          ))}
        </div>
        {index === 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
            Live
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3.5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-[160px]">
            {board.name}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(board.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 p-1 rounded">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWs, setActiveWs] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/login"); return; }
      setUser(u);
      try {
        const wss = await api.get("/api/workspaces");
        setWorkspaces(wss);
        if (wss.length > 0) { setActiveWs(wss[0]); fetchBoards(wss[0].id); }
        else setLoading(false);
      } catch { setLoading(false); }
    })();
  }, []);

  const fetchBoards = async (wsId: string) => {
    try {
      const data = await api.get(`/api/workspaces/${wsId}/boards`);
      setBoards(data);
    } catch { toast.error("Failed to load boards"); }
    finally { setLoading(false); }
  };

  const handleNewBoard = async () => {
    if (!activeWs) {
      // Create default workspace first
      try {
        const ws = await api.post("/api/workspaces", { name: "My Workspace" });
        setWorkspaces([ws]); setActiveWs(ws);
        const name = prompt("Board name:");
        if (!name) return;
        const b = await api.post(`/api/workspaces/${ws.id}/boards`, { name });
        router.push(`/board/${b.id}`);
      } catch (e: any) { toast.error(e.message); }
      return;
    }
    const name = prompt("Board name:");
    if (!name) return;
    try {
      const b = await api.post(`/api/workspaces/${activeWs.id}/boards`, { name });
      router.push(`/board/${b.id}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-white text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Toaster />
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-200 flex flex-col shrink-0 bg-white">
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 flex items-center gap-2.5 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">K</div>
          <span className="font-semibold text-gray-900">Kanvas</span>
        </div>
        {/* New Board */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={handleNewBoard}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2 justify-center"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            New board
          </button>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <a key={item.label} href={item.href}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <span className="material-icons-outlined text-[18px] text-gray-400">{item.icon}</span>
              {item.label}
            </a>
          ))}
          {/* Teams */}
          {workspaces.length > 0 && (
            <div className="pt-4">
              <p className="px-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Teams</p>
              {workspaces.map((ws) => (
                <button key={ws.id} onClick={() => { setActiveWs(ws); fetchBoards(ws.id); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${activeWs?.id === ws.id ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100"}`}>
                  <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                    {ws.name[0].toUpperCase()}
                  </div>
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
        {/* User */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-xs text-gray-600 truncate flex-1">{user?.email}</span>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-8 pt-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">
              {activeWs ? activeWs.name : "Dashboard"}
            </h1>
            <button onClick={handleNewBoard}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              New board
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-6 text-sm">
            {["All boards", "Recent", "Starred"].map((tab, i) => (
              <button key={tab}
                className={`pb-3 font-medium border-b-2 transition-colors ${i === 0 ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Board grid */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <svg width="28" height="28" fill="none" stroke="#6366f1" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">Create your first board</h3>
              <p className="text-sm text-gray-400 mb-4">Start collaborating with your team</p>
              <button onClick={handleNewBoard}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
                New board
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">Recent boards</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {boards.map((board, i) => (
                  <BoardCard key={board.id} board={board} index={i}
                    onClick={() => router.push(`/board/${board.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
