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

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
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
