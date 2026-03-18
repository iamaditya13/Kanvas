const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');
const {
  getWorkspaces,
  postWorkspace,
  getBoards,
  postBoard,
  destroyBoard,
} = require('../controllers/workspaceController');

const router = express.Router();

router.use(requireAuth);
router.get('/', asyncHandler(getWorkspaces));
router.post('/', asyncHandler(postWorkspace));
router.get('/:workspaceId/boards', asyncHandler(getBoards));
router.post('/:workspaceId/boards', asyncHandler(postBoard));
router.delete('/:workspaceId/boards/:boardId', asyncHandler(destroyBoard));

module.exports = { workspaceRoutes: router };
