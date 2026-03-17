const { supabase } = require('../lib/supabase');
const { AppError } = require('../lib/appError');
const { CURSOR_COLORS, PRESENCE_TTL_SECONDS } = require('../constants/collaboration');
const { mapPresence } = require('./mappers');

const activeThreshold = () => new Date(Date.now() - PRESENCE_TTL_SECONDS * 1000).toISOString();

const uniqueHslColor = (usedColors, seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }

  for (let offset = 0; offset < 360; offset += 1) {
    const candidate = `hsl(${(hash + offset) % 360} 75% 58%)`;
    if (!usedColors.has(candidate)) {
      return candidate;
    }
  }

  return `hsl(${hash} 75% 58%)`;
};

const listPresence = async (boardId) => {
  const { data, error } = await supabase
    .from('board_presence')
    .select('*')
    .eq('board_id', boardId)
    .gte('last_seen', activeThreshold())
    .order('last_seen', { ascending: false });

  if (error) {
    throw new AppError(500, 'PRESENCE_LIST_FAILED', error.message);
  }

  const deduped = new Map();
  for (const row of data) {
    if (!deduped.has(row.user_id)) {
      deduped.set(row.user_id, mapPresence(row));
    }
  }

  return Array.from(deduped.values());
};

const allocateColor = async (boardId, userId) => {
  const active = await listPresence(boardId);
  const current = active.find((item) => item.userId === userId);
  if (current) {
    return current.color;
  }

  const usedColors = new Set(active.map((item) => item.color));
  const paletteColor = CURSOR_COLORS.find((item) => !usedColors.has(item));
  return paletteColor || uniqueHslColor(usedColors, userId);
};

const touchPresence = async ({ boardId, user, socketId }) => {
  const color = await allocateColor(boardId, user.id);
  const row = {
    board_id: boardId,
    user_id: user.id,
    socket_id: socketId,
    email: user.email,
    display_name: user.displayName,
    color,
    last_seen: new Date().toISOString(),
  };

  const { error } = await supabase.from('board_presence').upsert([row], { onConflict: 'board_id,socket_id' });

  if (error) {
    throw new AppError(500, 'PRESENCE_TOUCH_FAILED', error.message);
  }

  return listPresence(boardId);
};

const removeSocketPresence = async ({ socketId, boardId = null }) => {
  let query = supabase.from('board_presence').delete().eq('socket_id', socketId);
  if (boardId) {
    query = query.eq('board_id', boardId);
  }

  const { error } = await query;

  if (error) {
    throw new AppError(500, 'PRESENCE_REMOVE_FAILED', error.message);
  }
};

module.exports = {
  listPresence,
  touchPresence,
  removeSocketPresence,
};
