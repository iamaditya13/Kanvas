"use client";

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useBoardStore, List, Task } from '@/store/boardStore';
import { socketService } from '@/lib/socket';
import { MoreHorizontal, Plus, MessageSquare } from 'lucide-react';

const mockInitialData: List[] = [
  {
    id: "list-1",
    name: "To Do",
    position: 0,
    tasks: [
      { id: "task-1", title: "Research Competitors", description: "Analyze top 3 apps", position: 0 },
      { id: "task-2", title: "Design System", description: "Create tokens and components", position: 1024 },
    ]
  },
  {
    id: "list-2",
    name: "In Progress",
    position: 1,
    tasks: [
      { id: "task-3", title: "Setup Next.js", description: "Configure Tailwind and App Router", position: 0 },
    ]
  },
  {
    id: "list-3",
    name: "Done",
    position: 2,
    tasks: []
  }
];

export default function BoardPage({ params }: { params: { id: string } }) {
  const { lists, setLists, moveTask } = useBoardStore();
  const [isMounted, setIsMounted] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    // Initialize mock data
    setLists(mockInitialData);

    const socket = socketService.getSocket();
    
    // Simulate current user
    const currentUser = { id: Math.random().toString(), email: `user${Math.floor(Math.random() * 1000)}@test.com` };
    
    socket.emit('join_board', { boardId: params.id, user: currentUser });

    socket.on('presence:update', (users: any[]) => {
      setOnlineUsers(users);
    });

    socket.on('task:moved', (data) => {
      moveTask(data.sourceListId, data.destListId, data.sourceIndex, data.destIndex);
    });

    return () => {
      socket.emit('leave_board', { boardId: params.id });
      socket.off('presence:update');
      socket.off('task:moved');
    };
  }, [params.id, setLists, moveTask]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    // Optimistic UI update locally
    moveTask(source.droppableId, destination.droppableId, source.index, destination.index);

    // Emit to others
    const socket = socketService.getSocket();
    socket.emit('task:move', {
      boardId: params.id,
      sourceListId: source.droppableId,
      destListId: destination.droppableId,
      sourceIndex: source.index,
      destIndex: destination.index
    });
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white">
      {/* Board Header */}
      <header className="h-16 border-b border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Marketing Campaign</h1>
          <div className="h-6 w-px bg-[#2A2A2A]"></div>
          <div className="flex -space-x-2">
            {onlineUsers.map((u, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-[#135bec] flex items-center justify-center text-xs border-2 border-[#1A1A1A] text-white font-medium" title={u.email}>
                {u.email.substring(0,2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Board Canvas */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full space-x-6 items-start">
            {lists.map((list) => (
              <div key={list.id} className="w-80 shrink-0 flex flex-col max-h-full bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                {/* List Header */}
                <div className="p-4 flex items-center justify-between shrink-0">
                  <h2 className="font-semibold text-gray-200">{list.name} <span className="text-gray-500 ml-2 text-sm">{list.tasks.length}</span></h2>
                  <button className="text-gray-400 hover:text-white transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* Droppable Area for Tasks */}
                <Droppable droppableId={list.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto px-3 pb-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-[#202020]' : ''}`}
                    >
                      {list.tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-[#262626] rounded-lg p-4 border border-[#333333] shadow-sm cursor-grab hover:border-[#444] transition-colors
                                ${snapshot.isDragging ? 'shadow-xl ring-1 ring-[#135bec] opacity-90' : ''}`}
                            >
                              <h3 className="text-sm font-medium text-gray-100">{task.title}</h3>
                              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{task.description}</p>
                              
                              <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center space-x-1 text-gray-500">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span className="text-xs font-medium">0</span>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-gray-600"></div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add Task Button */}
                <div className="p-3 shrink-0 border-t border-[#2A2A2A]">
                  <button className="flex items-center justify-center w-full py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#262626] rounded-lg transition-colors">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </button>
                </div>
              </div>
            ))}
            
            {/* Add List Button */}
            <div className="w-80 shrink-0">
              <button className="flex items-center w-full px-4 py-3 bg-[#1A1A1A]/50 hover:bg-[#1A1A1A] border border-dashed border-[#333] rounded-xl text-gray-400 font-medium transition-colors">
                <Plus className="w-5 h-5 mr-2" />
                Add another list
              </button>
            </div>
          </div>
        </DragDropContext>
      </main>
    </div>
  );
}
