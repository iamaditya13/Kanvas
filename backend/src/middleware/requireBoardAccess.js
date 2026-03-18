const { AppError } = require('../lib/appError');
const { resolveBoardAccess } = require('../services/accessService');

const getShareToken = (req) => req.headers['x-board-share-token'] || req.query.share || null;

const requireBoardAccess = (requiredLevel = 'viewer') => async (req, res, next) => {
  try {
    const boardId = req.params.boardId || req.body.boardId;
    const shareSlug = getShareToken(req);

    const access = await resolveBoardAccess({
      boardId,
      userId: req.user?.id || null,
      shareSlug,
    });

    if (requiredLevel === 'editor' && !access.canEdit) {
      throw new AppError(403, 'BOARD_EDIT_FORBIDDEN', 'You do not have permission to edit this board');
    }

    req.boardAccess = access;
    req.shareSlug = shareSlug;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireBoardAccess, getShareToken };
