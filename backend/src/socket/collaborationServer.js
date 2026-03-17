const { Server } = require('socket.io');
const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { syncAuthUser } = require('../services/userService');
const { validate } = require('../lib/validation');
const {
  boardJoinSchema,
  cursorMoveSchema,
  createElementEventSchema,
  updateElementEventSchema,
  moveElementEventSchema,
  deleteElementEventSchema,
  commentEventSchema,
  heartbeatSchema,
} = require('../validators/boardSchemas');
const { resolveBoardAccess } = require('../services/accessService');
const { touchPresence, removeSocketPresence, listPresence } = require('../services/presenceService');
const { createElement, updateElement, moveElement, deleteElement } = require('../services/elementService');
const { createComment } = require('../services/commentService');

const roomName = (boardId) => `board:${boardId}`;

const serializeError = (error) => {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details || null,
    };
  }

  console.error(error);
  return {
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    details: null,
  };
};

const reply = (ack, payload) => {
  if (typeof ack === 'function') {
    ack(payload);
  }
};

const createCollaborationServer = ({ httpServer, cors }) => {
  const io = new Server(httpServer, {
    cors,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required');
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new AppError(401, 'AUTH_INVALID', 'Invalid or expired access token');
      }

      socket.data.user = await syncAuthUser(user);
      socket.data.boardSessions = new Map();
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const withAck = async (ack, handler) => {
      try {
        const data = await handler();
        reply(ack, { ok: true, data });
      } catch (error) {
        reply(ack, { ok: false, error: serializeError(error) });
      }
    };

    const getBoardSession = async (boardId, requiredLevel = 'viewer') => {
      const boardSession = socket.data.boardSessions.get(boardId);
      const access = await resolveBoardAccess({
        boardId,
        userId: socket.data.user.id,
        shareSlug: boardSession?.shareToken || null,
      });

      if (requiredLevel === 'editor' && !access.canEdit) {
        throw new AppError(403, 'BOARD_EDIT_FORBIDDEN', 'You do not have permission to edit this board');
      }

      return {
        ...access,
        color: boardSession?.color || null,
      };
    };

    socket.on('board:join', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(boardJoinSchema, payload);
        const access = await resolveBoardAccess({
          boardId: parsed.boardId,
          userId: socket.data.user.id,
          shareSlug: parsed.shareToken || null,
        });

        socket.join(roomName(parsed.boardId));
        socket.data.boardSessions.set(parsed.boardId, { shareToken: parsed.shareToken || null });

        const presence = await touchPresence({
          boardId: parsed.boardId,
          user: socket.data.user,
          socketId: socket.id,
        });

        const currentUserPresence = presence.find((item) => item.userId === socket.data.user.id) || null;
        socket.data.boardSessions.set(parsed.boardId, {
          shareToken: parsed.shareToken || null,
          color: currentUserPresence?.color || null,
        });

        io.to(roomName(parsed.boardId)).emit('presence:update', presence);

        return {
          board: access.board,
          access: {
            mode: access.accessMode,
            role: access.role,
            canEdit: access.canEdit,
          },
          presence,
          currentUser: currentUserPresence,
        };
      })
    );

    socket.on('board:leave', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(heartbeatSchema, payload);
        socket.leave(roomName(parsed.boardId));
        socket.data.boardSessions.delete(parsed.boardId);
        await removeSocketPresence({ socketId: socket.id, boardId: parsed.boardId });
        io.to(roomName(parsed.boardId)).emit('cursor:left', {
          boardId: parsed.boardId,
          userId: socket.data.user.id,
        });
        const presence = await listPresence(parsed.boardId);
        io.to(roomName(parsed.boardId)).emit('presence:update', presence);
        return { boardId: parsed.boardId };
      })
    );

    socket.on('presence:heartbeat', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(heartbeatSchema, payload);
        await getBoardSession(parsed.boardId, 'viewer');
        const presence = await touchPresence({
          boardId: parsed.boardId,
          user: socket.data.user,
          socketId: socket.id,
        });
        io.to(roomName(parsed.boardId)).emit('presence:update', presence);
        return { boardId: parsed.boardId, presence };
      })
    );

    socket.on('cursor:move', async (payload) => {
      try {
        const parsed = validate(cursorMoveSchema, payload);
        const access = await getBoardSession(parsed.boardId, 'viewer');
        socket.to(roomName(parsed.boardId)).emit('cursor:moved', {
          boardId: parsed.boardId,
          userId: socket.data.user.id,
          displayName: socket.data.user.displayName,
          email: socket.data.user.email,
          color: access.color,
          x: parsed.x,
          y: parsed.y,
        });
      } catch (error) {
        socket.emit('socket:error', serializeError(error));
      }
    });

    socket.on('element:create', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(createElementEventSchema, payload);
        await getBoardSession(parsed.boardId, 'editor');
        const element = await createElement(parsed.boardId, socket.data.user.id, parsed.element);
        socket.to(roomName(parsed.boardId)).emit('element:created', {
          boardId: parsed.boardId,
          actorId: socket.data.user.id,
          clientMutationId: parsed.clientMutationId,
          element,
        });
        return { clientMutationId: parsed.clientMutationId, element };
      })
    );

    socket.on('element:move', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(moveElementEventSchema, payload);
        await getBoardSession(parsed.boardId, 'editor');
        const element = await moveElement(parsed.boardId, parsed.elementId, socket.data.user.id, parsed.position);
        socket.to(roomName(parsed.boardId)).emit('element:moved', {
          boardId: parsed.boardId,
          actorId: socket.data.user.id,
          clientMutationId: parsed.clientMutationId,
          element,
        });
        return { clientMutationId: parsed.clientMutationId, element };
      })
    );

    socket.on('element:update', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(updateElementEventSchema, payload);
        await getBoardSession(parsed.boardId, 'editor');
        const element = await updateElement(parsed.boardId, parsed.elementId, socket.data.user.id, parsed.patch);
        socket.to(roomName(parsed.boardId)).emit('element:updated', {
          boardId: parsed.boardId,
          actorId: socket.data.user.id,
          clientMutationId: parsed.clientMutationId,
          element,
        });
        return { clientMutationId: parsed.clientMutationId, element };
      })
    );

    socket.on('element:delete', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(deleteElementEventSchema, payload);
        await getBoardSession(parsed.boardId, 'editor');
        const result = await deleteElement(parsed.boardId, parsed.elementId, socket.data.user.id);
        socket.to(roomName(parsed.boardId)).emit('element:deleted', {
          boardId: parsed.boardId,
          actorId: socket.data.user.id,
          clientMutationId: parsed.clientMutationId,
          elementId: result.id,
        });
        return { clientMutationId: parsed.clientMutationId, elementId: result.id };
      })
    );

    socket.on('comment:create', (payload, ack) =>
      withAck(ack, async () => {
        const parsed = validate(commentEventSchema, payload);
        await getBoardSession(parsed.boardId, 'editor');
        const comment = await createComment({
          boardId: parsed.boardId,
          elementId: parsed.comment.elementId,
          content: parsed.comment.content,
          user: socket.data.user,
        });
        socket.to(roomName(parsed.boardId)).emit('comment:created', {
          boardId: parsed.boardId,
          actorId: socket.data.user.id,
          clientMutationId: parsed.clientMutationId,
          comment,
        });
        return { clientMutationId: parsed.clientMutationId, comment };
      })
    );

    socket.on('disconnect', async () => {
      const joinedBoards = Array.from(socket.data.boardSessions.keys());
      await removeSocketPresence({ socketId: socket.id });

      for (const boardId of joinedBoards) {
        io.to(roomName(boardId)).emit('cursor:left', {
          boardId,
          userId: socket.data.user.id,
        });
        const presence = await listPresence(boardId).catch(() => []);
        io.to(roomName(boardId)).emit('presence:update', presence);
      }
    });
  });

  return io;
};

module.exports = { createCollaborationServer };
