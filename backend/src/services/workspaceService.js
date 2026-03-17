const crypto = require('crypto');
const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { getWorkspaceMembership } = require('./accessService');
const { mapBoard } = require('./mappers');

const listWorkspacesForUser = async (userId) => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, created_at, updated_at)')
    .eq('user_id', userId)
    .order('created_at', { foreignTable: 'workspaces', ascending: false });

  if (error) {
    throw new AppError(500, 'WORKSPACE_LIST_FAILED', error.message);
  }

  return data.map((item) => ({
    id: item.workspaces.id,
    name: item.workspaces.name,
    createdAt: item.workspaces.created_at,
    updatedAt: item.workspaces.updated_at,
    role: item.role,
  }));
};

const createWorkspace = async (userId, name) => {
  const now = new Date().toISOString();
  const workspaceId = crypto.randomUUID();

  const { error: workspaceError } = await supabase.from('workspaces').insert([
    {
      id: workspaceId,
      name,
      owner_id: userId,
      created_at: now,
      updated_at: now,
    },
  ]);

  if (workspaceError) {
    throw new AppError(500, 'WORKSPACE_CREATE_FAILED', workspaceError.message);
  }

  const { error: memberError } = await supabase.from('workspace_members').insert([
    {
      workspace_id: workspaceId,
      user_id: userId,
      role: 'admin',
      created_at: now,
      updated_at: now,
    },
  ]);

  if (memberError) {
    await supabase.from('workspaces').delete().eq('id', workspaceId);
    throw new AppError(500, 'WORKSPACE_MEMBER_CREATE_FAILED', memberError.message);
  }

  return {
    id: workspaceId,
    name,
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  };
};

const listBoardsForWorkspace = async (workspaceId, userId) => {
  const membership = await getWorkspaceMembership(workspaceId, userId);

  if (!membership) {
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'You do not have access to this workspace');
  }

  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'BOARD_LIST_FAILED', error.message);
  }

  return data.map(mapBoard);
};

const createBoard = async (workspaceId, userId, name) => {
  const membership = await getWorkspaceMembership(workspaceId, userId);

  if (!membership || membership.role === 'viewer') {
    throw new AppError(403, 'BOARD_CREATE_FORBIDDEN', 'You do not have permission to create boards in this workspace');
  }

  const now = new Date().toISOString();
  const board = {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    owner_id: userId,
    name,
    visibility: 'private',
    share_role: 'editor',
    share_slug: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('boards').insert([board]).select().single();

  if (error) {
    throw new AppError(500, 'BOARD_CREATE_FAILED', error.message);
  }

  return mapBoard(data);
};

module.exports = {
  listWorkspacesForUser,
  createWorkspace,
  listBoardsForWorkspace,
  createBoard,
};
