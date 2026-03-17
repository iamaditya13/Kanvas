const crypto = require('crypto');
const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { mapBoard, mapElement, mapComment } = require('./mappers');
const { logActivity } = require('./activityService');
const { getBoardByShareSlug } = require('./accessService');

const getBoardSession = async (boardId) => {
  const [{ data: board, error: boardError }, { data: elements, error: elementsError }, { data: comments, error: commentsError }] =
    await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).single(),
      supabase.from('elements').select('*').eq('board_id', boardId).order('created_at', { ascending: true }),
      supabase.from('comments').select('*').eq('board_id', boardId).order('created_at', { ascending: true }),
    ]);

  if (boardError) {
    throw new AppError(500, 'BOARD_SESSION_LOOKUP_FAILED', boardError.message);
  }

  if (elementsError) {
    throw new AppError(500, 'ELEMENT_LIST_FAILED', elementsError.message);
  }

  if (commentsError) {
    throw new AppError(500, 'COMMENT_LIST_FAILED', commentsError.message);
  }

  return {
    board: mapBoard(board),
    elements: elements.map(mapElement),
    comments: comments.map(mapComment),
  };
};

const updateBoard = async (boardId, userId, name) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('boards')
    .update({ name, updated_at: now })
    .eq('id', boardId)
    .select('*')
    .single();

  if (error) {
    throw new AppError(500, 'BOARD_UPDATE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    userId,
    action: 'board.updated',
    details: { name },
  });

  return mapBoard(data);
};

const updateShareSettings = async (boardId, userId, settings) => {
  const updates = {
    visibility: settings.visibility,
    share_role: settings.shareRole,
    updated_at: new Date().toISOString(),
  };

  if (settings.visibility === 'link' && (settings.regenerate || !updates.share_slug)) {
    updates.share_slug = crypto.randomUUID().replace(/-/g, '');
  }

  if (settings.visibility === 'private') {
    updates.share_slug = settings.regenerate ? crypto.randomUUID().replace(/-/g, '') : null;
  }

  const current = await supabase.from('boards').select('share_slug').eq('id', boardId).single();
  if (current.error) {
    throw new AppError(500, 'BOARD_SHARE_LOOKUP_FAILED', current.error.message);
  }

  if (settings.visibility === 'link' && !current.data.share_slug) {
    updates.share_slug = crypto.randomUUID().replace(/-/g, '');
  } else if (settings.visibility === 'link' && !settings.regenerate) {
    updates.share_slug = current.data.share_slug;
  }

  const { data, error } = await supabase
    .from('boards')
    .update(updates)
    .eq('id', boardId)
    .select('*')
    .single();

  if (error) {
    throw new AppError(500, 'BOARD_SHARE_UPDATE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    userId,
    action: 'board.share_updated',
    details: {
      visibility: settings.visibility,
      shareRole: settings.shareRole,
      regenerate: settings.regenerate,
    },
  });

  return mapBoard(data);
};

const resolveShare = async (shareSlug) => {
  const board = await getBoardByShareSlug(shareSlug);

  if (board.visibility !== 'link') {
    throw new AppError(403, 'SHARE_DISABLED', 'Share link is disabled for this board');
  }

  return mapBoard(board);
};

module.exports = {
  getBoardSession,
  updateBoard,
  updateShareSettings,
  resolveShare,
};
