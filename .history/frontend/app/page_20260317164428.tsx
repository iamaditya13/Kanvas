"use client";

import { useEffect, useState } from "react";
import { Search, Bell, Menu, Plus } from "lucide-react";
import { api } from "@/utils/api";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if(!currentUser) {
            router.push('/login');
            return;
        }
        setUser(currentUser);
        fetchWorkspaces();
    }
    checkUser();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const data = await api.get('/api/workspaces');
      setWorkspaces(data);
      if (data.length > 0) {
        setActiveWorkspace(data[0]);
        fetchBoards(data[0].id);
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      toast.error('Failed to load workspaces');
      setIsLoading(false);
    }
  };

  const fetchBoards = async (workspaceId: string) => {
    try {
      const data = await api.get(`/api/workspaces/${workspaceId}/boards`);
      setBoards(data);
    } catch (err: any) {
      toast.error('Failed to load boards');
    } finally {
        setIsLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    const name = prompt('Enter Workspace Name:');
    if (!name) return;
    try {
        await api.post('/api/workspaces', { name });
        toast.success("Workspace created");
        fetchWorkspaces();
    } catch (err: any) {
        toast.error(err.message);
    }
  };

  const handleCreateBoard = async () => {
    if(!activeWorkspace) return toast.error("Please create a workspace first");
    const name = prompt('Enter Board Name:');
    if (!name) return;
    try {
        await api.post(`/api/workspaces/${activeWorkspace.id}/boards`, { name });
        toast.success("Board created");
        fetchBoards(activeWorkspace.id);
    } catch (err: any) {
        toast.error(err.message);
    }
  }

  const handleLogout = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
  }

  if (isLoading) return <div className="h-screen bg-[#121212] flex items-center justify-center text-white">Loading Kanvas...</div>

  return (
    <div className="flex h-screen bg-[#121212] overflow-hidden text-white w-full">
      <Toaster />
      {/* Sidebar */}
      <aside className="w-64 bg-[#1A1A1A] border-r border-[#2A2A2A] flex flex-col shrink-0">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#135bec] flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            K
          </div>
          <span className="text-xl font-semibold text-white tracking-tight">Kanvas</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
           <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Workspaces</div>
           {workspaces.map(ws => (
             <button
               key={ws.id}
               onClick={() => { setActiveWorkspace(ws); fetchBoards(ws.id); }}
               className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${activeWorkspace?.id === ws.id ? 'bg-[#2A2A2A] text-white' : 'text-gray-400 hover:bg-[#2A2A2A]/50'}`}
             >
               <span className={`w-2 h-2 rounded-full ${activeWorkspace?.id === ws.id ? 'bg-[#135bec]' : 'border border-gray-500'}`}></span>
               <span className="truncate">{ws.name}</span>
             </button>
           ))}
           <button onClick={handleCreateWorkspace} className="w-full flex items-center space-x-3 px-3 py-2 text-gray-400 hover:text-white rounded-lg transition-colors text-left">
            <Plus className="w-4 h-4 ml-[-2px]"/>
            <span className="text-sm">Create Workspace</span>
           </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#121212]">
        {/* Header */}
        <header className="h-16 border-b border-[#2A2A2A] bg-[#121212] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search boards, tasks, or members..." 
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-full py-2 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-[#135bec] transition-colors"
                disabled
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 ml-4">
            <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-400 truncate max-w-[150px]">{user?.email}</span>
              <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">Logout</button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#135bec] to-purple-500 p-[2px]">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`} alt="User" className="w-full h-full rounded-full bg-[#1A1A1A]" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {activeWorkspace ? (
                <>
                <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white">Boards in {activeWorkspace.name}</h1>
                <button onClick={handleCreateBoard} className="flex items-center space-x-2 bg-[#135bec] hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                    <Plus className="w-4 h-4" />
                    <span>New Board</span>
                </button>
                </div>

                {boards.length === 0 ? (
                    <div className="border border-dashed border-[#2A2A2A] rounded-xl p-12 text-center">
                        <h3 className="text-lg font-medium text-gray-300 mb-2">No boards yet</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">Create a board to start collaborating with your team on tasks and projects.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {boards.map((board) => (
                        <Link href={`/board/${board.id}`} key={board.id} className="group cursor-pointer block">
                        <div className="h-32 rounded-t-xl bg-[#1A1A1A] border border-[#2A2A2A] border-b-0 relative overflow-hidden flex items-center justify-center group-hover:bg-[#202020] transition-colors">
                            {/* Abstract Pattern */}
                            <div className={`absolute inset-0 opacity-20 bg-gradient-to-br from-[#135bec] to-purple-600`}></div>
                            <div className="w-16 h-12 bg-[#2A2A2A] rounded flex flex-col space-y-1 p-1.5 shadow-lg border border-[#333]">
                                <div className="w-full h-1/3 bg-gray-600 rounded-sm"></div>
                                <div className="w-2/3 h-1/3 bg-gray-500 rounded-sm"></div>
                                <div className="w-1/2 h-1/3 bg-[#135bec] rounded-sm"></div>
                            </div>
                        </div>
                        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-b-xl p-4 transition-colors group-hover:bg-[#202020]">
                            <h3 className="font-medium text-gray-200 group-hover:text-[#135bec] transition-colors truncate">{board.name}</h3>
                            <div className="flex items-center justify-between mt-4">
                            <span className="text-xs text-gray-500">{new Date(board.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        </Link>
                    ))}
                    </div>
                )}
                </>
            ) : (
                <div className="border border-dashed border-[#2A2A2A] rounded-xl p-12 text-center mt-12">
                    <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#2A2A2A]">
                        <Plus className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-300 mb-2">Welcome to Kanvas</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">Create your first workspace to start organizing your boards and collaborating with your team.</p>
                    <button onClick={handleCreateWorkspace} className="bg-[#135bec] hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg transition-colors font-medium">
                        Create Workspace
                    </button>
                </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
