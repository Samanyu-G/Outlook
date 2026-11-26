-- Nativity: small fix for 0004_feed.sql.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- ranked_feed() checks "games you've already seen" in the views table.
-- Signed-out visitors had no permission to look at that table at all, so the
-- feed failed for them. This lets them look; the RLS rule "see own views"
-- still returns nothing for someone without an account.
grant select on public.views to anon;
