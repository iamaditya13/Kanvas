# Kanvas

Kanvas is a secure real-time collaboration platform built with Next.js, Express, Socket.IO, and Supabase. The application now ships with server-authoritative element mutations, authenticated share links, DB-backed presence, and a production-ready canvas toolset.

## Core features

- Real-time multi-user collaboration with acknowledged Socket.IO mutations
- Server-authoritative create, move, update, and delete operations for canvas elements
- Working select, draw, text, comment, zoom, and share workflows
- Authenticated share links with private or link-based board access
- DB-backed presence with unique server-assigned cursor colors
- Modular backend routes, controllers, middleware, and services
- Input validation with Zod and clean ESLint output

## Architecture

### Frontend

- `frontend/app/board/[id]/page.tsx`: authenticated board route
- `frontend/app/share/[slug]/page.tsx`: authenticated share-link entry route
- `frontend/features/board/BoardScreen.tsx`: canvas UI, toolbar, share modal, comments, presence
- `frontend/features/board/useBoardCollaboration.ts`: socket acknowledgements, optimistic rollback, live sync
- `frontend/features/board/store/useBoardStore.ts`: Zustand state for elements, comments, presence, cursors, and viewport

### Backend

- `backend/src/routes/`: Express route modules
- `backend/src/controllers/`: request handlers
- `backend/src/services/`: Supabase-backed business logic for boards, elements, comments, presence, and access
- `backend/src/middleware/`: `requireAuth`, `requireBoardAccess`, and central error handling
- `backend/src/socket/collaborationServer.js`: authenticated room joins, presence heartbeats, cursor broadcasts, and mutation acks

## Data model

The canonical schema is defined in `supabase/migrations/202603170001_realtime_collaboration.sql` and includes:

- `users`
- `workspaces`
- `workspace_members`
- `boards`
- `elements`
- `comments`
- `activity_logs`
- `board_presence`

## Environment variables

### Backend (`backend/.env`)

```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001
```

## Local development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm test
npm start
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run lint
npm run build
npm run dev
```

## Realtime contract

### Socket client -> server

- `board:join`
- `board:leave`
- `presence:heartbeat`
- `cursor:move`
- `element:create`
- `element:move`
- `element:update`
- `element:delete`
- `comment:create`

### Socket server -> clients

- `presence:update`
- `cursor:moved`
- `cursor:left`
- `element:created`
- `element:moved`
- `element:updated`
- `element:deleted`
- `comment:created`
- `socket:error`

All mutating client events are acknowledged. The server writes to Supabase first, returns the authoritative record to the sender, and broadcasts the same normalized payload to other room members.
