-- Nativity: table access for the app.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Two layers of security work together:
--   1. GRANTs (this file) say which KINDS of action a role may attempt on a table.
--      "anon" = signed-out visitors, "authenticated" = signed-in users.
--   2. RLS policies (0001_init.sql) then decide WHICH ROWS each person may touch.
-- Newer Supabase projects don't grant table access automatically, so we list it here.
-- Only grant what the app actually uses.

grant usage on schema public to anon, authenticated;

-- Public things anyone can read
grant select on public.profiles, public.games, public.likes, public.follows, public.comments to anon, authenticated;
grant select on public.game_feed to anon, authenticated;

-- Signed-in users: what they can do (RLS limits it to their own rows)
grant update (handle, display_name, bio) on public.profiles to authenticated;
grant insert, update, delete on public.games    to authenticated;
grant insert, delete         on public.likes    to authenticated;
grant insert, delete         on public.follows  to authenticated;
grant insert, delete         on public.comments to authenticated;
grant select, insert         on public.views    to authenticated;
grant select, insert, update on public.feedback to authenticated;
grant select, insert         on public.plays    to authenticated;
