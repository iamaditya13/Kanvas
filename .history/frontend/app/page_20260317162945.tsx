"use client";

import { Search, Bell, Menu, Plus } from "lucide-react";

export default function Home() {
  const recentBoards = [
    { id: 1, title: "Marketing Campaign", color: "bg-blue-500", members: 3 },
    { id: 2, title: "Product Roadmap", color: "bg-purple-500", members: 5 },
    { id: 3, title: "Design System", color: "bg-pink-500", members: 2 },
    { id: 4, title: "Q3 Planning", color: "bg-green-500", members: 4 },
  ];

  return (
    <div className="flex h-screen bg-[#121212] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1A1A1A] border-r border-[#2A2A2A] flex flex-col">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#135bec] flex items-center justify-center font-bold text-white">
            K
          </div>
          <span className="text-xl font-semibold text-white">Kanvas</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <a href="#" className="flex items-center space-x-3 px-3 py-2 bg-[#2A2A2A] text-white rounded-lg transition-colors">
            <span className="w-2 h-2 rounded-full bg-[#135bec]"></span>
            <span>Workspaces</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-3 py-2 text-gray-400 hover:bg-[#2A2A2A] hover:text-white rounded-lg transition-colors">
            <span className="w-2 h-2 rounded-full border border-gray-500"></span>
            <span>Recent Boards</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-3 py-2 text-gray-400 hover:bg-[#2A2A2A] hover:text-white rounded-lg transition-colors">
            <span className="w-2 h-2 rounded-full border border-gray-500"></span>
            <span>Members</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-3 py-2 text-gray-400 hover:bg-[#2A2A2A] hover:text-white rounded-lg transition-colors">
            <span className="w-2 h-2 rounded-full border border-gray-500"></span>
            <span>Settings</span>
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-[#2A2A2A] bg-[#121212] flex items-center justify-between px-6">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search boards, tasks, or members..." 
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-full py-2 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:border-[#135bec] transition-colors"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4 ml-4">
            <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#135bec] to-purple-500 p-[2px]">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full rounded-full bg-black" />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-white">Recent Boards</h1>
              <button className="flex items-center space-x-2 bg-[#135bec] hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                <span>New Board</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recentBoards.map((board) => (
                <div key={board.id} className="group cursor-pointer">
                  <div className="h-32 rounded-t-xl bg-[#1A1A1A] border border-[#2A2A2A] border-b-0 relative overflow-hidden flex items-center justify-center group-hover:bg-[#202020] transition-colors">
                    {/* Abstract Pattern */}
                    <div className={`absolute inset-0 opacity-20 ${board.color}`}></div>
                    <div className="w-16 h-12 bg-[#2A2A2A] rounded flex space-x-1 p-1 shadow-lg">
                      <div className="w-1/3 bg-gray-600 rounded-sm"></div>
                      <div className="w-1/3 bg-gray-500 rounded-sm"></div>
                      <div className="w-1/3 bg-gray-400 rounded-sm"></div>
                    </div>
                  </div>
                  <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-b-xl p-4 transition-colors group-hover:bg-[#202020]">
                    <h3 className="font-medium text-gray-200 group-hover:text-[#135bec] transition-colors">{board.title}</h3>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-gray-500">Updated 2h ago</span>
                      <div className="flex -space-x-2">
                        {[...Array(board.members)].map((_, i) => (
                          <img 
                            key={i} 
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${board.id}-${i}`} 
                            className="w-6 h-6 rounded-full border-2 border-[#1A1A1A] bg-gray-800"
                            alt="Member"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
