-- LRE Dashboard: project tasks and subtasks (project-management side)
-- Already applied to project vdbrbtuidsfftgotmlol. Kept here as a record; safe to run again.

create table if not exists public.lre_project_tasks (
  id           bigserial primary key,
  project_id   bigint not null references public.lre_projects(id) on delete cascade,
  parent_id    bigint references public.lre_project_tasks(id) on delete cascade,   -- set for subtasks
  title        text not null check (length(btrim(title)) > 0),
  status       text not null default 'To Do' check (status in ('To Do', 'In Progress', 'Done')),
  due_date     date,
  notes        text,
  sort_order   integer not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists lre_project_tasks_project_idx on public.lre_project_tasks (project_id, parent_id, sort_order);

-- Keeps the data tidy no matter what the app does:
--  * subtasks sit under a top-level task only (two levels)
--  * a subtask belongs to the same project as its parent
--  * completed_at is set when a task becomes Done and cleared when it is reopened
--  * updated_at is refreshed on every change
create or replace function public.lre_project_tasks_guard() returns trigger language plpgsql as $$
declare p record;
begin
  if new.parent_id is not null then
    select project_id, parent_id into p from public.lre_project_tasks where id = new.parent_id;
    if not found then raise exception 'Parent task not found'; end if;
    if p.parent_id is not null then raise exception 'Subtasks cannot have their own subtasks'; end if;
    if p.project_id <> new.project_id then raise exception 'A subtask must belong to the same project as its parent task'; end if;
  end if;
  new.updated_at := now();
  if new.status = 'Done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists lre_project_tasks_guard on public.lre_project_tasks;
create trigger lre_project_tasks_guard before insert or update on public.lre_project_tasks
  for each row execute function public.lre_project_tasks_guard();

alter table public.lre_project_tasks enable row level security;
drop policy if exists "anon all lre_project_tasks" on public.lre_project_tasks;
create policy "anon all lre_project_tasks" on public.lre_project_tasks for all to anon using (true) with check (true);
