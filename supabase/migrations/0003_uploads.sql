-- Nativity: Phase 2, creator uploads.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Files live in Supabase Storage:
--   games/<user id>/<game id>/index.html, game.js, images...   (the game itself)
--   trailers/<user id>/<game id>/trailer.mp4                    (the feed video)
-- Each creator can only write inside their own <user id> folder.

-- ---------------------------------------------------------------------------
-- Buckets. Public = anyone can download a file if they know its address,
-- which is what we want for playing games and watching trailers.
-- The size and type limits are enforced by Supabase, not just the app.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('games', 'games', true, 26214400, array[
    'text/plain', 'text/javascript', 'text/css', 'application/json',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac',
    'video/mp4', 'video/webm',
    'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
    'application/wasm', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream'
  ]),
  ('trailers', 'trailers', true, 15728640, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage rules: you may add, list and delete files only in your own folder.
-- storage.foldername('abc/def/x.png') = {abc, def}, so [1] is the user id.
-- ---------------------------------------------------------------------------
create policy "upload into own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('games', 'trailers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "list own folder" on storage.objects for select to authenticated
  using (
    bucket_id in ('games', 'trailers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "delete from own folder" on storage.objects for delete to authenticated
  using (
    bucket_id in ('games', 'trailers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Tighter rules for creating and editing games: an uploaded game must point
-- at files in the creator's own folder, and only the seed data may use the
-- built-in demo games.
-- ---------------------------------------------------------------------------
drop policy "creators add own games" on public.games;
create policy "creators add own games" on public.games for insert
  with check (
    (select auth.uid()) = creator_id
    and builtin_key is null
    and bundle_path like (select auth.uid())::text || '/%'
    and (trailer_path is null or trailer_path like (select auth.uid())::text || '/%')
  );

drop policy "creators edit own games" on public.games;
create policy "creators edit own games" on public.games for update
  using ((select auth.uid()) = creator_id)
  with check (
    (select auth.uid()) = creator_id
    and builtin_key is null
    and bundle_path like (select auth.uid())::text || '/%'
    and (trailer_path is null or trailer_path like (select auth.uid())::text || '/%')
  );
