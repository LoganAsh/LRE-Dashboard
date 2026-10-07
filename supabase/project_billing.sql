-- LRE Dashboard: monthly billing date per project
-- Already applied to project vdbrbtuidsfftgotmlol. Kept here as a record; safe to run again.

-- Day of the month a project is billed (1 to 30). 31 means "last day of the month";
-- months with fewer days use their last day.
alter table public.lre_projects add column if not exists billing_day smallint;
alter table public.lre_projects drop constraint if exists lre_projects_billing_day_check;
alter table public.lre_projects add constraint lre_projects_billing_day_check check (billing_day is null or billing_day between 1 and 31);
