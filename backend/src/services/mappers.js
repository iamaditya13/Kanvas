const mapBoard = (row) => ({
  id: row.id,
  workspaceId: row.workspace_id,
  ownerId: row.owner_id,
  name: row.name,
  visibility: row.visibility,
  shareRole: row.share_role,
  shareSlug: row.share_slug,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapElement = (row) => ({
  id: row.id,
  boardId: row.board_id,
  type: row.type,
  x: row.x,
  y: row.y,
  width: row.width,
  height: row.height,
  content: row.content,
  color: row.color,
  payload: row.payload || {},
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
});

const mapComment = (row) => ({
  id: row.id,
  boardId: row.board_id,
  elementId: row.element_id,
  content: row.content,
  createdAt: row.created_at,
  createdBy: row.created_by,
  authorName: row.author_name,
  authorEmail: row.author_email,
});

const mapPresence = (row) => ({
  boardId: row.board_id,
  userId: row.user_id,
  email: row.email,
  displayName: row.display_name,
  color: row.color,
  lastSeen: row.last_seen,
});

module.exports = {
  mapBoard,
  mapElement,
  mapComment,
  mapPresence,
};
