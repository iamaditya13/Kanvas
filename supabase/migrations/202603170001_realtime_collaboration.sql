create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  visibility text not null default 'private' check (visibility in ('private', 'link')),
  share_role text not null default 'editor' check (share_role in ('viewer', 'editor')),
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.elements (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  type text not null check (type in ('sticky', 'text', 'path')),
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  content text not null default '',
  color text not null,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid not null references public.users (id) on delete cascade,
  updated_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  element_id uuid not null references public.elements (id) on delete cascade,
  created_by uuid not null references public.users (id) on delete cascade,
  author_name text not null,
  author_email text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  element_id uuid references public.elements (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.board_presence (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  socket_id text not null,
  email text not null,
  display_name text not null,
  color text not null,
  last_seen timestamptz not null default now(),
  primary key (board_id, socket_id)
);

-- Reconcile legacy schemas where tables already exist with older column sets.
alter table if exists public.users add column if not exists email text;
alter table if exists public.users add column if not exists display_name text;
alter table if exists public.users add column if not exists avatar_url text;
alter table if exists public.users add column if not exists created_at timestamptz not null default now();
alter table if exists public.users add column if not exists updated_at timestamptz not null default now();

alter table if exists public.workspaces add column if not exists owner_id uuid;
alter table if exists public.workspaces add column if not exists name text;
alter table if exists public.workspaces add column if not exists created_at timestamptz not null default now();
alter table if exists public.workspaces add column if not exists updated_at timestamptz not null default now();

alter table if exists public.workspace_members add column if not exists workspace_id uuid;
alter table if exists public.workspace_members add column if not exists user_id uuid;
alter table if exists public.workspace_members add column if not exists role text;
alter table if exists public.workspace_members add column if not exists created_at timestamptz not null default now();
alter table if exists public.workspace_members add column if not exists updated_at timestamptz not null default now();

alter table if exists public.boards add column if not exists workspace_id uuid;
alter table if exists public.boards add column if not exists owner_id uuid;
alter table if exists public.boards add column if not exists name text;
alter table if exists public.boards add column if not exists visibility text not null default 'private';
alter table if exists public.boards add column if not exists share_role text not null default 'editor';
alter table if exists public.boards add column if not exists share_slug text;
alter table if exists public.boards add column if not exists created_at timestamptz not null default now();
alter table if exists public.boards add column if not exists updated_at timestamptz not null default now();

alter table if exists public.elements add column if not exists board_id uuid;
alter table if exists public.elements add column if not exists type text;
alter table if exists public.elements add column if not exists x double precision;
alter table if exists public.elements add column if not exists y double precision;
alter table if exists public.elements add column if not exists width double precision;
alter table if exists public.elements add column if not exists height double precision;
alter table if exists public.elements add column if not exists content text not null default '';
alter table if exists public.elements add column if not exists color text;
alter table if exists public.elements add column if not exists payload jsonb not null default '{}'::jsonb;
alter table if exists public.elements add column if not exists version integer not null default 1;
alter table if exists public.elements add column if not exists created_by uuid;
alter table if exists public.elements add column if not exists updated_by uuid;
alter table if exists public.elements add column if not exists created_at timestamptz not null default now();
alter table if exists public.elements add column if not exists updated_at timestamptz not null default now();

alter table if exists public.comments add column if not exists board_id uuid;
alter table if exists public.comments add column if not exists element_id uuid;
alter table if exists public.comments add column if not exists created_by uuid;
alter table if exists public.comments add column if not exists author_name text;
alter table if exists public.comments add column if not exists author_email text;
alter table if exists public.comments add column if not exists content text;
alter table if exists public.comments add column if not exists created_at timestamptz not null default now();

alter table if exists public.activity_logs add column if not exists board_id uuid;
alter table if exists public.activity_logs add column if not exists element_id uuid;
alter table if exists public.activity_logs add column if not exists user_id uuid;
alter table if exists public.activity_logs add column if not exists action text;
alter table if exists public.activity_logs add column if not exists details jsonb not null default '{}'::jsonb;
alter table if exists public.activity_logs add column if not exists created_at timestamptz not null default now();

alter table if exists public.board_presence add column if not exists board_id uuid;
alter table if exists public.board_presence add column if not exists user_id uuid;
alter table if exists public.board_presence add column if not exists socket_id text;
alter table if exists public.board_presence add column if not exists email text;
alter table if exists public.board_presence add column if not exists display_name text;
alter table if exists public.board_presence add column if not exists color text;
alter table if exists public.board_presence add column if not exists last_seen timestamptz not null default now();

create index if not exists idx_workspace_members_user on public.workspace_members (user_id);
create index if not exists idx_boards_workspace on public.boards (workspace_id, created_at desc);
create index if not exists idx_boards_share_slug on public.boards (share_slug);
create index if not exists idx_elements_board on public.elements (board_id, updated_at desc);
create index if not exists idx_comments_board_element on public.comments (board_id, element_id, created_at asc);
create index if not exists idx_activity_logs_board on public.activity_logs (board_id, created_at desc);
create index if not exists idx_board_presence_board on public.board_presence (board_id, last_seen desc);
