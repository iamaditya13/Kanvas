'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { socketService } from '@/lib/socket';
import { useBoardStore } from './store/useBoardStore';
import { BoardComment, CanvasElement, ElementPayload, PathPoint, PresenceUser, RemoteCursor } from './types';

export interface CreateElementInput {
  id?: string;
  type: CanvasElement['type'];
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  payload: ElementPayload;
}

const buildOptimisticElement = (boardId: string, userId: string, draft: CreateElementInput): CanvasElement => {
  const timestamp = new Date().toISOString();
  return {
    id: draft.id || `temp-${crypto.randomUUID()}`,
    boardId,
    type: draft.type,
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    content: draft.content,
    color: draft.color,
    payload: draft.payload,
    version: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: userId,
    updatedBy: userId,
    optimistic: true,
  };
};

const buildOptimisticComment = (
  boardId: string,
  elementId: string,
  content: string,
  user: { id: string; displayName: string; email: string }
): BoardComment => ({
  id: `temp-${crypto.randomUUID()}`,
  boardId,
  elementId,
  content,
  createdAt: new Date().toISOString(),
  createdBy: user.id,
  authorName: user.displayName,
  authorEmail: user.email,
  optimistic: true,
});

const isNewerElement = (current: CanvasElement | undefined, incoming: CanvasElement) => {
  if (!current) {
    return true;
  }

  return incoming.version >= current.version;
};

export const useBoardCollaboration = ({
  boardId,
  shareToken,
  enabled,
  onFeedback,
}: {
  boardId: string;
  shareToken?: string;
  enabled: boolean;
  onFeedback?: (message: string) => void;
}) => {
  const session = useBoardStore((state) => state.currentUser);
  const access = useBoardStore((state) => state.access);
  const elements = useBoardStore((state) => state.elements);
  const setPresence = useBoardStore((state) => state.setPresence);
  const removeCursor = useBoardStore((state) => state.removeCursor);
  const setCursor = useBoardStore((state) => state.setCursor);
  const upsertElement = useBoardStore((state) => state.upsertElement);
  const removeElement = useBoardStore((state) => state.removeElement);
  const upsertComment = useBoardStore((state) => state.upsertComment);
  const setComments = useBoardStore((state) => state.setComments);
  const replaceElement = useBoardStore((state) => state.replaceElement);
  const setSelectedElementId = useBoardStore((state) => state.setSelectedElementId);
  const heartbeatRef = useRef<number | null>(null);
  const cursorThrottleRef = useRef(0);
  const notifyError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      const message = error instanceof Error ? error.message : fallbackMessage;
      onFeedback?.(message);
    },
    [onFeedback]
  );

  const boardElementsMap = useMemo(() => {
    const map = new Map<string, CanvasElement>();
    for (const element of elements) {
      map.set(element.id, element);
    }
    return map;
  }, [elements]);

  const withSocket = useCallback(async <TResponse,>(operation: (socket: ReturnType<typeof socketService.getSocket>) => Promise<TResponse>) => {
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();

    if (!authSession?.access_token) {
      throw new Error('Authentication is required');
    }

    const socket = socketService.getSocket(authSession.access_token);
    return operation(socket);
  }, []);

  useEffect(() => {
    if (!enabled || !access || !session) {
      return undefined;
    }

    let active = true;

    const connect = async () => {
      try {
        await withSocket(async (socket) => {
          const handlePresence = (presence: PresenceUser[]) => {
            setPresence(presence);
            const liveUserIds = new Set(presence.map((item) => item.userId));
            Object.keys(useBoardStore.getState().cursors).forEach((userId) => {
              if (!liveUserIds.has(userId)) {
                removeCursor(userId);
              }
            });
          };

          const handleElementMutation = (incoming: { element: CanvasElement }) => {
            const current = useBoardStore.getState().elements.find((item) => item.id === incoming.element.id);
            if (isNewerElement(current, incoming.element)) {
              upsertElement(incoming.element);
            }
          };

          socket.on('presence:update', handlePresence);
          socket.on('cursor:moved', (cursor: RemoteCursor) => {
            if (cursor.userId !== session.id) {
              setCursor(cursor);
            }
          });
          socket.on('cursor:left', ({ userId }: { boardId: string; userId: string }) => removeCursor(userId));
          socket.on('element:created', handleElementMutation);
          socket.on('element:updated', handleElementMutation);
          socket.on('element:moved', handleElementMutation);
          socket.on('element:deleted', ({ elementId }: { boardId: string; elementId: string }) => removeElement(elementId));
          socket.on('comment:created', ({ comment }: { comment: BoardComment }) => upsertComment(comment));
          socket.on('socket:error', ({ message }: { message: string }) => onFeedback?.(message));

          await socketService.emitWithAck(socket, 'board:join', { boardId, shareToken });

          heartbeatRef.current = window.setInterval(() => {
            void socketService.emitWithAck(socket, 'presence:heartbeat', { boardId }).catch(() => undefined);
          }, 15000);
        });
      } catch (error) {
        if (active) {
          notifyError(error, 'Failed to connect to the board');
        }
      }
    };

    void connect();

    return () => {
      active = false;
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      void withSocket(async (socket) => {
        socket.off('presence:update');
        socket.off('cursor:moved');
        socket.off('cursor:left');
        socket.off('element:created');
        socket.off('element:updated');
        socket.off('element:moved');
        socket.off('element:deleted');
        socket.off('comment:created');
        socket.off('socket:error');
        await socketService.emitWithAck(socket, 'board:leave', { boardId }).catch(() => undefined);
        return undefined;
      });
    };
  }, [
    access,
    boardId,
    enabled,
    notifyError,
    onFeedback,
    removeCursor,
    removeElement,
    session,
    setCursor,
    setPresence,
    shareToken,
    upsertComment,
    upsertElement,
    withSocket,
  ]);

  const createCanvasElement = useCallback(
    async (draft: CreateElementInput) => {
      if (!session) {
        return null;
      }

      const optimistic = buildOptimisticElement(boardId, session.id, draft);
      upsertElement(optimistic);
      setSelectedElementId(optimistic.id);

      try {
        const data = await withSocket((socket) =>
          socketService.emitWithAck<
            { boardId: string; clientMutationId: string; element: CreateElementInput },
            { clientMutationId: string; element: CanvasElement }
          >(socket, 'element:create', {
            boardId,
            clientMutationId: crypto.randomUUID(),
            element: draft,
          })
        );
        replaceElement(optimistic.id, data.element);
        return data.element;
      } catch (error) {
        removeElement(optimistic.id);
        notifyError(error, 'Failed to create element');
        return null;
      }
    },
    [boardId, notifyError, replaceElement, removeElement, session, setSelectedElementId, upsertElement, withSocket]
  );

  const moveCanvasElement = useCallback(
    async (elementId: string, x: number, y: number): Promise<boolean> => {
      const current = boardElementsMap.get(elementId);
      if (!current) {
        return false;
      }

      upsertElement({ ...current, x, y });

      try {
        const data = await withSocket((socket) =>
          socketService.emitWithAck<
            { boardId: string; clientMutationId: string; elementId: string; position: { x: number; y: number } },
            { clientMutationId: string; element: CanvasElement }
          >(socket, 'element:move', {
            boardId,
            clientMutationId: crypto.randomUUID(),
            elementId,
            position: { x, y },
          })
        );
        upsertElement(data.element);
        return true;
      } catch (error) {
        upsertElement(current);
        notifyError(error, 'Failed to move element');
        return false;
      }
    },
    [boardElementsMap, boardId, notifyError, upsertElement, withSocket]
  );

  const updateCanvasElement = useCallback(
    async (
      elementId: string,
      patch: Partial<Pick<CanvasElement, 'content' | 'x' | 'y' | 'width' | 'height' | 'color'>> & { payload?: ElementPayload }
    ): Promise<boolean> => {
      const current = boardElementsMap.get(elementId);
      if (!current) {
        return false;
      }

      const optimistic: CanvasElement = {
        ...current,
        ...patch,
        payload: patch.payload ? { ...current.payload, ...patch.payload } : current.payload,
      };
      upsertElement(optimistic);

      try {
        const data = await withSocket((socket) =>
          socketService.emitWithAck<
            { boardId: string; clientMutationId: string; elementId: string; patch: typeof patch },
            { clientMutationId: string; element: CanvasElement }
          >(socket, 'element:update', {
            boardId,
            clientMutationId: crypto.randomUUID(),
            elementId,
            patch,
          })
        );
        upsertElement(data.element);
        return true;
      } catch (error) {
        upsertElement(current);
        notifyError(error, 'Failed to update element');
        return false;
      }
    },
    [boardElementsMap, boardId, notifyError, upsertElement, withSocket]
  );

  const deleteCanvasElement = useCallback(
    async (elementId: string): Promise<boolean> => {
      const current = boardElementsMap.get(elementId);
      if (!current) {
        return false;
      }

      removeElement(elementId);
      try {
        await withSocket((socket) =>
          socketService.emitWithAck<
            { boardId: string; clientMutationId: string; elementId: string },
            { clientMutationId: string; elementId: string }
          >(socket, 'element:delete', {
            boardId,
            clientMutationId: crypto.randomUUID(),
            elementId,
          })
        );
        return true;
      } catch (error) {
        upsertElement(current);
        notifyError(error, 'Failed to delete element');
        return false;
      }
    },
    [boardElementsMap, boardId, notifyError, removeElement, upsertElement, withSocket]
  );

  const createElementComment = useCallback(
    async (elementId: string, content: string) => {
      if (!session) {
        return;
      }

      const optimistic = buildOptimisticComment(boardId, elementId, content, session);
      upsertComment(optimistic);

      try {
        const data = await withSocket((socket) =>
          socketService.emitWithAck<
            { boardId: string; clientMutationId: string; comment: { elementId: string; content: string } },
            { clientMutationId: string; comment: BoardComment }
          >(socket, 'comment:create', {
            boardId,
            clientMutationId: crypto.randomUUID(),
            comment: { elementId, content },
          })
        );
        upsertComment(data.comment);
      } catch (error) {
        setComments(useBoardStore.getState().comments.filter((comment) => comment.id !== optimistic.id));
        notifyError(error, 'Failed to add comment');
      }
    },
    [boardId, notifyError, session, setComments, upsertComment, withSocket]
  );

  const sendCursor = useCallback(
    (x: number, y: number) => {
      const now = performance.now();
      if (now - cursorThrottleRef.current < 40) {
        return;
      }
      cursorThrottleRef.current = now;

      void withSocket(async (socket) => {
        socket.emit('cursor:move', { boardId, x, y });
        return undefined;
      });
    },
    [boardId, withSocket]
  );

  return {
    createCanvasElement,
    moveCanvasElement,
    updateCanvasElement,
    deleteCanvasElement,
    createElementComment,
    sendCursor,
  };
};

export const createPathPayload = (points: PathPoint[], strokeWidth = 4) => ({
  points,
  strokeWidth,
});
