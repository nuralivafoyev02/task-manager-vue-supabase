-- Task Manager WebApp — Supabase initial migration
-- Run this file once in Supabase SQL Editor or through Supabase CLI.

create extension if not exists "pgcrypto";

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'completed', 'overdue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'User',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 4) Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  description text,
  color text not null default 'blue',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects(owner_id);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- 5) Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(trim(title)) >= 2),
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_owner_id_idx on public.tasks(owner_id);
create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_status_idx on public.tasks(status);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- 6) Checklist items
create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  is_done boolean not null default false,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists task_checklist_items_task_id_idx on public.task_checklist_items(task_id);

-- 7) Activity feed
create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists task_activity_user_id_idx on public.task_activity(user_id);
create index if not exists task_activity_task_id_idx on public.task_activity(task_id);

-- 8) Create profile automatically after user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'Product Manager',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 9) RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_activity enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Projects policies
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects for delete
to authenticated
using (owner_id = auth.uid());

-- Tasks policies
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (
    project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and (
    project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete
to authenticated
using (owner_id = auth.uid());

-- Checklist policies
drop policy if exists "checklist_select_own_task" on public.task_checklist_items;
create policy "checklist_select_own_task"
on public.task_checklist_items for select
to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = auth.uid()
  )
);

drop policy if exists "checklist_insert_own_task" on public.task_checklist_items;
create policy "checklist_insert_own_task"
on public.task_checklist_items for insert
to authenticated
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = auth.uid()
  )
);

drop policy if exists "checklist_update_own_task" on public.task_checklist_items;
create policy "checklist_update_own_task"
on public.task_checklist_items for update
to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = auth.uid()
  )
);

drop policy if exists "checklist_delete_own_task" on public.task_checklist_items;
create policy "checklist_delete_own_task"
on public.task_checklist_items for delete
to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = auth.uid()
  )
);

-- Activity policies
drop policy if exists "activity_select_own" on public.task_activity;
create policy "activity_select_own"
on public.task_activity for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "activity_insert_own" on public.task_activity;
create policy "activity_insert_own"
on public.task_activity for insert
to authenticated
with check (user_id = auth.uid());
