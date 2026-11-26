-- Nativity: Phase 3, a fair feed.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Before running it, turn on: Authentication -> Sign In / Providers -> "Allow anonymous sign-ins".
--
-- What this adds:
--   1. Guests: every visitor gets an invisible anonymous account so their views count.
--      Guests can watch and play, but can't like, comment, follow, give feedback or upload.
--   2. play_starts: who tapped Play on what, and how often (replays).
--   3. record_view / record_play_start: the only way the app records these.
--   4. game_feed gets engagement numbers; ranked_feed() orders the feed.
--   5. Limits that stop comment, like, follow and upload spam.

-- ---------------------------------------------------------------------------
-- 1. GUESTS
-- ---------------------------------------------------------------------------
-- Guests get a profile too (views point at profiles), with a "guest" handle.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle',
             case when new.is_anonymous then 'guest' else 'player' end
               || substr(replace(new.id::text, '-', ''), 1, case when new.is_anonymous then 12 else 8 end)),
    left(coalesce(new.raw_user_meta_data ->> 'full_name',
                  new.raw_user_meta_data ->> 'name',
                  split_part(coalesce(new.email, ''), '@', 1),
                  ''), 40),
    coalesce(new.raw_user_meta_data ->> 'avatar_color',
             (array['#f4b6a0','#b9cde6','#b7d3c0','#f2d98d','#e7b3c0'])[1 + floor(random() * 5)::int])
  );
  return new;
end;
$$;

-- "Restrictive" policies are extra rules that must ALSO pass. These say:
-- guests (anonymous accounts) can't do social actions or upload.
create policy "members only: like" on public.likes as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: follow" on public.follows as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: comment" on public.comments as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: feedback" on public.feedback as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: edit feedback" on public.feedback as restrictive for update to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: add game" on public.games as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: edit game" on public.games as restrictive for update to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: edit profile" on public.profiles as restrictive for update to authenticated
  using ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "members only: upload files" on storage.objects as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);

-- ---------------------------------------------------------------------------
-- 2. PLAY STARTS (one row per person per game; "starts" counts replays)
-- ---------------------------------------------------------------------------
create table public.play_starts (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  game_id  uuid not null references public.games (id) on delete cascade,
  starts   integer not null default 1 check (starts > 0),
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index play_starts_game_idx on public.play_starts (game_id);
alter table public.play_starts enable row level security;
create policy "see own play starts" on public.play_starts for select using ((select auth.uid()) = user_id);
grant select on public.play_starts to authenticated;
-- No insert/update grants: the app can only write through record_play_start() below,
-- so nobody can set "starts" to a million.

-- ---------------------------------------------------------------------------
-- 3. RECORDING VIEWS AND PLAYS
-- ---------------------------------------------------------------------------
-- A view: called by the app after a trailer has been on screen for 3 seconds.
-- Counted once per person per game (the views table's primary key).
create function public.record_view(p_game uuid)
returns void
language sql
security invoker set search_path = ''
as $$
  insert into public.views (user_id, game_id)
  select (select auth.uid()), p_game
  where (select auth.uid()) is not null
  on conflict do nothing;
$$;

-- A play start: called when someone taps Play (or Play again).
-- Replays only count if at least 20 seconds apart.
create function public.record_play_start(p_game uuid)
returns void
language sql
security definer set search_path = ''
as $$
  insert into public.play_starts (user_id, game_id)
  select (select auth.uid()), p_game
  where (select auth.uid()) is not null
    and exists (select 1 from public.games g where g.id = p_game and g.status = 'published')
  on conflict (user_id, game_id) do update
    set starts = public.play_starts.starts + 1, last_at = now()
    where public.play_starts.last_at < now() - interval '20 seconds';
$$;

revoke execute on function public.record_view(uuid) from public, anon;
revoke execute on function public.record_play_start(uuid) from public, anon;
grant execute on function public.record_view(uuid) to authenticated;
grant execute on function public.record_play_start(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. FEED NUMBERS AND RANKING
-- ---------------------------------------------------------------------------
-- Same view as before with four new numbers added at the end. These are totals
-- only; nobody can see who played or what feedback a specific person gave.
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
     and fb.tags && array['Fun', 'Great visuals'])::int                                    as positive_feedback
from public.games g
join public.profiles p on p.id = g.creator_id
where g.status = 'published';

grant select on public.game_feed to anon, authenticated;

-- The feed order.
--   'foryou'    : every 3rd slot (1st, 4th, 7th...) is a boosted game (< 100 views,
--                 fewest views first). Other slots are ranked by engagement.
--                 Games you've already seen go to the end.
--   'fresh'     : boosted games first (fewest views first), then everything else newest first.
--   'following' : newest games from creators you follow.
--
-- Engagement score (0 to about 1), smoothed so a game with 3 views can't top the charts:
--   50%  play rate      = (players + 1) / (views + 5)          did the trailer make people tap Play?
--   25%  like rate      = (likes + 1) / (views + 10), x3, capped at 1
--   15%  replays        = extra plays per player, capped at 3
--   10%  "Fun" feedback = (positive feedback + 1) / (players + 5)
-- then multiplied by a gentle freshness factor: 1 / sqrt(1 + age in days / 30).
create function public.ranked_feed(p_tab text default 'foryou', p_limit integer default 50)
returns setof public.game_feed
language sql
stable
security invoker set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  base as (
    select
      f.id,
      f.view_count < 100 as boosted,
      f.view_count,
      f.created_at,
      exists (select 1 from public.views v, me where v.user_id = me.uid and v.game_id = f.id) as seen,
      ( 0.50 * (f.player_count + 1.0) / (f.view_count + 5.0)
      + 0.25 * least(3.0 * (f.like_count + 1.0) / (f.view_count + 10.0), 1.0)
      + 0.15 * least(greatest(f.start_count::numeric / nullif(f.player_count, 0) - 1, 0), 3) / 3
      + 0.10 * (f.positive_feedback + 1.0) / (f.player_count + 5.0)
      ) / sqrt(1 + extract(epoch from (now() - f.created_at)) / 86400.0 / 30.0) as score
    from public.game_feed f
    where p_tab <> 'following'
       or f.creator_id in (select fo.creator_id from public.follows fo, me where fo.follower_id = me.uid)
  ),
  keyed as (
    select id, seen,
      case p_tab
        when 'fresh' then
          row_number() over (order by boosted desc, case when boosted then view_count end asc, created_at desc)
        when 'following' then
          row_number() over (order by created_at desc)
        else
          case when boosted
            then row_number() over (partition by boosted order by view_count asc, created_at desc) * 3 - 2
            else (row_number() over (partition by boosted order by score desc))
                 + (row_number() over (partition by boosted order by score desc) - 1) / 2 + 1
          end
      end as k
    from base
  )
  select f.*
  from public.game_feed f
  join keyed on keyed.id = f.id
  order by (case when p_tab = 'following' then false else keyed.seen end), keyed.k
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.ranked_feed(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. SPAM LIMITS
-- Runs before every new comment, like, follow and game. auth.uid() is empty
-- for admin work in the dashboard (like seed.sql), which isn't limited.
-- ---------------------------------------------------------------------------
create function public.enforce_limits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null then return new; end if;

  if tg_table_name = 'comments' then
    select count(*) into n from public.comments where user_id = uid and created_at > now() - interval '1 minute';
    if n >= 5 then raise exception 'Slow down: you can post 5 comments a minute.'; end if;
    select count(*) into n from public.comments where user_id = uid and created_at > now() - interval '1 day';
    if n >= 100 then raise exception 'You’ve reached today’s limit of 100 comments.'; end if;
    if exists (select 1 from public.comments where user_id = uid and body = new.body and created_at > now() - interval '10 minutes') then
      raise exception 'You just posted that comment.';
    end if;

  elsif tg_table_name = 'likes' then
    select count(*) into n from public.likes where user_id = uid and created_at > now() - interval '1 hour';
    if n >= 200 then raise exception 'Slow down: that’s a lot of likes in one hour.'; end if;

  elsif tg_table_name = 'follows' then
    select count(*) into n from public.follows where follower_id = uid and created_at > now() - interval '1 hour';
    if n >= 100 then raise exception 'Slow down: that’s a lot of follows in one hour.'; end if;

  elsif tg_table_name = 'games' then
    select count(*) into n from public.games where creator_id = uid and created_at > now() - interval '1 day';
    if n >= 5 then raise exception 'You can publish up to 5 games a day. Try again tomorrow.'; end if;
  end if;

  return new;
end;
$$;

create trigger limit_comments before insert on public.comments for each row execute function public.enforce_limits();
create trigger limit_likes    before insert on public.likes    for each row execute function public.enforce_limits();
create trigger limit_follows  before insert on public.follows  for each row execute function public.enforce_limits();
create trigger limit_games    before insert on public.games    for each row execute function public.enforce_limits();
