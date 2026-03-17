const { validate } = require('../lib/validation');
const {
  boardUpdateSchema,
  shareSettingsSchema,
} = require('../validators/boardSchemas');
const { getBoardSession, updateBoard, updateShareSettings, resolveShare } = require('../services/boardService');
const { resolveShareAccess } = require('../services/accessService');
const { listPresence } = require('../services/presenceService');

const getSession = async (req, res) => {
  const session = await getBoardSession(req.params.boardId);
  const presence = await listPresence(req.params.boardId);

  res.json({
    ...session,
    access: {
      mode: req.boardAccess.accessMode,
      role: req.boardAccess.role,
      canEdit: req.boardAccess.canEdit,
    },
    currentUser: req.user,
    presence,
  });
};

const patchBoard = async (req, res) => {
  const payload = validate(boardUpdateSchema, req.body);
  const board = await updateBoard(req.params.boardId, req.user.id, payload.name);
  res.json(board);
};

const postShareSettings = async (req, res) => {
  const payload = validate(shareSettingsSchema, req.body);
  const board = await updateShareSettings(req.params.boardId, req.user.id, payload);
  res.json(board);
};

const getShare = async (req, res) => {
  const access = await resolveShareAccess({ shareSlug: req.params.slug, userId: req.user.id });
  const board = await resolveShare(req.params.slug);

  res.json({
    boardId: board.id,
    boardName: board.name,
    shareSlug: board.shareSlug,
    access: {
      mode: access.accessMode,
      role: access.role,
      canEdit: access.canEdit,
    },
  });
};

module.exports = {
  getSession,
  patchBoard,
  postShareSettings,
  getShare,
};
