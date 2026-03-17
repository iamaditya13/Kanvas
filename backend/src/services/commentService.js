const crypto = require('crypto');
const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { mapComment } = require('./mappers');
const { logActivity } = require('./activityService');

const ensureElementExists = async (boardId, elementId) => {
  const { data, error } = await supabase
    .from('elements')
    .select('id')
    .eq('board_id', boardId)
    .eq('id', elementId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'COMMENT_ELEMENT_LOOKUP_FAILED', error.message);
  }

  if (!data) {
    throw new AppError(404, 'COMMENT_ELEMENT_NOT_FOUND', 'Cannot attach a comment to a missing element');
  }
};

const createComment = async ({ boardId, elementId, content, user }) => {
  await ensureElementExists(boardId, elementId);

  const record = {
    id: crypto.randomUUID(),
    board_id: boardId,
    element_id: elementId,
    content,
    created_by: user.id,
    author_name: user.displayName,
    author_email: user.email,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('comments').insert([record]).select('*').single();

  if (error) {
    throw new AppError(500, 'COMMENT_CREATE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    elementId,
    userId: user.id,
    action: 'comment.created',
    details: { preview: content.slice(0, 120) },
  });

  return mapComment(data);
};

module.exports = {
  createComment,
};
