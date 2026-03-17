const { supabase } = require('../lib/supabase');

const logActivity = async ({ boardId, elementId = null, userId, action, details = {} }) => {
  const { error } = await supabase.from('activity_logs').insert([
    {
      board_id: boardId,
      element_id: elementId,
      user_id: userId,
      action,
      details,
    },
  ]);

  if (error) {
    console.error('Failed to write activity log', error);
  }
};

module.exports = {
  logActivity,
};
