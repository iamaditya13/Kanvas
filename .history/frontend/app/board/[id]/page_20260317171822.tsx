"use client";

import { useCallback, useEffect, useRef, useState, ReactElement } from "react";
import { socketService } from "@/lib/socket";
import { api } from "@/utils/api";
import { createClient } from "@/utils/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tool = "select" | "hand" | "sticky" | "text" | "comment";

interface CanvasElement {
  id: string;
  type: "sticky" | "text";
  x: number; y: number;
  width: number; height: number;
  content: string;
  color: string;
}

interface RemoteCursor {
  email: string;
  x: number; y: number;
  color: string;
}

const CURSOR_COLORS = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8"];
const STICKY_COLORS = ["#FFF9C4","#B2EBF2","#F8BBD0","#C8E6C9","#FFE0B2","#E1BEE7","#B3E5FC"];

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

const Icon = {
  hand: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5V3m0 2a3 3 0 0 0-3 3v7l1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2l3-3V9a1 1 0 0 0-1-1 1 1 0 0 0-1 1v-1a1 1 0 0 0-2 0V7a1 1 0 0 0-2 0V5"/></svg>,
  select: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 3l14 9-7 1-4 7z"/></svg>,
  sticky: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  text: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M12 6v13M8 19h8"/></svg>,
  comment: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  undo: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7v6h6M5.25 13A9 9 0 1 0 7.8 6.8"/></svg>,
  redo: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 7v6h-6M18.75 13A9 9 0 1 1 16.2 6.8"/></svg>,
  plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  minus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>,
  back: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  users: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  close: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── StickyNote component ─────────────────────────────────────────────────────

function StickyNote({ el, zoom, pan, activeTool, onElementMove, onContentChange, onSelect, isSelected }: {
  el: CanvasElement;
  zoom: number;
  pan: { x: number; y: number };
  activeTool: Tool;
  onElementMove: (id: string, x: number, y: number) => void;
  onContentChange: (id: string, v: string) => void;
  onSelect: (id: string | null) => void;
  isSelected: boolean;
}) {
  const dragStart = useRef<{ mx: number; my: number; ex: number; ey: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "hand") return;
    e.stopPropagation();
    onSelect(el.id);
    dragStart.current = { mx: e.clientX, my: e.clientY, ex: el.x, ey: el.y };

    const handleMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.mx) / zoom;
      const dy = (ev.clientY - dragStart.current.my) / zoom;
      onElementMove(el.id, dragStart.current.ex + dx, dragStart.current.ey + dy);
    };
    const handleUp = () => {
      dragStart.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: el.x * zoom + pan.x,
        top: el.y * zoom + pan.y,
        width: el.width * zoom,
        height: el.height * zoom,
        background: el.color,
        boxShadow: isSelected
          ? "0 0 0 2px #6366f1, 0 8px 24px rgba(0,0,0,0.15)"
          : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        borderRadius: 8,
        cursor: activeTool === "hand" ? "grab" : "move",
        userSelect: "none",
        overflow: "hidden",
        transition: "box-shadow .15s",
      }}
    >
      <div style={{ height: 4, background: "rgba(0,0,0,0.08)" }} />
      <textarea
        value={el.content}
        onChange={(e) => { e.stopPropagation(); onContentChange(el.id, e.target.value); }}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="Add a note…"
        style={{
          width: "100%",
          height: `calc(100% - 4px)`,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: `${8 * zoom}px`,
          fontSize: `${13 * zoom}px`,
          fontFamily: "inherit",
          resize: "none",
          cursor: "text",
          color: "#1a1a1a",
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

// ─── Main Board Page ──────────────────────────────────────────────────────────

export default function BoardPage({ params }: { params: { id: string } }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [boardName, setBoardName] = useState("Untitled Board");
  const [showPresence, setShowPresence] = useState(true);
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);
  const [myEmail, setMyEmail] = useState("Anonymous");

  const [myColor] = useState(
    () => CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
  );

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  // ── Load data ──
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setMyEmail(user.email);
      try {
        const els = await api.get(`/api/boards/${params.id}/elements`);
        setElements(els);
      } catch { /* Board may have no elements */ }
    })();
  }, [params.id]);

  // ── Socket ──
  useEffect(() => {
    const socket = socketService.getSocket();
    socket.emit("join_board", { boardId: params.id, user: { email: myEmail, color: myColor } });

    socket.on("presence:update", (users: any[]) => setOnlineUsers(users));
    socket.on("element:added", (el: CanvasElement) => setElements((p) => [...p, el]));
    socket.on("element:moved", ({ id, x, y }: { id: string; x: number; y: number }) =>
      setElements((p) => p.map((e) => (e.id === id ? { ...e, x, y } : e)))
    );
    socket.on("element:updated", ({ id, content }: { id: string; content: string }) =>
      setElements((p) => p.map((e) => (e.id === id ? { ...e, content } : e)))
    );
    socket.on("cursor:move", ({ email, x, y, color }: RemoteCursor) => {
      if (email === myEmail) return;
      setCursors((m) => new Map(m).set(email, { email, x, y, color }));
    });

    return () => {
      socket.emit("leave_board", { boardId: params.id });
      ["presence:update", "element:added", "element:moved", "element:updated", "cursor:move"]
        .forEach((ev) => socket.off(ev));
    };
  }, [params.id, myEmail, myColor]);

  // ── Cursor broadcast ──
  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const cy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
    socketService.getSocket().emit("cursor:move", {
      boardId: params.id, email: myEmail, x: cx, y: cy, color: myColor,
    });
  }, [params.id, myEmail, myColor]);

  // ── Pan ──
  const panDrag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "hand" || e.button === 1) {
      panDrag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
      const handleMove = (ev: MouseEvent) => {
        if (!panDrag.current) return;
        setPan({ x: panDrag.current.px + ev.clientX - panDrag.current.sx, y: panDrag.current.py + ev.clientY - panDrag.current.sy });
      };
      const handleUp = () => {
        panDrag.current = null;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      return;
    }

    if (activeTool === "sticky") {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      addElement({ type: "sticky", x, y, color: stickyColor });
      setActiveTool("select");
      return;
    }

    setSelectedId(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(4, Math.max(0.15, z * delta)));
  };

  // ── Add element ──
  const addElement = async (opts: Partial<CanvasElement>) => {
    const el: CanvasElement = {
      id: crypto.randomUUID(),
      type: "sticky",
      x: 100, y: 100,
      width: 200, height: 150,
      content: "",
      color: stickyColor,
      ...opts,
    };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
    socketService.getSocket().emit("element:add", { boardId: params.id, element: el });
    try { await api.post(`/api/boards/${params.id}/elements`, el); } catch {}
  };

  const moveElement = (id: string, x: number, y: number) => {
    setElements((p) => p.map((e) => (e.id === id ? { ...e, x, y } : e)));
    socketService.getSocket().emit("element:move", { boardId: params.id, id, x, y });
  };

  const updateContent = (id: string, content: string) => {
    setElements((p) => p.map((e) => (e.id === id ? { ...e, content } : e)));
    socketService.getSocket().emit("element:update", { boardId: params.id, id, content });
  };

  const zoomPercent = Math.round(zoom * 100);

  const tools: { key: Tool; IconComp: () => ReactElement; label: string }[] = [
    { key: "hand", IconComp: Icon.hand, label: "Hand (H)" },
    { key: "select", IconComp: Icon.select, label: "Select (V)" },
    { key: "sticky", IconComp: Icon.sticky, label: "Sticky note (S)" },
    { key: "text", IconComp: Icon.text, label: "Text (T)" },
    { key: "comment", IconComp: Icon.comment, label: "Comment (C)" },
  ];

  return (
    <div className="flex flex-col h-screen bg-white select-none overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Toaster />

      {/* ── Top Menu Bar ── */}
      <div className="h-11 flex items-center border-b border-gray-200 bg-white px-3 gap-2 shrink-0 z-30">
        <Link href="/" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
          <Icon.back />
        </Link>
        <div className="h-5 w-px bg-gray-200 mx-1" />
        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xs mr-1">K</div>
        {["Board","Edit","View","Help"].map((m) => (
          <button key={m} className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded transition-colors">{m}</button>
        ))}
        {/* Board name (center) */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <input
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            className="text-sm font-semibold text-gray-800 text-center bg-transparent border-none outline-none hover:bg-gray-50 rounded px-2 py-0.5"
          />
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">@ All participants</span>
        </div>
        {/* Avatars */}
        <div className="flex -space-x-1.5">
          {onlineUsers.slice(0, 4).map((u, i) => (
            <div key={i} title={u.email}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
              style={{ background: CURSOR_COLORS[i % CURSOR_COLORS.length] }}>
              {u.email?.[0]?.toUpperCase() ?? "?"}
            </div>
          ))}
        </div>
        <button className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Share</button>
      </div>

      {/* ── Toolbar Row ── */}
      <div className="h-11 flex items-center border-b border-gray-200 bg-white px-3 gap-1 shrink-0 z-30">
        <div className="flex gap-0.5 mr-2">
          <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"><Icon.undo /></button>
          <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"><Icon.redo /></button>
        </div>
        <div className="h-5 w-px bg-gray-200 mx-1" />

        {tools.map(({ key, IconComp, label }) => (
          <button key={key} title={label} onClick={() => setActiveTool(key)}
            className={`p-2 rounded-lg transition-all ${activeTool === key
              ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
            <IconComp />
          </button>
        ))}

        {activeTool === "sticky" && (
          <>
            <div className="h-5 w-px bg-gray-200 mx-2" />
            <div className="flex gap-1.5 items-center">
              {STICKY_COLORS.map((c) => (
                <button key={c} onClick={() => setStickyColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${stickyColor === c ? "border-indigo-500 scale-110" : "border-gray-300 hover:border-gray-400"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />
        <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">Editor</span>
      </div>

      {/* ── Canvas Area ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar */}
        <div className="w-10 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 shrink-0 z-20">
          {[
            <svg key="bell" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M15 17H9v1a3 3 0 0 0 6 0v-1zm-3-14a7 7 0 0 1 7 7v3l2 2v1H4v-1l2-2v-3a7 7 0 0 1 7-7z"/></svg>,
            <svg key="check" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
            <svg key="list" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
          ].map((icon, i) => (
            <button key={i} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors">{icon}</button>
          ))}
        </div>

        {/* Infinite Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden"
          style={{
            background: "#F0F0EC",
            backgroundImage: "radial-gradient(circle, #c8c8c4 1px, transparent 1px)",
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor: activeTool === "hand" ? "grab" : activeTool === "sticky" ? "crosshair" : "default",
          }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onWheel={onWheel}
        >
          {elements.map((el) => (
            <StickyNote
              key={el.id} el={el} zoom={zoom} pan={pan}
              activeTool={activeTool}
              onElementMove={moveElement}
              onContentChange={updateContent}
              onSelect={setSelectedId}
              isSelected={selectedId === el.id}
            />
          ))}

          {/* Remote cursors */}
          {Array.from(cursors.values()).map(({ email, x, y, color }) => {
            const sx = x * zoom + pan.x;
            const sy = y * zoom + pan.y;
            return (
              <div key={email} style={{ position: "absolute", left: sx, top: sy, pointerEvents: "none", zIndex: 100 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
                  <path d="M5 3l12 7.5-7 1-3.5 6z" fill={color} stroke="white" strokeWidth="1.2"/>
                </svg>
                <div className="text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap mt-0.5"
                  style={{ background: color, color: "white", fontSize: 11 }}>
                  {email.split("@")[0]}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-5xl mb-3">🎨</div>
                <p className="text-gray-400 text-sm font-medium">Select the sticky note tool and click anywhere to add notes</p>
                <p className="text-gray-300 text-xs mt-1">Scroll to zoom · Hand tool to pan</p>
              </div>
            </div>
          )}
        </div>

        {/* Presence panel */}
        {showPresence && onlineUsers.length > 0 && (
          <div className="absolute bottom-14 right-4 bg-white border border-gray-200 rounded-xl shadow-lg w-56 z-20 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-700">Moderation</span>
              <button onClick={() => setShowPresence(false)} className="text-gray-400 hover:text-gray-600"><Icon.close /></button>
            </div>
            {onlineUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: CURSOR_COLORS[i % CURSOR_COLORS.length] }}>
                  {u.email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{u.email?.split("@")[0]}</p>
                  <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              </div>
            ))}
            <div className="px-3 py-2 border-t border-gray-100">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-indigo-600 w-3.5 h-3.5" />
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                User cursors
              </label>
            </div>
          </div>
        )}

        {!showPresence && (
          <button onClick={() => setShowPresence(true)}
            className="absolute bottom-14 right-4 z-20 bg-white border border-gray-200 rounded-lg shadow px-3 py-1.5 text-xs text-gray-600 flex items-center gap-1.5 hover:bg-gray-50">
            <Icon.users />
            Participants ({onlineUsers.length})
          </button>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-14 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 z-20">
        <button onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.1).toFixed(2)))}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"><Icon.minus /></button>
        <span className="text-xs font-semibold text-gray-600 w-10 text-center">{zoomPercent}%</span>
        <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)))}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"><Icon.plus /></button>
        <div className="h-4 w-px bg-gray-200 mx-0.5" />
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="text-xs text-gray-500 hover:bg-gray-100 px-1.5 py-1 rounded transition-colors">Reset</button>
      </div>
    </div>
  );
}
