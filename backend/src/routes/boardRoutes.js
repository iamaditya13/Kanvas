const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth, optionalAuth } = require('../middleware/requireAuth');
const { requireBoardAccess } = require('../middleware/requireBoardAccess');
const { getSession, patchBoard, postShareSettings, getShare } = require('../controllers/boardController');

const boardRouter = express.Router();
const shareRouter = express.Router();

boardRouter.get('/:boardId/session', optionalAuth, requireBoardAccess('viewer'), asyncHandler(getSession));
boardRouter.use(requireAuth);
boardRouter.patch('/:boardId', requireBoardAccess('editor'), asyncHandler(patchBoard));
boardRouter.post('/:boardId/share', requireBoardAccess('editor'), asyncHandler(postShareSettings));

shareRouter.get('/:slug', optionalAuth, asyncHandler(getShare));

module.exports = {
  boardRoutes: boardRouter,
  shareRoutes: shareRouter,
};
