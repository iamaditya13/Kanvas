const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { requireAuth } = require('../middleware/requireAuth');
const {
  getWorkspaces,
  postWorkspace,
  getBoards,
  postBoard,
} = require('../controllers/workspaceController');

const router = express.Router();

router.use(requireAuth);
router.get('/', asyncHandler(getWorkspaces));
router.post('/', asyncHandler(postWorkspace));
router.get('/:workspaceId/boards', asyncHandler(getBoards));
router.post('/:workspaceId/boards', asyncHandler(postBoard));

module.exports = { workspaceRoutes: router };
