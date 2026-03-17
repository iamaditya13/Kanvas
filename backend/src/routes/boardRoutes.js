const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');
const { requireBoardAccess } = require('../middleware/requireBoardAccess');
const { getSession, patchBoard, postShareSettings, getShare } = require('../controllers/boardController');

const boardRouter = express.Router();
const shareRouter = express.Router();

boardRouter.use(requireAuth);
boardRouter.get('/:boardId/session', requireBoardAccess('viewer'), asyncHandler(getSession));
boardRouter.patch('/:boardId', requireBoardAccess('editor'), asyncHandler(patchBoard));
boardRouter.post('/:boardId/share', requireBoardAccess('editor'), asyncHandler(postShareSettings));

shareRouter.use(requireAuth);
shareRouter.get('/:slug', asyncHandler(getShare));

module.exports = {
  boardRoutes: boardRouter,
  shareRoutes: shareRouter,
};
