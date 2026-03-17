const crypto = require('crypto');
const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { mapElement } = require('./mappers');
const { logActivity } = require('./activityService');

const getElementRow = async (boardId, elementId) => {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('board_id', boardId)
    .eq('id', elementId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'ELEMENT_LOOKUP_FAILED', error.message);
  }

  if (!data) {
    throw new AppError(404, 'ELEMENT_NOT_FOUND', 'Element not found');
  }

  return data;
};

const createElement = async (boardId, userId, elementInput) => {
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    board_id: boardId,
    type: elementInput.type,
    x: elementInput.x,
    y: elementInput.y,
    width: elementInput.width,
    height: elementInput.height,
    content: elementInput.content,
    color: elementInput.color,
    payload: elementInput.payload,
    version: 1,
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('elements').insert([record]).select('*').single();

  if (error) {
    throw new AppError(500, 'ELEMENT_CREATE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    elementId: data.id,
    userId,
    action: 'element.created',
    details: { type: data.type },
  });

  return mapElement(data);
};

const moveElement = async (boardId, elementId, userId, position) => {
  const current = await getElementRow(boardId, elementId);
  const updates = {
    x: position.x,
    y: position.y,
    version: current.version + 1,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('elements')
    .update(updates)
    .eq('board_id', boardId)
    .eq('id', elementId)
    .select('*')
    .single();

  if (error) {
    throw new AppError(500, 'ELEMENT_MOVE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    elementId,
    userId,
    action: 'element.moved',
    details: { x: position.x, y: position.y },
  });

  return mapElement(data);
};

const updateElement = async (boardId, elementId, userId, patch) => {
  const current = await getElementRow(boardId, elementId);
  const updates = {
    x: patch.x ?? current.x,
    y: patch.y ?? current.y,
    width: patch.width ?? current.width,
    height: patch.height ?? current.height,
    content: patch.content ?? current.content,
    color: patch.color ?? current.color,
    payload: patch.payload ? { ...current.payload, ...patch.payload } : current.payload,
    version: current.version + 1,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('elements')
    .update(updates)
    .eq('board_id', boardId)
    .eq('id', elementId)
    .select('*')
    .single();

  if (error) {
    throw new AppError(500, 'ELEMENT_UPDATE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    elementId,
    userId,
    action: 'element.updated',
    details: Object.keys(patch),
  });

  return mapElement(data);
};

const deleteElement = async (boardId, elementId, userId) => {
  const current = await getElementRow(boardId, elementId);

  const { error } = await supabase
    .from('elements')
    .delete()
    .eq('board_id', boardId)
    .eq('id', elementId);

  if (error) {
    throw new AppError(500, 'ELEMENT_DELETE_FAILED', error.message);
  }

  await logActivity({
    boardId,
    elementId,
    userId,
    action: 'element.deleted',
    details: { type: current.type },
  });

  return {
    id: elementId,
    boardId,
  };
};

module.exports = {
  createElement,
  moveElement,
  updateElement,
  deleteElement,
};
