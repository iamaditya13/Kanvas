export type Tool = 'select' | 'draw' | 'text' | 'comment';
export type ElementType = 'sticky' | 'text' | 'path';
export type BoardVisibility = 'private' | 'link';
export type ShareRole = 'viewer' | 'editor';

export interface BoardInfo {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  visibility: BoardVisibility;
  shareRole: ShareRole;
  shareSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardAccess {
  mode: 'member' | 'share';
  role: 'admin' | 'member' | 'viewer' | ShareRole;
  canEdit: boolean;
}

export interface UserIdentity {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface ElementPayload {
  points?: PathPoint[];
  strokeWidth?: number;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  [key: string]: unknown;
}

export interface CanvasElement {
  id: string;
  boardId: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  payload: ElementPayload;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  optimistic?: boolean;
}

export interface BoardComment {
  id: string;
  boardId: string;
  elementId: string;
  content: string;
  createdAt: string;
  createdBy: string;
  authorName: string;
  authorEmail: string;
  optimistic?: boolean;
}

export interface PresenceUser {
  boardId: string;
  userId: string;
  email: string;
  displayName: string;
  color: string;
  lastSeen: string;
}

export interface RemoteCursor {
  boardId: string;
  userId: string;
  email: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardSessionResponse {
  board: BoardInfo;
  elements: CanvasElement[];
  comments: BoardComment[];
  access: BoardAccess;
  currentUser: UserIdentity;
  presence: PresenceUser[];
}

export interface SocketAck<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: { path: string; message: string }[] | null;
  };
}
