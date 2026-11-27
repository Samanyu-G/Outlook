-- Phase 5: the redesigned screens (Figma "Nativity — Design System & Screens").
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
--
-- 1. Stamps. Feedback chips are now five "stamps": Fun, Clever, Pretty, Tough, Want more.
--    The feed view gets one total per stamp (totals only: nobody can see who gave what).
--    Older feedback is counted too: "Great visuals" -> Pretty, "Too hard" -> Tough,
--    "Want more levels" -> Want more.
-- 2. delete_my_account(): lets a member delete their own account from Options.

create or replace view public.game_feed as
select
  g.id, g.title, g.description, g.tags, g.builtin_key, g.bundle_path, g.trailer_path,
  g.touch_friendly, g.created_at, g.creator_id,
  p.handle        as creator_handle,
  p.display_name  as creator_name,
  p.avatar_color  as creator_color,
  p.bio           as creator_bio,
  (select count(*) from public.likes    l where l.game_id = g.id)::int        as like_count,
  (select count(*) from public.comments c where c.game_id = g.id)::int        as comment_count,
  (select count(*) from public.views    v where v.game_id = g.id)::int        as view_count,
  (select count(*) from public.follows  f where f.creator_id = g.creator_id)::int as follower_count,
  (select count(*) from public.play_starts s where s.game_id = g.id)::int                   as player_count,
  (select coalesce(sum(s.starts), 0) from public.play_starts s where s.game_id = g.id)::int as start_count,
  (select count(*) from public.feedback fb where fb.game_id = g.id
     and fb.tags && array['Fun', 'Pretty', 'Clever', 'Great visuals'])::int                 as positive_feedback,
  -- new in 0007
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Fun'])::int                       as stamp_fun,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Clever'])::int                    as stamp_clever,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Pretty', 'Great visuals'])::int    as stamp_pretty,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Tough', 'Too hard'])::int         as stamp_tough,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Want more', 'Want more levels'])::int as stamp_more
from public.games g
join public.profiles p on p.id = g.creator_id
where g.status = 'published';

grant select on public.game_feed to anon, authenticated;

-- Deletes the signed-in member's account. Their profile, games, likes, comments,
-- follows, views, plays and feedback are removed by the "on delete cascade" rules.
-- The app deletes the game files from storage first (storage can't cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
