-- PoultryVision private video storage setup
-- Run once in Supabase Dashboard -> SQL Editor -> New query.
-- This creates/updates a PRIVATE bucket and lets each signed-in user manage only their own folder.
-- Never add a service_role/secret key to the website.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'poultry-videos',
  'poultry-videos',
  false,
  262144000,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The website lists a user's folder before upload and deletes old clips when asked.
-- Re-running this setup safely replaces only these four named policies.
drop policy if exists "PoultryVision users can upload own clips" on storage.objects;
drop policy if exists "PoultryVision users can list own clips" on storage.objects;
drop policy if exists "PoultryVision users can delete own clips" on storage.objects;

create policy "PoultryVision users can upload own clips"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'poultry-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "PoultryVision users can list own clips"
on storage.objects for select to authenticated
using (
  bucket_id = 'poultry-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "PoultryVision users can delete own clips"
on storage.objects for delete to authenticated
using (
  bucket_id = 'poultry-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
