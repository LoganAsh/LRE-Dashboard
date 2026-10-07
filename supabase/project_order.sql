-- LRE Dashboard: manual order for projects
-- Already applied to project vdbrbtuidsfftgotmlol. Kept here as a record; safe to run again.

-- Manual order of projects (1 = first). Starts out as the order you see today: newest first.
alter table public.lre_projects add column if not exists sort_order integer;

update public.lre_projects p
   set sort_order = r.n
  from (select id, row_number() over (order by created_at desc nulls last, id desc) as n from public.lre_projects) r
 where p.id = r.id and p.sort_order is null;

-- A new project goes to the top of the list.
create or replace function public.lre_projects_default_sort() returns trigger language plpgsql as $$
begin
  if new.sort_order is null then
    select coalesce(min(sort_order), 1) - 1 into new.sort_order from public.lre_projects;
  end if;
  return new;
end $$;
drop trigger if exists lre_projects_default_sort on public.lre_projects;
create trigger lre_projects_default_sort before insert on public.lre_projects
  for each row execute function public.lre_projects_default_sort();

-- Saves a whole new order in one step: the position in the list becomes the project's sort_order.
create or replace function public.lre_reorder_projects(ids bigint[]) returns void language sql as $$
  update public.lre_projects p
     set sort_order = t.ord::int
    from unnest(ids) with ordinality as t(id, ord)
   where p.id = t.id;
$$;

notify pgrst, 'reload schema';
