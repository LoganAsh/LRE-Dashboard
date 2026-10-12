-- LRE Dashboard: per-client disposition when a project is bid to several clients
-- Already applied to project vdbrbtuidsfftgotmlol. Kept here as a record; safe to run again.
-- Informational only: it never changes the bid's overall status (status / status_override).
alter table public.lre_bid_placements add column if not exists disposition text not null default 'Pending';
alter table public.lre_bid_placements drop constraint if exists lre_bid_placements_disposition_check;
alter table public.lre_bid_placements add constraint lre_bid_placements_disposition_check
  check (disposition in ('Pending', 'Client Awarded', 'Client Not Awarded'));
