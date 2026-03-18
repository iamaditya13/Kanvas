import { create } from 'zustand';
import {
  BoardAccess,
  BoardComment,
  BoardInfo,
  BoardSessionResponse,
  CanvasElement,
  PresenceUser,
  RemoteCursor,
  Tool,
  UserIdentity,
  ViewportState,
} from '../types';

interface BoardStore {
  board: BoardInfo | null;
  access: BoardAccess | null;
  currentUser: UserIdentity | null;
  elements: CanvasElement[];
  comments: BoardComment[];
  presence: PresenceUser[];
  cursors: Record<string, RemoteCursor>;
  tool: Tool;
  selectedElementId: string | null;
  editingElementId: string | null;
  viewport: ViewportState;
  showPresence: boolean;
  showRemoteCursors: boolean;
  shareDialogOpen: boolean;
  initialize: (session: BoardSessionResponse) => void;
  setBoard: (board: BoardInfo) => void;
  upsertElement: (element: CanvasElement) => void;
  replaceElement: (tempId: string, element: CanvasElement) => void;
  removeElement: (elementId: string) => void;
  setComments: (comments: BoardComment[]) => void;
  upsertComment: (comment: BoardComment) => void;
  setPresence: (presence: PresenceUser[]) => void;
  setCursor: (cursor: RemoteCursor) => void;
  removeCursor: (userId: string) => void;
  setTool: (tool: Tool) => void;
  setSelectedElementId: (elementId: string | null) => void;
  setEditingElementId: (elementId: string | null) => void;
  setViewport: (updater: ViewportState | ((current: ViewportState) => ViewportState)) => void;
  setShowPresence: (value: boolean) => void;
  setShowRemoteCursors: (value: boolean) => void;
  setShareDialogOpen: (value: boolean) => void;
  reset: () => void;
}

const initialViewport: ViewportState = { x: 160, y: 120, zoom: 1 };

const replaceById = <T extends { id: string }>(items: T[], nextItem: T) => {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...items, nextItem];
  }

  const updated = [...items];
  updated[index] = nextItem;
  return updated;
};

export const useBoardStore = create<BoardStore>((set) => ({
  board: null,
  access: null,
  currentUser: null,
  elements: [],
  comments: [],
  presence: [],
  cursors: {},
  tool: 'select',
  selectedElementId: null,
  editingElementId: null,
  viewport: initialViewport,
  showPresence: true,
  showRemoteCursors: true,
  shareDialogOpen: false,
  initialize: (session) =>
    set({
      board: session.board,
      access: session.access,
      currentUser: session.currentUser,
      elements: session.elements,
      comments: session.comments,
      presence: session.presence,
      cursors: {},
      selectedElementId: null,
      editingElementId: null,
    }),
  setBoard: (board) => set({ board }),
  upsertElement: (element) =>
    set((state) => ({
      elements: replaceById(state.elements, element).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })),
  replaceElement: (tempId, element) =>
    set((state) => ({
      elements: state.elements
        .filter((item) => item.id !== tempId)
        .concat(element)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      selectedElementId: state.selectedElementId === tempId ? element.id : state.selectedElementId,
      editingElementId: state.editingElementId === tempId ? element.id : state.editingElementId,
    })),
  removeElement: (elementId) =>
    set((state) => ({
      elements: state.elements.filter((element) => element.id !== elementId),
      comments: state.comments.filter((comment) => comment.elementId !== elementId),
      selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
      editingElementId: state.editingElementId === elementId ? null : state.editingElementId,
    })),
  setComments: (comments) => set({ comments }),
  upsertComment: (comment) => set((state) => ({ comments: replaceById(state.comments, comment) })),
  setPresence: (presence) => set({ presence }),
  setCursor: (cursor) =>
    set((state) => ({
      cursors: {
        ...state.cursors,
        [cursor.userId]: cursor,
      },
    })),
  removeCursor: (userId) =>
    set((state) => {
      const next = { ...state.cursors };
      delete next[userId];
      return { cursors: next };
    }),
  setTool: (tool) => set({ tool }),
  setSelectedElementId: (selectedElementId) => set({ selectedElementId }),
  setEditingElementId: (editingElementId) => set({ editingElementId }),
  setViewport: (updater) =>
    set((state) => ({
      viewport: typeof updater === 'function' ? updater(state.viewport) : updater,
    })),
  setShowPresence: (showPresence) => set({ showPresence }),
  setShowRemoteCursors: (showRemoteCursors) => set({ showRemoteCursors }),
  setShareDialogOpen: (shareDialogOpen) => set({ shareDialogOpen }),
  reset: () =>
    set({
      board: null,
      access: null,
      currentUser: null,
      elements: [],
      comments: [],
      presence: [],
      cursors: {},
      tool: 'select',
      selectedElementId: null,
      editingElementId: null,
      viewport: initialViewport,
      showPresence: true,
      showRemoteCursors: true,
      shareDialogOpen: false,
    }),
}));
