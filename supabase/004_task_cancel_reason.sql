-- Cancel reason support for task cancellations.
-- Run after supabase/003_task_edit_profile_updates.sql.

alter table public.tasks
  add column if not exists cancel_reason text;

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
