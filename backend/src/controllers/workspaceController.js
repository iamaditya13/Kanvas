const { validate } = require('../lib/validation');
const { workspaceSchema, boardSchema } = require('../validators/boardSchemas');
const {
  listWorkspacesForUser,
  createWorkspace,
  listBoardsForWorkspace,
  createBoard,
} = require('../services/workspaceService');

const getWorkspaces = async (req, res) => {
  const workspaces = await listWorkspacesForUser(req.user.id);
  res.json(workspaces);
};

const postWorkspace = async (req, res) => {
  const payload = validate(workspaceSchema, req.body);
  const workspace = await createWorkspace(req.user.id, payload.name);
  res.status(201).json(workspace);
};

const getBoards = async (req, res) => {
  const boards = await listBoardsForWorkspace(req.params.workspaceId, req.user.id);
  res.json(boards);
};

const postBoard = async (req, res) => {
  const payload = validate(boardSchema, req.body);
  const board = await createBoard(req.params.workspaceId, req.user.id, payload.name);
  res.status(201).json(board);
};

module.exports = {
  getWorkspaces,
  postWorkspace,
  getBoards,
  postBoard,
};
