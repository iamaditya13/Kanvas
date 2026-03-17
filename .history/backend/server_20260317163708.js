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
