const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { mapBoard } = require('./mappers');

const getWorkspaceMembership = async (workspaceId, userId) => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'WORKSPACE_ACCESS_LOOKUP_FAILED', error.message);
  }

  return data;
};

const getBoardRecord = async (boardId) => {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'BOARD_LOOKUP_FAILED', error.message);
  }

  if (!data) {
    throw new AppError(404, 'BOARD_NOT_FOUND', 'Board not found');
  }

  return data;
};

const getBoardByShareSlug = async (shareSlug) => {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('share_slug', shareSlug)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'SHARE_LOOKUP_FAILED', error.message);
  }

  if (!data) {
    throw new AppError(404, 'SHARE_NOT_FOUND', 'Share link not found');
  }

  return data;
};

const resolveBoardAccess = async ({ boardId, userId, shareSlug }) => {
  const board = await getBoardRecord(boardId);
  const membership = await getWorkspaceMembership(board.workspace_id, userId);

  if (membership) {
    return {
      board: mapBoard(board),
      accessMode: 'member',
      role: membership.role,
      canEdit: membership.role !== 'viewer',
    };
  }

  if (shareSlug && board.visibility === 'link' && board.share_slug === shareSlug) {
    return {
      board: mapBoard(board),
      accessMode: 'share',
      role: board.share_role,
      canEdit: board.share_role === 'editor',
    };
  }

  throw new AppError(403, 'BOARD_ACCESS_DENIED', 'You do not have access to this board');
};

const resolveShareAccess = async ({ shareSlug, userId }) => {
  const board = await getBoardByShareSlug(shareSlug);

  if (board.visibility !== 'link') {
    throw new AppError(403, 'SHARE_DISABLED', 'Share link is disabled for this board');
  }

  const membership = await getWorkspaceMembership(board.workspace_id, userId);

  return {
    board: mapBoard(board),
    accessMode: membership ? 'member' : 'share',
    role: membership ? membership.role : board.share_role,
    canEdit: membership ? membership.role !== 'viewer' : board.share_role === 'editor',
  };
};

module.exports = {
  getWorkspaceMembership,
  getBoardRecord,
  getBoardByShareSlug,
  resolveBoardAccess,
  resolveShareAccess,
};
