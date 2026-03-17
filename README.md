# Kanvas — Real-Time Collaborative Task Manager

> A production-ready, Trello-style Kanban board with real-time collaboration, built with Next.js, Node.js, Socket.io, and Supabase.

---

## ✨ Features

- **Multi-user Workspaces** — Create and switch between workspaces; each user can be an admin, member, or viewer.
- **Kanban Boards** — Create boards, lists, and tasks with full drag-and-drop reordering.
- **Real-Time Sync** — All changes (moves, new tasks, comments) broadcast instantly via Socket.io — no refresh needed.
- **Live Presence** — See who's currently viewing the same board.
- **Typing Indicators** — "User is typing…" appears in real-time inside task comment threads.
- **Comments** — Per-task comment threads with real-time updates.
- **Activity Logs** — Automatic audit trail for task changes (edits, comments).
- **Authentication** — Supabase Auth with email/password sign-up and JWT-protected API routes.
- **Premium Dark UI** — Designed with Stitch AI, custom Tailwind design tokens — no generic templates.

---

## 🛠 Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 15 (App Router), TypeScript |
| Styling    | Tailwind CSS + Stitch Design System |
| State      | Zustand                             |
| Drag & Drop| @hello-pangea/dnd                   |
| Backend    | Node.js, Express                    |
| Real-Time  | Socket.io                           |
| Database   | Supabase (PostgreSQL)               |
| Auth       | Supabase Auth (JWT + SSR Cookies)   |

---

## 📁 Folder Structure

```
kanvas/
├── frontend/               # Next.js App
│   ├── app/
│   │   ├── page.tsx        # Dashboard (workspaces + boards)
│   │   ├── login/          # Auth page
│   │   └── board/[id]/     # Kanban board view
│   ├── components/
│   │   └── TaskModal.tsx   # Task detail with comments + activity
│   ├── store/
│   │   └── boardStore.ts   # Zustand state for lists/tasks
│   ├── lib/
│   │   └── socket.ts       # Socket.io client singleton
│   └── utils/
│       ├── api.ts          # Auth-aware fetch wrapper
│       └── supabase/       # Client, server, middleware helpers
│
└── backend/                # Express + Socket.io server
    └── server.js
```

---

## 🗄 Database Schema

```
workspaces        — id, name, created_at
workspace_members — workspace_id, user_id, role (admin/member/viewer)
boards            — id, workspace_id, name, created_at
lists             — id, board_id, name, position
tasks             — id, list_id, title, description, position, assigned_to
comments          — id, task_id, user_id, content, created_at
activity_logs     — id, task_id, user_id, action, details (JSONB), created_at
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- A Supabase project (or use the existing one)

### 1. Clone the repo
```bash
git clone https://github.com/iamaditya13/Kanvas.git
cd Kanvas
```

### 2. Backend
```bash
cd backend
cp .env.example .env     # fill in your Supabase credentials
npm install
node server.js           # or: npx nodemon server.js
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local  # fill in your Supabase + API URL
npm install
npm run dev
```

Visit **http://localhost:3000**

---

## 🔐 Environment Variables

### `backend/.env`
```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
FRONTEND_URL=http://localhost:3000
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001
```

---

## 🔧 Architecture Overview

```
Browser (Next.js)
    │
    ├─ REST calls ──▶ Express (port 3001) ──▶ Supabase PostgreSQL
    │
    └─ WebSocket ───▶ Socket.io Server
                          │ broadcasts to board rooms
                          └▶ Other connected browsers (real-time sync)
```

- **Authentication**: Supabase JWT tokens. The Next.js middleware validates the session cookie on every protected route server-side. The Express backend validates the Bearer token on every API call.
- **Real-Time**: Board viewers join a Socket.io room (`board:<id>`). Events (`task:move`, `comment:broadcast`, `typing:start`) are relayed to all room members by the server.
- **Optimistic UI**: Drag-and-drop updates Zustand state immediately, then emits the socket event — zero perceived latency.

---

## 📄 License

MIT
