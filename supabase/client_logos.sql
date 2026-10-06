-- LRE Dashboard: client logos
-- Run this once in the Supabase SQL editor (project vdbrbtuidsfftgotmlol -> SQL Editor -> New query -> paste -> Run).
-- It is safe to run more than once.

-- One row per client: which logo image to show on that client's card
create table if not exists public.lre_client_logos (
  client_key  text primary key,            -- trimmed, lower-cased client name (so "Acme City" and "acme city " match)
  client_name text not null,               -- the name as displayed
  logo_url    text not null,               -- public URL of the image
  logo_path   text not null,               -- path inside the bucket (used to delete the old file when a logo is replaced)
  updated_at  timestamptz not null default now()
);

alter table public.lre_client_logos enable row level security;
drop policy if exists "anon all lre_client_logos" on public.lre_client_logos;
create policy "anon all lre_client_logos" on public.lre_client_logos
  for all to anon using (true) with check (true);

-- Public bucket for the images. Logos are resized in the browser to 256px or less, so 1 MB is a generous cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-logos', 'client-logos', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon read client-logos"   on storage.objects;
drop policy if exists "anon insert client-logos" on storage.objects;
drop policy if exists "anon update client-logos" on storage.objects;
drop policy if exists "anon delete client-logos" on storage.objects;
create policy "anon read client-logos"   on storage.objects for select to anon using (bucket_id = 'client-logos');
create policy "anon insert client-logos" on storage.objects for insert to anon with check (bucket_id = 'client-logos');
create policy "anon update client-logos" on storage.objects for update to anon using (bucket_id = 'client-logos') with check (bucket_id = 'client-logos');
create policy "anon delete client-logos" on storage.objects for delete to anon using (bucket_id = 'client-logos');
