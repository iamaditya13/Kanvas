const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS configuration for Express and Socket.io
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize Supabase admin client (using anon key for now, ideally service role for backend logic not tied to a specific user)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Auth Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.user = user;
  next();
};

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// REST APIs

// Get Workspaces for User
app.get('/api/workspaces', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, created_at)')
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(wm => ({ ...wm.workspaces, role: wm.role })));
});

// Create Workspace
app.post('/api/workspaces', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Start Transaction equivalent by doing sequentially (Supabase JS doesn't have true transactions yet without RPC, but this works for basic setup)
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert([{ name }])
    .select()
    .single();

  if (wsError) return res.status(500).json({ error: wsError.message });

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert([{ workspace_id: workspace.id, user_id: req.user.id, role: 'admin' }]);

  if (memberError) {
    // Basic rollback attempt
    await supabase.from('workspaces').delete().eq('id', workspace.id);
    return res.status(500).json({ error: memberError.message });
  }

  res.status(201).json(workspace);
});

// Get Boards for Workspace
app.get('/api/workspaces/:workspaceId/boards', authenticateToken, async (req, res) => {
  const { workspaceId } = req.params;
  
  // Verify access
  const { data: access, error: accessError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.user.id)
    .single();

  if (accessError || !access) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create Board
app.post('/api/workspaces/:workspaceId/boards', authenticateToken, async (req, res) => {
  const { workspaceId } = req.params;
  const { name } = req.body;
  
  const { data: access, error: accessError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.user.id)
    .single();

  if (accessError || !access) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('boards')
    .insert([{ workspace_id: workspaceId, name }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Get Lists for a Board
app.get('/api/boards/:boardId/lists', authenticateToken, async (req, res) => {
  const { boardId } = req.params;
  
  // Verify access through board -> workspace -> workspace_member
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('workspace_id')
    .eq('id', boardId)
    .single();

  if (boardError || !board) return res.status(404).json({ error: 'Board not found' });

  const { data: access, error: accessError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', board.workspace_id)
    .eq('user_id', req.user.id)
    .single();

  if (accessError || !access) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('lists')
    .select('*, tasks(*)')
    .eq('board_id', boardId)
    .order('position', { ascending: true });
    
  // Sort tasks within lists
  if (data) {
    data.forEach(list => {
      list.tasks.sort((a, b) => a.position - b.position);
    });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create List
app.post('/api/boards/:boardId/lists', authenticateToken, async (req, res) => {
  const { boardId } = req.params;
  const { name, position } = req.body;
  
  const { data, error } = await supabase
    .from('lists')
    .insert([{ board_id: boardId, name, position }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Create Task
app.post('/api/lists/:listId/tasks', authenticateToken, async (req, res) => {
  const { listId } = req.params;
  const { title, description, position } = req.body;
  
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ list_id: listId, title, description, position }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Get Comments for a Task
app.get('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { data, error } = await supabase
    .from('comments')
    .select('id, content, created_at, user_id')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create Comment
app.post('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const { data, error } = await supabase
    .from('comments')
    .insert([{ task_id: taskId, user_id: req.user.id, content }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log the activity
  await supabase.from('activity_logs').insert([{
    task_id: taskId,
    user_id: req.user.id,
    action: 'comment_added',
    details: { content_preview: content.substring(0, 80) }
  }]);

  res.status(201).json(data);
});

// Get Activity Log for a Task
app.get('/api/tasks/:taskId/activity', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, action, details, created_at, user_id')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get single task
app.get('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update task
app.put('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { title, description } = req.body;
  const { data, error } = await supabase
    .from('tasks')
    .update({ title, description, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Log activity
  await supabase.from('activity_logs').insert([{
    task_id: taskId,
    user_id: req.user.id,
    action: 'task_updated',
    details: { title }
  }]);

  res.json(data);
});

// Get Canvas Elements for a Board
app.get('/api/boards/:boardId/elements', authenticateToken, async (req, res) => {
  const { boardId } = req.params;
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create Canvas Element
app.post('/api/boards/:boardId/elements', authenticateToken, async (req, res) => {
  const { boardId } = req.params;
  const { id, type, x, y, width, height, content, color } = req.body;
  const { data, error } = await supabase
    .from('elements')
    .upsert([{ id, board_id: boardId, type, x, y, width, height, content, color, created_by: req.user.id }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update Canvas Element position/content
app.put('/api/boards/:boardId/elements/:elementId', authenticateToken, async (req, res) => {
  const { elementId } = req.params;
  const { x, y, content } = req.body;
  const updates = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (content !== undefined) updates.content = content;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('elements')
    .update(updates)
    .eq('id', elementId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Setup Socket.io
const io = new Server(server, {
  cors: corsOptions
});

// Store online users by board
const boardUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Example authentication middleware could be added here
  // socket.use((packet, next) => { ...verify jwt... next() })

  socket.on('join_board', ({ boardId, user }) => {
    socket.join(`board:${boardId}`);
    
    // Track presence
    if (!boardUsers.has(boardId)) {
      boardUsers.set(boardId, new Map());
    }
    boardUsers.get(boardId).set(socket.id, user);

    // Broadcast updated presence to the room
    const currentUsers = Array.from(boardUsers.get(boardId).values());
    io.to(`board:${boardId}`).emit('presence:update', currentUsers);
    
    console.log(`User ${user.email} joined board ${boardId}`);
  });

  socket.on('leave_board', ({ boardId }) => {
    socket.leave(`board:${boardId}`);
    if (boardUsers.has(boardId)) {
        boardUsers.get(boardId).delete(socket.id);
        const currentUsers = Array.from(boardUsers.get(boardId).values());
        io.to(`board:${boardId}`).emit('presence:update', currentUsers);
    }
  });

  // Task Movements
  socket.on('task:move', (data) => {
    // data: { boardId, taskId, sourceListId, destinationListId, newPosition, ...}
    // Broadcast to everyone else in the room
    socket.to(`board:${data.boardId}`).emit('task:moved', data);
  });
  
  // Task Updates (Title, Description, etc)
  socket.on('task:update', (data) => {
    socket.to(`board:${data.boardId}`).emit('task:updated', data);
  });

  // Real-time comment broadcast
  socket.on('comment:broadcast', ({ boardId, taskId, comment }) => {
    socket.to(`board:${boardId}`).emit('comment:new', { taskId, comment });
  });

  // Canvas element events
  socket.on('element:add', ({ boardId, element }) => {
    socket.to(`board:${boardId}`).emit('element:added', element);
  });
  socket.on('element:move', ({ boardId, id, x, y }) => {
    socket.to(`board:${boardId}`).emit('element:moved', { id, x, y });
  });
  socket.on('element:update', ({ boardId, id, content }) => {
    socket.to(`board:${boardId}`).emit('element:updated', { id, content });
  });

  // Cursor movement broadcast
  socket.on('cursor:move', ({ boardId, email, x, y, color }) => {
    socket.to(`board:${boardId}`).emit('cursor:move', { email, x, y, color });
  });

  // Typing Indication
  socket.on('typing:start', ({ boardId, user, taskId }) => {
    socket.to(`board:${boardId}`).emit('member:typing', { user, taskId });
  });

  socket.on('typing:stop', ({ boardId, user, taskId }) => {
    socket.to(`board:${boardId}`).emit('member:stopped_typing', { user, taskId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from all tracked boards
    for (const [boardId, usersMap] of boardUsers.entries()) {
      if (usersMap.has(socket.id)) {
        usersMap.delete(socket.id);
        const currentUsers = Array.from(usersMap.values());
        io.to(`board:${boardId}`).emit('presence:update', currentUsers);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Kanvas Backend running on port ${PORT}`);
});
