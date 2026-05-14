-- Employee assignment, roles, profile settings, and Telegram notification support.
-- Run after 001_migration.sql.

create schema if not exists app_private;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
  );
$$;

revoke all on function app_private.is_manager() from public;
grant execute on function app_private.is_manager() to authenticated, service_role;

alter table public.profiles
  add column if not exists login_email text,
  add column if not exists phone text,
  add column if not exists telegram_username text,
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_verified_at timestamptz,
  add column if not exists language text not null default 'uz',
  add column if not exists performance_mode text not null default 'balanced';

update public.profiles
set role = case
  when lower(coalesce(role, '')) in ('manager', 'product manager', 'admin', 'rahbar') then 'manager'
  else 'employee'
end
where role is null
   or role not in ('employee', 'manager');

update public.profiles
set login_email = coalesce(login_email, auth_users.email)
from auth.users auth_users
where profiles.id = auth_users.id
  and public.profiles.login_email is null;

alter table public.profiles
  alter column role set default 'employee',
  alter column language set default 'uz',
  alter column performance_mode set default 'balanced';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('employee', 'manager'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_language_check check (language in ('uz', 'ru', 'uz_cyrl'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_performance_mode_check check (performance_mode in ('balanced', 'compact'));
exception
  when duplicate_object then null;
end $$;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_telegram_username_idx on public.profiles(telegram_username);

alter table public.tasks
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null;

update public.tasks
set assignee_id = owner_id
where assignee_id is null;

create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists tasks_assignee_due_date_idx on public.tasks(assignee_id, due_date);

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    role,
    avatar_url,
    login_email,
    phone,
    telegram_username
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'employee',
    null,
    new.email,
    new.raw_user_meta_data->>'phone',
    nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data->>'telegram_username', ''), '^@+', '')), '')
  )
  on conflict (id) do update set
    login_email = coalesce(public.profiles.login_email, excluded.login_email),
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

drop function if exists public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.role is distinct from new.role and not app_private.is_manager() then
    raise exception 'Only managers can change profile roles';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.protect_task_worker_updates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' or app_private.is_manager() then
    return new;
  end if;

  if old.assignee_id = auth.uid() then
    if new.owner_id is distinct from old.owner_id
      or new.assignee_id is distinct from old.assignee_id
      or new.project_id is distinct from old.project_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.due_date is distinct from old.due_date then
      raise exception 'Employees can only update task status';
    end if;

    return new;
  end if;

  raise exception 'Task update is not allowed';
end;
$$;

drop trigger if exists tasks_protect_worker_updates on public.tasks;
create trigger tasks_protect_worker_updates
before update on public.tasks
for each row execute function public.protect_task_worker_updates();

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
drop policy if exists "profiles_insert_own_or_manager" on public.profiles;
drop policy if exists "profiles_update_own_or_manager" on public.profiles;

create policy "profiles_select_visible"
on public.profiles for select
to authenticated
using (id = auth.uid() or app_private.is_manager());

create policy "profiles_insert_own_or_manager"
on public.profiles for insert
to authenticated
with check (id = auth.uid() or app_private.is_manager());

create policy "profiles_update_own_or_manager"
on public.profiles for update
to authenticated
using (id = auth.uid() or app_private.is_manager())
with check (id = auth.uid() or app_private.is_manager());

-- Projects policies
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;
drop policy if exists "projects_select_visible" on public.projects;
drop policy if exists "projects_insert_manager" on public.projects;
drop policy if exists "projects_update_manager_or_owner" on public.projects;
drop policy if exists "projects_delete_manager_or_owner" on public.projects;

create policy "projects_select_visible"
on public.projects for select
to authenticated
using (owner_id = auth.uid() or app_private.is_manager());

create policy "projects_insert_manager"
on public.projects for insert
to authenticated
with check (owner_id = auth.uid() and app_private.is_manager());

create policy "projects_update_manager_or_owner"
on public.projects for update
to authenticated
using (owner_id = auth.uid() or app_private.is_manager())
with check (owner_id = auth.uid() or app_private.is_manager());

create policy "projects_delete_manager_or_owner"
on public.projects for delete
to authenticated
using (owner_id = auth.uid() or app_private.is_manager());

-- Tasks policies
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "tasks_select_visible" on public.tasks;
drop policy if exists "tasks_insert_manager" on public.tasks;
drop policy if exists "tasks_update_manager_or_assignee" on public.tasks;
drop policy if exists "tasks_delete_manager_or_owner" on public.tasks;

create policy "tasks_select_visible"
on public.tasks for select
to authenticated
using (
  app_private.is_manager()
  or owner_id = auth.uid()
  or assignee_id = auth.uid()
);

create policy "tasks_insert_manager"
on public.tasks for insert
to authenticated
with check (
  app_private.is_manager()
  and owner_id = auth.uid()
  and (
    project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or app_private.is_manager())
    )
  )
  and (
    assignee_id is null
    or exists (select 1 from public.profiles p where p.id = assignee_id)
  )
);

create policy "tasks_update_manager_or_assignee"
on public.tasks for update
to authenticated
using (
  app_private.is_manager()
  or owner_id = auth.uid()
  or assignee_id = auth.uid()
)
with check (
  app_private.is_manager()
  or owner_id = auth.uid()
  or assignee_id = auth.uid()
);

create policy "tasks_delete_manager_or_owner"
on public.tasks for delete
to authenticated
using (app_private.is_manager() or owner_id = auth.uid());

-- Checklist policies
drop policy if exists "checklist_select_own_task" on public.task_checklist_items;
drop policy if exists "checklist_insert_own_task" on public.task_checklist_items;
drop policy if exists "checklist_update_own_task" on public.task_checklist_items;
drop policy if exists "checklist_delete_own_task" on public.task_checklist_items;
drop policy if exists "checklist_select_visible_task" on public.task_checklist_items;
drop policy if exists "checklist_insert_manager_task" on public.task_checklist_items;
drop policy if exists "checklist_update_visible_task" on public.task_checklist_items;
drop policy if exists "checklist_delete_manager_task" on public.task_checklist_items;

create policy "checklist_select_visible_task"
on public.task_checklist_items for select
to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (app_private.is_manager() or t.owner_id = auth.uid() or t.assignee_id = auth.uid())
  )
);

create policy "checklist_insert_manager_task"
on public.task_checklist_items for insert
to authenticated
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (app_private.is_manager() or t.owner_id = auth.uid())
  )
);

create policy "checklist_update_visible_task"
on public.task_checklist_items for update
to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (app_private.is_manager() or t.owner_id = auth.uid() or t.assignee_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (app_private.is_manager() or t.owner_id = auth.uid() or t.assignee_id = auth.uid())
  )
);

create policy "checklist_delete_manager_task"
on public.task_checklist_items for delete
to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (app_private.is_manager() or t.owner_id = auth.uid())
  )
);

-- Activity policies
drop policy if exists "activity_select_own" on public.task_activity;
drop policy if exists "activity_insert_own" on public.task_activity;
drop policy if exists "activity_select_visible" on public.task_activity;
drop policy if exists "activity_insert_own_user" on public.task_activity;

create policy "activity_select_visible"
on public.task_activity for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.is_manager()
  or exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (t.owner_id = auth.uid() or t.assignee_id = auth.uid())
  )
);

create policy "activity_insert_own_user"
on public.task_activity for insert
to authenticated
with check (user_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_checklist_items to authenticated;
grant select, insert on public.task_activity to authenticated;
