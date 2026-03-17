"use client";

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useBoardStore, List, Task } from '@/store/boardStore';
import { socketService } from '@/lib/socket';
import { MoreHorizontal, Plus, MessageSquare, ArrowLeft } from 'lucide-react';
import { api } from '@/utils/api';
import toast, { Toaster } from 'react-hot-toast';
import TaskModal from '@/components/TaskModal';
import Link from 'next/link';

export default function BoardPage({ params }: { params: { id: string } }) {
  const { lists, setLists, moveTask } = useBoardStore();
  const [isMounted, setIsMounted] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [boardName, setBoardName] = useState('Board');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const fetchBoardData = async () => {
    try {
      const data = await api.get(`/api/boards/${params.id}/lists`);
      setLists(data);
    } catch (error: any) {
      toast.error('Failed to load board: ' + error.message);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchBoardData();

    const socket = socketService.getSocket();

    const storedAuth = Object.keys(localStorage).find(k => k.includes('auth-token'));
    let email = 'Anonymous';
    if (storedAuth) {
      try { email = JSON.parse(localStorage.getItem(storedAuth) || '{}').user?.email || email; } catch {}
    }

    const currentUser = { id: Math.random().toString(), email };
    socket.emit('join_board', { boardId: params.id, user: currentUser });

    socket.on('presence:update', (users: any[]) => setOnlineUsers(users));
    socket.on('task:moved', (data: any) => {
      moveTask(data.sourceListId, data.destListId, data.sourceIndex, data.destIndex);
    });

    return () => {
      socket.emit('leave_board', { boardId: params.id });
      socket.off('presence:update');
      socket.off('task:moved');
    };
  }, [params.id]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    moveTask(source.droppableId, destination.droppableId, source.index, destination.index);

    socketService.getSocket().emit('task:move', {
      boardId: params.id,
      sourceListId: source.droppableId,
      destListId: destination.droppableId,
      sourceIndex: source.index,
      destIndex: destination.index,
    });
  };

  const handleAddList = async () => {
    const listName = prompt('Enter list name:');
    if (!listName?.trim()) return;
    try {
      await api.post(`/api/boards/${params.id}/lists`, { name: listName.trim(), position: lists.length });
      toast.success('List created');
      fetchBoardData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddTask = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const title = prompt('Enter task title:');
    if (!title?.trim()) return;
    try {
      const list = lists.find(l => l.id === listId);
      const position = list ? list.tasks.length * 1024 : 0;
      await api.post(`/api/lists/${listId}/tasks`, { title: title.trim(), description: '', position });
      toast.success('Task created');
      fetchBoardData();
    } catch (err: any) { toast.error(err.message); }
  };

  if (!isMounted) return (
    <div className="h-screen bg-[#121212] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#135bec] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white">
      <Toaster />

      {/* Board Header */}
      <header className="h-16 border-b border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#2A2A2A]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-[#2A2A2A]"></div>
          <h1 className="text-lg font-bold">{boardName}</h1>
        </div>

        {/* Online users presence */}
        <div className="flex items-center gap-3">
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-[#2A2A2A] px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              {onlineUsers.length} online
            </div>
          )}
          <div className="flex -space-x-2">
            {onlineUsers.slice(0, 5).map((u, i) => (
              <div
                key={i}
                title={u.email}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#135bec] to-purple-600 flex items-center justify-center text-xs border-2 border-[#1A1A1A] text-white font-semibold"
              >
                {u.email.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Kanban Canvas */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full space-x-4 items-start">
            {lists.map((list) => (
              <div key={list.id} className="w-72 shrink-0 flex flex-col max-h-full bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                {/* List Header */}
                <div className="p-3.5 flex items-center justify-between shrink-0">
                  <h2 className="font-semibold text-sm text-gray-200">
                    {list.name}
                    <span className="text-gray-500 ml-2 font-normal">{list.tasks.length}</span>
                  </h2>
                  <button className="text-gray-500 hover:text-white transition-colors p-1 rounded">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Droppable Task Area */}
                <Droppable droppableId={list.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto px-2.5 pb-2.5 space-y-2 min-h-[2rem] rounded-lg transition-colors ${
                        snapshot.isDraggingOver ? 'bg-[#135bec]/5' : ''
                      }`}
                    >
                      {list.tasks.map((task: Task, index: number) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setActiveTaskId(task.id)}
                              className={`bg-[#252525] rounded-lg p-3.5 border cursor-pointer transition-all
                                ${snapshot.isDragging
                                  ? 'shadow-2xl ring-1 ring-[#135bec] border-[#135bec]/40 opacity-95 rotate-1'
                                  : 'border-[#333] hover:border-[#444] hover:bg-[#2A2A2A]'
                                }`}
                            >
                              <h3 className="text-sm font-medium text-gray-100 leading-snug">{task.title}</h3>
                              {task.description && (
                                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
                              )}
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center space-x-1 text-gray-600 hover:text-gray-400 transition-colors">
                                  <MessageSquare className="w-3 h-3" />
                                  <span className="text-xs">Comment</span>
                                </div>
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-600 to-gray-700"></div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add Task */}
                <div className="p-2.5 shrink-0 border-t border-[#2A2A2A]">
                  <button
                    onClick={(e) => handleAddTask(list.id, e)}
                    className="flex items-center justify-center w-full py-1.5 text-xs font-medium text-gray-500 hover:text-gray-300 hover:bg-[#262626] rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add task
                  </button>
                </div>
              </div>
            ))}

            {/* Add List */}
            <div className="w-72 shrink-0">
              <button
                onClick={handleAddList}
                className="flex items-center w-full px-4 py-3 bg-[#1A1A1A]/60 hover:bg-[#1A1A1A] border border-dashed border-[#2E2E2E] hover:border-[#404040] rounded-xl text-gray-500 hover:text-gray-300 text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add list
              </button>
            </div>
          </div>
        </DragDropContext>
      </main>

      {/* Task Detail Modal */}
      {activeTaskId && (
        <TaskModal
          taskId={activeTaskId}
          boardId={params.id}
          onClose={() => { setActiveTaskId(null); fetchBoardData(); }}
        />
      )}
    </div>
  );
}
