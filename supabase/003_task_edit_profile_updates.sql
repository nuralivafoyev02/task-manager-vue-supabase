-- Task editing/canceling and self-task support.
-- Run after supabase/002_employee_roles_notifications.sql.

alter type public.task_status add value if not exists 'canceled';

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

  if old.owner_id = auth.uid() then
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

drop policy if exists "tasks_insert_manager" on public.tasks;
drop policy if exists "tasks_insert_manager_or_self" on public.tasks;

create policy "tasks_insert_manager_or_self"
on public.tasks for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (
    app_private.is_manager()
    or assignee_id = auth.uid()
  )
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
