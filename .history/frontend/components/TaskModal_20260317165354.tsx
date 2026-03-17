"use client";

import { useEffect, useRef, useState } from "react";
import { X, MessageSquare, Clock, Send, Activity } from "lucide-react";
import { api } from "@/utils/api";
import { socketService } from "@/lib/socket";
import toast from "react-hot-toast";

interface Comment { id: string; content: string; user_id: string; created_at: string; }
interface Log { id: string; action: string; details: any; user_id: string; created_at: string; }

interface Props {
  taskId: string;
  boardId: string;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  comment_added: "💬 Added a comment",
  task_updated: "✏️ Updated the task",
  task_moved: "↕️ Moved the task",
};

export default function TaskModal({ taskId, boardId, onClose }: Props) {
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Log[]>([]);
  const [newComment, setNewComment] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAll();
    const socket = socketService.getSocket();

    socket.on("member:typing", ({ user, taskId: tid }: { user: any; taskId: string }) => {
      if (tid === taskId) {
        setTypingUsers((prev) => (prev.includes(user.email) ? prev : [...prev, user.email]));
      }
    });
    socket.on("member:stopped_typing", ({ user, taskId: tid }: { user: any; taskId: string }) => {
      if (tid === taskId) {
        setTypingUsers((prev) => prev.filter((e) => e !== user.email));
      }
    });
    // Listen for real-time comment updates
    socket.on("comment:new", (data: { taskId: string; comment: Comment }) => {
      if (data.taskId === taskId) {
        setComments((prev) => [...prev, data.comment]);
      }
    });

    return () => {
      socket.off("member:typing");
      socket.off("member:stopped_typing");
      socket.off("comment:new");
    };
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const fetchAll = async () => {
    try {
      const [taskData, commentsData, activityData] = await Promise.all([
        api.get(`/api/tasks/${taskId}`),
        api.get(`/api/tasks/${taskId}/comments`),
        api.get(`/api/tasks/${taskId}/activity`),
      ]);
      setTask(taskData);
      setComments(commentsData);
      setActivity(activityData);
    } catch (e: any) {
      toast.error("Failed to load task details");
    }
  };

  const handleTyping = () => {
    const socket = socketService.getSocket();
    const storedAuth = localStorage.getItem(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`);
    let email = "Anonymous";
    try { email = JSON.parse(storedAuth || "{}").user?.email || email; } catch {}

    socket.emit("typing:start", { boardId, user: { email }, taskId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing:stop", { boardId, user: { email }, taskId });
    }, 2000);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const comment = await api.post(`/api/tasks/${taskId}/comments`, { content: newComment.trim() });
      setComments((prev) => [...prev, comment]);
      // Broadcast to other users
      const socket = socketService.getSocket();
      socket.emit("comment:broadcast", { boardId, taskId, comment });
      setNewComment("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#2E2E2E] shrink-0">
          <div className="flex-1 pr-4">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">Task</p>
            <h2 className="text-xl font-bold text-white leading-snug">
              {task?.title ?? <span className="text-gray-500">Loading…</span>}
            </h2>
            {task?.description && (
              <p className="text-gray-400 text-sm mt-2">{task.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#2A2A2A] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2E2E2E] shrink-0 px-6">
          <button
            onClick={() => setTab("comments")}
            className={`flex items-center gap-2 py-3 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "comments" ? "border-[#135bec] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Comments {comments.length > 0 && <span className="bg-[#2A2A2A] text-gray-400 text-xs px-1.5 py-0.5 rounded-full">{comments.length}</span>}
          </button>
          <button
            onClick={() => setTab("activity")}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "activity" ? "border-[#135bec] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Activity className="w-4 h-4" />
            Activity
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === "comments" ? (
            <>
              {comments.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No comments yet. Be the first to comment!</p>
                </div>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#135bec] to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {c.user_id.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="bg-[#252525] rounded-xl rounded-tl-none p-3 border border-[#333]">
                      <p className="text-sm text-gray-200">{c.content}</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 pl-1">
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500 italic pl-11">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </span>
                  {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
                </div>
              )}
              <div ref={bottomRef} />
            </>
          ) : (
            <>
              {activity.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No activity recorded yet.</p>
                </div>
              )}
              {activity.map((log) => (
                <div key={log.id} className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-[#2A2A2A] border border-[#333] flex items-center justify-center text-xs text-gray-400 shrink-0">
                    {log.user_id.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">{ACTION_LABELS[log.action] ?? log.action}</p>
                    {log.details?.content_preview && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">"{log.details.content_preview}"</p>
                    )}
                    <p className="text-xs text-gray-600 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Comment Input */}
        {tab === "comments" && (
          <form
            onSubmit={handleSubmitComment}
            className="p-4 border-t border-[#2E2E2E] shrink-0 flex gap-3"
          >
            <input
              value={newComment}
              onChange={(e) => { setNewComment(e.target.value); handleTyping(); }}
              placeholder="Write a comment…"
              className="flex-1 bg-[#252525] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#135bec] transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="bg-[#135bec] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
