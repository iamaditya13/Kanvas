'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  MessageSquare,
  MousePointer2,
  PencilLine,
  Redo2,
  Share2,
  SquarePen,
  StickyNote,
  Trash2,
  Undo2,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { boardApi } from './api';
import { CreateElementInput, createPathPayload, useBoardCollaboration } from './useBoardCollaboration';
import { useBoardStore } from './store/useBoardStore';
import { BoardComment, BoardVisibility, CanvasElement, PathPoint, ShareRole, Tool, ViewportState } from './types';

const TOOL_OPTIONS: Array<{ key: Tool; label: string; icon: typeof MousePointer2 }> = [
  { key: 'select', label: 'Select', icon: MousePointer2 },
  { key: 'draw', label: 'Draw', icon: PencilLine },
  { key: 'text', label: 'Text', icon: SquarePen },
  { key: 'comment', label: 'Comment', icon: MessageSquare },
];

const NOTE_COLORS = ['#FFF9C4', '#FFE0B2', '#D7F9F1', '#F8BBD0'];
const PATH_COLOR = '#135BEC';
const DEFAULT_TEXT_COLOR = '#111827';
const GRID_SIZE = 32;

interface BoardScreenProps {
  boardId: string;
  shareToken?: string;
}

interface DragState {
  elementId: string;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
}

interface PanState {
  pointerX: number;
  pointerY: number;
  startViewport: ViewportState;
}

interface ShareDialogMessage {
  tone: 'success' | 'error';
  text: string;
}

interface HistoryCommand {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
}

const getElementComments = (comments: BoardComment[]) =>
  comments.reduce<Record<string, BoardComment[]>>((acc, comment) => {
    acc[comment.elementId] = acc[comment.elementId] ? [...acc[comment.elementId], comment] : [comment];
    return acc;
  }, {});

const worldToScreen = (viewport: ViewportState, point: { x: number; y: number }) => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y,
});

const clampZoom = (zoom: number) => Math.min(2.5, Math.max(0.3, Number(zoom.toFixed(3))));

const sortByVersion = (elements: CanvasElement[]) => [...elements].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const clonePayload = <T extends Record<string, unknown>>(payload: T) => JSON.parse(JSON.stringify(payload)) as T;

const toCreateDraft = (element: CanvasElement): CreateElementInput => ({
  id: element.id,
  type: element.type,
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
  content: element.content,
  color: element.color,
  payload: clonePayload(element.payload),
});

export function BoardScreen({ boardId, shareToken }: BoardScreenProps) {
  const board = useBoardStore((state) => state.board);
  const access = useBoardStore((state) => state.access);
  const currentUser = useBoardStore((state) => state.currentUser);
  const elements = useBoardStore((state) => state.elements);
  const comments = useBoardStore((state) => state.comments);
  const presence = useBoardStore((state) => state.presence);
  const cursors = useBoardStore((state) => state.cursors);
  const tool = useBoardStore((state) => state.tool);
  const selectedElementId = useBoardStore((state) => state.selectedElementId);
  const viewport = useBoardStore((state) => state.viewport);
  const showPresence = useBoardStore((state) => state.showPresence);
  const showRemoteCursors = useBoardStore((state) => state.showRemoteCursors);
  const shareDialogOpen = useBoardStore((state) => state.shareDialogOpen);
  const initialize = useBoardStore((state) => state.initialize);
  const setBoard = useBoardStore((state) => state.setBoard);
  const upsertElement = useBoardStore((state) => state.upsertElement);
  const setTool = useBoardStore((state) => state.setTool);
  const setSelectedElementId = useBoardStore((state) => state.setSelectedElementId);
  const setEditingElementId = useBoardStore((state) => state.setEditingElementId);
  const setViewport = useBoardStore((state) => state.setViewport);
  const setShowPresence = useBoardStore((state) => state.setShowPresence);
  const setShowRemoteCursors = useBoardStore((state) => state.setShowRemoteCursors);
  const setShareDialogOpen = useBoardStore((state) => state.setShareDialogOpen);
  const resetBoard = useBoardStore((state) => state.reset);

  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [boardNameDraft, setBoardNameDraft] = useState('');
  const [shareVisibility, setShareVisibility] = useState<BoardVisibility>('private');
  const [shareRole, setShareRole] = useState<ShareRole>('editor');
  const [commentInput, setCommentInput] = useState('');
  const [shareDialogMessage, setShareDialogMessage] = useState<ShareDialogMessage | null>(null);
  const [historyState, setHistoryState] = useState({ undoDepth: 0, redoDepth: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const drawingRef = useRef<PathPoint[] | null>(null);
  const contentStartRef = useRef<Record<string, string>>({});
  const contentTimersRef = useRef<Record<string, number>>({});
  const latestMoveRef = useRef<Record<string, { x: number; y: number }>>({});
  const moveTimerRef = useRef<Record<string, number>>({});
  const spacePressedRef = useRef(false);
  const historyReplayRef = useRef(false);
  const undoStackRef = useRef<HistoryCommand[]>([]);
  const redoStackRef = useRef<HistoryCommand[]>([]);

  const isGuestSession = currentUser?.id === 'guest';

  const { createCanvasElement, moveCanvasElement, updateCanvasElement, deleteCanvasElement, createElementComment, sendCursor } =
    useBoardCollaboration({
      boardId,
      shareToken,
      enabled: Boolean(access && currentUser && !isGuestSession),
    });

  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) || null,
    [elements, selectedElementId]
  );

  const commentsByElement = useMemo(() => getElementComments(comments), [comments]);

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      undoDepth: undoStackRef.current.length,
      redoDepth: redoStackRef.current.length,
    });
  }, []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryState();
  }, [syncHistoryState]);

  const pushHistory = useCallback(
    (command: HistoryCommand) => {
      if (historyReplayRef.current) {
        return;
      }
      undoStackRef.current.push(command);
      redoStackRef.current = [];
      syncHistoryState();
    },
    [syncHistoryState]
  );

  const runWithHistoryReplay = useCallback(async (operation: () => Promise<boolean>) => {
    historyReplayRef.current = true;
    try {
      return await operation();
    } finally {
      historyReplayRef.current = false;
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (!access?.canEdit || undoStackRef.current.length === 0) {
      return;
    }

    const command = undoStackRef.current.pop();
    if (!command) {
      syncHistoryState();
      return;
    }

    const success = await runWithHistoryReplay(command.undo);
    if (success) {
      redoStackRef.current.push(command);
    } else {
      undoStackRef.current.push(command);
    }
    syncHistoryState();
  }, [access?.canEdit, runWithHistoryReplay, syncHistoryState]);

  const handleRedo = useCallback(async () => {
    if (!access?.canEdit || redoStackRef.current.length === 0) {
      return;
    }

    const command = redoStackRef.current.pop();
    if (!command) {
      syncHistoryState();
      return;
    }

    const success = await runWithHistoryReplay(command.redo);
    if (success) {
      undoStackRef.current.push(command);
    } else {
      redoStackRef.current.push(command);
    }
    syncHistoryState();
  }, [access?.canEdit, runWithHistoryReplay, syncHistoryState]);

  const createElementWithHistory = useCallback(
    async (draft: CreateElementInput) => {
      const created = await createCanvasElement(draft);
      if (!created) {
        return null;
      }

      const replayDraft: CreateElementInput = {
        ...draft,
        id: created.id,
        payload: clonePayload(draft.payload),
      };

      pushHistory({
        undo: async () => deleteCanvasElement(replayDraft.id || created.id),
        redo: async () => {
          const recreated = await createCanvasElement(replayDraft);
          if (!recreated) {
            return false;
          }
          replayDraft.id = recreated.id;
          return true;
        },
      });

      return created;
    },
    [createCanvasElement, deleteCanvasElement, pushHistory]
  );

  const deleteElementWithHistory = useCallback(
    async (elementId: string) => {
      const target = elements.find((item) => item.id === elementId);
      if (!target) {
        return false;
      }

      const deletedSnapshot = toCreateDraft(target);
      let activeElementId = target.id;

      const deleted = await deleteCanvasElement(elementId);
      if (!deleted) {
        return false;
      }

      pushHistory({
        undo: async () => {
          const recreated = await createCanvasElement({
            ...deletedSnapshot,
            id: activeElementId,
            payload: clonePayload(deletedSnapshot.payload),
          });
          if (!recreated) {
            return false;
          }
          activeElementId = recreated.id;
          return true;
        },
        redo: async () => deleteCanvasElement(activeElementId),
      });

      return true;
    },
    [createCanvasElement, deleteCanvasElement, elements, pushHistory]
  );

  useEffect(() => {
    let cancelled = false;
    clearHistory();

    const load = async () => {
      try {
        setLoading(true);
        const session = await boardApi.fetchSession(boardId, shareToken);
        if (cancelled) {
          return;
        }
        initialize({
          ...session,
          elements: sortByVersion(session.elements),
        });
        setBoardNameDraft(session.board.name);
        setShareVisibility(session.board.visibility);
        setShareRole(session.board.shareRole);
      } catch (error) {
        if (!cancelled) {
          setScreenError(error instanceof Error ? error.message : 'Failed to load board');
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
      clearHistory();
      resetBoard();
    };
  }, [boardId, clearHistory, initialize, resetBoard, shareToken]);

  useEffect(() => {
    if (board) {
      setBoardNameDraft(board.name);
      setShareVisibility(board.visibility);
      setShareRole(board.shareRole);
    }
  }, [board]);

  useEffect(() => {
    const activeElementIsEditable = () =>
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement ||
      document.activeElement instanceof HTMLSelectElement ||
      document.activeElement?.getAttribute('contenteditable') === 'true';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = true;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (activeElementIsEditable()) {
          return;
        }
        event.preventDefault();
        if (event.shiftKey) {
          void handleRedo();
        } else {
          void handleUndo();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        if (activeElementIsEditable()) {
          return;
        }
        event.preventDefault();
        void handleRedo();
        return;
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedElementId && access?.canEdit) {
        if (activeElementIsEditable()) {
          return;
        }
        void deleteElementWithHistory(selectedElementId);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [access?.canEdit, deleteElementWithHistory, handleRedo, handleUndo, selectedElementId]);

  const getCanvasRect = () => canvasRef.current?.getBoundingClientRect();

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = getCanvasRect();
      if (!rect) {
        return { x: 0, y: 0 };
      }

      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport.x, viewport.y, viewport.zoom]
  );

  const flushMove = useCallback(
    async (elementId: string) => {
      const nextPosition = latestMoveRef.current[elementId];
      if (!nextPosition) {
        return { moved: false as const, position: null };
      }
      delete latestMoveRef.current[elementId];
      if (moveTimerRef.current[elementId]) {
        window.clearTimeout(moveTimerRef.current[elementId]);
        delete moveTimerRef.current[elementId];
      }
      const moved = await moveCanvasElement(elementId, nextPosition.x, nextPosition.y);
      return {
        moved,
        position: nextPosition,
      };
    },
    [moveCanvasElement]
  );

  const scheduleMove = useCallback(
    (elementId: string, x: number, y: number) => {
      latestMoveRef.current[elementId] = { x, y };
      if (moveTimerRef.current[elementId]) {
        return;
      }
      moveTimerRef.current[elementId] = window.setTimeout(() => {
        void flushMove(elementId);
      }, 80);
    },
    [flushMove]
  );

  const saveBoardName = useCallback(async () => {
    if (!board || boardNameDraft.trim() === board.name) {
      return;
    }

    try {
      const updatedBoard = await boardApi.updateBoardName(board.id, boardNameDraft.trim(), shareToken);
      setBoard(updatedBoard);
      toast.success('Board name updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update board name');
      setBoardNameDraft(board.name);
    }
  }, [board, boardNameDraft, setBoard, shareToken]);

  const handleShareSave = useCallback(async () => {
    if (!board) {
      return;
    }

    try {
      const updatedBoard = await boardApi.updateShareSettings(
        board.id,
        {
          visibility: shareVisibility,
          shareRole,
        },
        shareToken
      );
      setBoard(updatedBoard);
      setShareDialogMessage({ tone: 'success', text: 'Share settings updated.' });
    } catch (error) {
      setShareDialogMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to update share settings',
      });
    }
  }, [board, setBoard, shareRole, shareToken, shareVisibility]);

  const handleCopyLink = useCallback(async () => {
    if (!board?.shareSlug) {
      setShareDialogMessage({ tone: 'error', text: 'Enable link sharing first.' });
      return;
    }

    try {
      const url = `${window.location.origin}/share/${board.shareSlug}`;
      await navigator.clipboard.writeText(url);
      setShareDialogMessage({ tone: 'success', text: 'Share link copied to clipboard.' });
    } catch {
      setShareDialogMessage({
        tone: 'error',
        text: 'Clipboard access failed. Copy the share link from the field below.',
      });
    }
  }, [board?.shareSlug]);

  const handleCanvasWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rect = getCanvasRect();
      if (!rect) {
        return;
      }

      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldX = (pointerX - viewport.x) / viewport.zoom;
      const worldY = (pointerY - viewport.y) / viewport.zoom;
      const nextZoom = clampZoom(viewport.zoom * (event.deltaY > 0 ? 0.92 : 1.08));

      setViewport({
        zoom: nextZoom,
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      });
    },
    [setViewport, viewport.x, viewport.y, viewport.zoom]
  );

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      panStateRef.current = {
        pointerX: clientX,
        pointerY: clientY,
        startViewport: viewport,
      };
    },
    [viewport]
  );

  const handleCanvasPointerDown = useCallback(
    async (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canvasRef.current) {
        return;
      }

      const worldPoint = screenToWorld(event.clientX, event.clientY);
      if (event.button === 1 || spacePressedRef.current) {
        beginPan(event.clientX, event.clientY);
        return;
      }

      if (!access?.canEdit && tool !== 'select' && tool !== 'comment') {
        return;
      }

      if (tool === 'text') {
        const created = await createElementWithHistory({
          type: 'text',
          x: worldPoint.x,
          y: worldPoint.y,
          width: 260,
          height: 96,
          content: 'Add text',
          color: DEFAULT_TEXT_COLOR,
          payload: { fontSize: 24, textAlign: 'left' },
        });
        if (created) {
          setSelectedElementId(created.id);
          setEditingElementId(created.id);
        }
        return;
      }

      if (tool === 'draw') {
        drawingRef.current = [worldPoint];
        return;
      }

      setSelectedElementId(null);
      setEditingElementId(null);
    },
    [access?.canEdit, beginPan, createElementWithHistory, screenToWorld, setEditingElementId, setSelectedElementId, tool]
  );

  const handleCanvasPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const worldPoint = screenToWorld(event.clientX, event.clientY);
      sendCursor(worldPoint.x, worldPoint.y);

      if (panStateRef.current) {
        const deltaX = event.clientX - panStateRef.current.pointerX;
        const deltaY = event.clientY - panStateRef.current.pointerY;
        setViewport({
          ...panStateRef.current.startViewport,
          x: panStateRef.current.startViewport.x + deltaX,
          y: panStateRef.current.startViewport.y + deltaY,
        });
        return;
      }

      if (drawingRef.current) {
        drawingRef.current = [...drawingRef.current, worldPoint];
      }
    },
    [screenToWorld, sendCursor, setViewport]
  );

  const handleCanvasPointerUp = useCallback(async () => {
    panStateRef.current = null;

    if (drawingRef.current && access?.canEdit) {
      const points = drawingRef.current;
      drawingRef.current = null;
      if (points.length > 1) {
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxX = Math.max(...points.map((point) => point.x));
        const maxY = Math.max(...points.map((point) => point.y));
        const relativePoints = points.map((point) => ({ x: point.x - minX, y: point.y - minY }));

        await createElementWithHistory({
          type: 'path',
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 1),
          height: Math.max(maxY - minY, 1),
          content: '',
          color: PATH_COLOR,
          payload: createPathPayload(relativePoints),
        });
      }
    }
  }, [access?.canEdit, createElementWithHistory]);

  const handleElementPointerDown = useCallback(
    (event: React.PointerEvent<Element>, element: CanvasElement) => {
      event.stopPropagation();
      setSelectedElementId(element.id);

      if (tool === 'comment') {
        setSelectedElementId(element.id);
        return;
      }

      if (tool !== 'select' || !access?.canEdit) {
        return;
      }

      const worldPoint = screenToWorld(event.clientX, event.clientY);
      dragStateRef.current = {
        elementId: element.id,
        offsetX: worldPoint.x - element.x,
        offsetY: worldPoint.y - element.y,
        startX: element.x,
        startY: element.y,
      };
    },
    [access?.canEdit, screenToWorld, setSelectedElementId, tool]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current) {
        return;
      }

      const worldPoint = screenToWorld(event.clientX, event.clientY);
      const { elementId, offsetX, offsetY } = dragStateRef.current;
      const current = useBoardStore.getState().elements.find((item) => item.id === elementId);
      if (!current) {
        return;
      }

      const x = worldPoint.x - offsetX;
      const y = worldPoint.y - offsetY;
      upsertElement({ ...current, x, y });
      scheduleMove(elementId, x, y);
    };

    const handlePointerUp = () => {
      const drag = dragStateRef.current;
      dragStateRef.current = null;
      panStateRef.current = null;

      if (!drag) {
        return;
      }

      void (async () => {
        await flushMove(drag.elementId);
        const current = useBoardStore.getState().elements.find((item) => item.id === drag.elementId);
        if (!current) {
          return;
        }

        const moved = current.x !== drag.startX || current.y !== drag.startY;
        if (!moved) {
          return;
        }

        pushHistory({
          undo: async () => moveCanvasElement(drag.elementId, drag.startX, drag.startY),
          redo: async () => moveCanvasElement(drag.elementId, current.x, current.y),
        });
      })();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [flushMove, moveCanvasElement, pushHistory, scheduleMove, screenToWorld, upsertElement]);

  const queueContentUpdate = useCallback(
    (elementId: string, content: string) => {
      const current = elements.find((item) => item.id === elementId);
      if (!current) {
        return;
      }
      upsertElement({ ...current, content });

      if (contentTimersRef.current[elementId]) {
        window.clearTimeout(contentTimersRef.current[elementId]);
      }

      contentTimersRef.current[elementId] = window.setTimeout(() => {
        void updateCanvasElement(elementId, { content });
      }, 300);
    },
    [elements, updateCanvasElement, upsertElement]
  );

  const commitElementContent = useCallback(
    async (elementId: string, content: string) => {
      const initialContent = contentStartRef.current[elementId];
      delete contentStartRef.current[elementId];

      const updated = await updateCanvasElement(elementId, { content });
      if (!updated) {
        return;
      }

      if (initialContent === undefined || initialContent === content) {
        return;
      }

      pushHistory({
        undo: async () => updateCanvasElement(elementId, { content: initialContent }),
        redo: async () => updateCanvasElement(elementId, { content }),
      });
    },
    [pushHistory, updateCanvasElement]
  );

  const addStickyNote = useCallback(async () => {
    const created = await createElementWithHistory({
      type: 'sticky',
      x: 120,
      y: 120,
      width: 220,
      height: 160,
      content: 'New note',
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      payload: { fontSize: 16, textAlign: 'left' },
    });
    if (created) {
      setSelectedElementId(created.id);
      setEditingElementId(created.id);
    }
  }, [createElementWithHistory, setEditingElementId, setSelectedElementId]);

  const selectedComments = selectedElement ? commentsByElement[selectedElement.id] || [] : [];
  const canUndo = Boolean(access?.canEdit && historyState.undoDepth > 0);
  const canRedo = Boolean(access?.canEdit && historyState.redoDepth > 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef4ff,_#f7f6ef_55%,_#f3f1ea)] text-slate-700">
        <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-4 shadow-xl backdrop-blur">
          Loading board...
        </div>
      </div>
    );
  }

  if (screenError || !board || !access || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Unable to load board</h1>
          <p className="mt-3 text-sm text-slate-500">{screenError || 'Board data is unavailable.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#f5fbff,_#f5f1e7_52%,_#ece7dc)] text-slate-900">
      <Toaster position="top-center" />

      <div className="absolute inset-x-0 top-0 z-30 mx-auto mt-4 flex w-[min(1220px,calc(100%-2rem))] items-center gap-3 rounded-3xl border border-white/60 bg-white/75 px-5 py-3 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#135BEC] text-lg font-semibold text-white shadow-lg shadow-blue-500/20">
            K
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Realtime board</p>
            <input
              value={boardNameDraft}
              onChange={(event) => setBoardNameDraft(event.target.value)}
              onBlur={() => void saveBoardName()}
              className="bg-transparent text-lg font-semibold outline-none"
            />
          </div>
        </div>

        <div className="ml-4 flex items-center gap-2 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-medium text-slate-500">
          <span className={`h-2 w-2 rounded-full ${access.canEdit ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {access.canEdit ? 'Editor access' : 'Viewer access'}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {access.canEdit && (
            <>
              <button
                onClick={() => void handleUndo()}
                disabled={!canUndo}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  canUndo
                    ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
                title="Undo (Ctrl/Cmd+Z)"
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </button>
              <button
                onClick={() => void handleRedo()}
                disabled={!canRedo}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  canRedo
                    ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
                title="Redo (Ctrl/Cmd+Shift+Z)"
              >
                <Redo2 className="h-4 w-4" />
                Redo
              </button>
            </>
          )}
          {access.canEdit && (
            <button
              onClick={() => void addStickyNote()}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <StickyNote className="h-4 w-4" />
              Add note
            </button>
          )}
          <button
            onClick={() => {
              setShareDialogMessage(null);
              setShareDialogOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>

      <div className="absolute left-6 top-28 z-20 flex flex-col gap-3 rounded-[28px] border border-white/60 bg-white/70 p-3 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        {TOOL_OPTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTool(key)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
              tool === key ? 'bg-[#135BEC] text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}

        <div className="my-1 h-px bg-slate-200" />

        <button
          onClick={() => setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom + 0.1) }))}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <ZoomIn className="h-4 w-4" />
          Zoom in
        </button>
        <button
          onClick={() => setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom - 0.1) }))}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <ZoomOut className="h-4 w-4" />
          Zoom out
        </button>
      </div>

      <div className="absolute right-6 top-28 z-20 flex w-[320px] flex-col gap-3">
        <div className="rounded-[28px] border border-white/60 bg-white/72 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Presence</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{presence.length} active collaborator{presence.length === 1 ? '' : 's'}</p>
            </div>
            <button
              onClick={() => setShowPresence(!showPresence)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500"
            >
              {showPresence ? 'Hide list' : 'Show list'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {presence.map((member) => (
              <div key={member.userId} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} />
                {member.displayName}
              </div>
            ))}
          </div>
          {showPresence && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {presence.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-semibold text-white" style={{ backgroundColor: member.color }}>
                    {member.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{member.displayName}</p>
                    <p className="truncate text-xs text-slate-400">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <label className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={showRemoteCursors}
              onChange={(event) => setShowRemoteCursors(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#135BEC] focus:ring-[#135BEC]"
            />
            Show remote cursors
          </label>
        </div>

        {selectedElement && (
          <div className="rounded-[28px] border border-white/60 bg-white/82 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Comments</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{selectedComments.length} thread item{selectedComments.length === 1 ? '' : 's'}</p>
              </div>
              {access.canEdit && (
                <button
                  onClick={() => void deleteElementWithHistory(selectedElement.id)}
                  className="rounded-full border border-red-200 bg-red-50 p-2 text-red-500 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {selectedComments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-700">{comment.authorName}</p>
                    <p className="text-[11px] text-slate-400">{new Date(comment.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{comment.content}</p>
                </div>
              ))}
              {selectedComments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                  No comments yet for this element.
                </div>
              )}
            </div>
            {access.canEdit && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={commentInput}
                  onChange={(event) => setCommentInput(event.target.value)}
                  placeholder="Add context, feedback, or a decision..."
                  className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#135BEC]"
                />
                <button
                  onClick={() => {
                    if (!selectedElement || !commentInput.trim()) {
                      return;
                    }
                    void createElementComment(selectedElement.id, commentInput.trim());
                    setCommentInput('');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-[#135BEC] px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  Post comment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-6 z-20 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-lg backdrop-blur">
        <Users className="h-4 w-4" />
        {Math.round(viewport.zoom * 100)}%
      </div>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={() => void handleCanvasPointerUp()}
        onWheel={handleCanvasWheel}
        style={{
          backgroundImage: `radial-gradient(circle, rgba(15,23,42,0.12) 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          cursor: spacePressedRef.current ? 'grab' : tool === 'draw' ? 'crosshair' : 'default',
        }}
      >
        {elements.map((element) => {
          const screen = worldToScreen(viewport, { x: element.x, y: element.y });
          const commentCount = commentsByElement[element.id]?.length || 0;
          const isSelected = selectedElementId === element.id;

          if (element.type === 'path') {
            const points = (element.payload.points || []) as PathPoint[];
            const pathData = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * viewport.zoom} ${point.y * viewport.zoom}`).join(' ');
            return (
              <svg
                key={element.id}
                onPointerDown={(event) => handleElementPointerDown(event, element)}
                style={{
                  position: 'absolute',
                  left: screen.x,
                  top: screen.y,
                  width: element.width * viewport.zoom,
                  height: element.height * viewport.zoom,
                  overflow: 'visible',
                  filter: isSelected ? 'drop-shadow(0 0 18px rgba(19,91,236,0.25))' : 'none',
                  pointerEvents: 'auto',
                }}
              >
                <path
                  d={pathData}
                  fill="none"
                  stroke={element.color}
                  strokeWidth={(Number(element.payload.strokeWidth) || 4) * viewport.zoom}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          }

          const isSticky = element.type === 'sticky';
          const textareaStyles = isSticky
            ? 'rounded-[24px] border border-slate-200/80 shadow-[0_18px_38px_rgba(15,23,42,0.12)]'
            : 'rounded-2xl';

          return (
            <div
              key={element.id}
              onPointerDown={(event) => handleElementPointerDown(event, element)}
              className={`absolute overflow-hidden transition ${textareaStyles} ${isSelected ? 'ring-2 ring-[#135BEC]/70 ring-offset-2 ring-offset-transparent' : ''}`}
              style={{
                left: screen.x,
                top: screen.y,
                width: Math.max(element.width * viewport.zoom, 40),
                height: Math.max(element.height * viewport.zoom, 40),
                background: isSticky ? element.color : 'transparent',
              }}
            >
              {commentCount > 0 && (
                <div className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                  <MessageSquare className="h-3 w-3" />
                  {commentCount}
                </div>
              )}
              <textarea
                value={element.content}
                onFocus={() => {
                  setEditingElementId(element.id);
                  if (contentStartRef.current[element.id] === undefined) {
                    contentStartRef.current[element.id] = element.content;
                  }
                }}
                onBlur={() => {
                  setEditingElementId(null);
                  const timer = contentTimersRef.current[element.id];
                  if (timer) {
                    window.clearTimeout(timer);
                    delete contentTimersRef.current[element.id];
                  }
                  void commitElementContent(element.id, element.content);
                  void saveBoardName();
                }}
                onChange={(event) => queueContentUpdate(element.id, event.target.value)}
                readOnly={!access.canEdit}
                className={`h-full w-full resize-none border-none bg-transparent px-4 py-4 text-sm leading-6 text-slate-700 outline-none ${
                  element.type === 'text' ? 'font-semibold text-slate-800' : ''
                }`}
                style={{
                  color: element.type === 'text' ? element.color : '#1f2937',
                  fontSize: `${(Number(element.payload.fontSize) || (element.type === 'text' ? 24 : 16)) * viewport.zoom}px`,
                  textAlign: (element.payload.textAlign as 'left' | 'center' | 'right') || 'left',
                }}
              />
            </div>
          );
        })}

        {showRemoteCursors &&
          Object.values(cursors).map((cursor) => {
            const position = worldToScreen(viewport, { x: cursor.x, y: cursor.y });
            return (
              <div
                key={cursor.userId}
                className="pointer-events-none absolute z-20"
                style={{ left: position.x, top: position.y, transition: 'transform 70ms linear' }}
              >
                <div className="relative">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 3l12 8-6 1.2-2.6 7.3z" fill={cursor.color} stroke="white" strokeWidth="1.4" />
                  </svg>
                  <div
                    className="mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
                    style={{ backgroundColor: cursor.color }}
                  >
                    {cursor.displayName}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {shareDialogOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-white/70 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Share board</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Control link access</h2>
              </div>
              <button
                onClick={() => {
                  setShareDialogMessage(null);
                  setShareDialogOpen(false);
                }}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Visibility
                <select
                  value={shareVisibility}
                  onChange={(event) => setShareVisibility(event.target.value as BoardVisibility)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                >
                  <option value="private">Private</option>
                  <option value="link">Anyone with the link</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Link permission
                <select
                  value={shareRole}
                  onChange={(event) => setShareRole(event.target.value as ShareRole)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
              </label>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                {board.shareSlug ? `${window.location.origin}/share/${board.shareSlug}` : 'No share link generated yet.'}
              </div>
              {shareDialogMessage && (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    shareDialogMessage.tone === 'success'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {shareDialogMessage.text}
                </div>
              )}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => void handleCopyLink()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShareDialogMessage(null);
                    setShareDialogOpen(false);
                  }}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleShareSave()}
                  className="rounded-full bg-[#135BEC] px-4 py-2 text-sm font-medium text-white"
                >
                  Save settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
