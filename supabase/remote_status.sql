-- LRE Dashboard: is someone using the dedicated Bid2Win computer (Chrome Remote Desktop)?
-- Already applied to project vdbrbtuidsfftgotmlol. Kept here as a record; safe to run again.
-- One row, kept up to date by a small program on that computer (see tools/bid2win-status).

create table if not exists public.lre_remote_status (
  id            integer primary key default 1 check (id = 1),     -- only ever one row
  connected     boolean not null default false,
  state_since   timestamptz not null default now(),               -- when it last switched between in-use and available
  last_input_at timestamptz,                                      -- last keyboard / mouse activity on that computer
  heartbeat_at  timestamptz not null default now(),               -- last time the program reported
  host_name     text
);

alter table public.lre_remote_status enable row level security;
drop policy if exists "anon manage the status row" on public.lre_remote_status;
create policy "anon manage the status row" on public.lre_remote_status for all to anon using (id = 1) with check (id = 1);

-- The program calls this. The database stamps every time itself, so the dedicated computer's clock never matters.
create or replace function public.lre_report_remote_status(p_connected boolean, p_idle_seconds integer default null, p_host text default null)
returns void language plpgsql as $$
begin
  insert into public.lre_remote_status as s (id, connected, state_since, last_input_at, heartbeat_at, host_name)
  values (1, p_connected, now(),
          case when p_idle_seconds is not null then now() - make_interval(secs => greatest(p_idle_seconds, 0)) end,
          now(), p_host)
  on conflict (id) do update set
    state_since   = case when s.connected is distinct from p_connected then now() else s.state_since end,
    connected     = p_connected,
    last_input_at = coalesce(case when p_idle_seconds is not null then now() - make_interval(secs => greatest(p_idle_seconds, 0)) end, s.last_input_at),
    heartbeat_at  = now(),
    host_name     = coalesce(p_host, s.host_name);
end $$;

-- What the dashboard reads: the same row, with "how long ago" worked out by the database
create or replace view public.lre_remote_status_view as
select connected, host_name,
       state_since, last_input_at, heartbeat_at,
       extract(epoch from (now() - state_since))::integer   as state_age_s,
       extract(epoch from (now() - last_input_at))::integer as idle_s,
       extract(epoch from (now() - heartbeat_at))::integer  as heartbeat_age_s
from public.lre_remote_status;
grant select on public.lre_remote_status_view to anon;

notify pgrst, 'reload schema';
