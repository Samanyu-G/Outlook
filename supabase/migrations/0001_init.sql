-- Nativity: Phase 1 database
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Big idea: every table has Row Level Security (RLS) turned on. The browser talks
-- to the database directly with a public key, so these "policies" are what stop
-- one user from editing another user's data. Never turn RLS off.

-- ---------------------------------------------------------------------------
-- PROFILES: one row per user. Created automatically when someone signs up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text not null unique check (handle ~ '^[a-z0-9._]{3,24}$'),
  display_name  text not null default '' check (char_length(display_name) <= 40),
  bio           text not null default '' check (char_length(bio) <= 160),
  avatar_color  text not null default '#f2d98d' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- GAMES: what shows up in the feed.
-- Phase 1 only has built-in demo games (builtin_key). Phase 2 adds uploads
-- (bundle_path / trailer_path point at files in storage).
-- ---------------------------------------------------------------------------
create table public.games (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 40),
  description     text not null default '' check (char_length(description) <= 280),
  tags            text[] not null default '{}',
  builtin_key     text,
  bundle_path     text,
  trailer_path    text,
  touch_friendly  boolean not null default true,
  status          text not null default 'published' check (status in ('draft', 'published', 'hidden')),
  created_at      timestamptz not null default now(),
  check (builtin_key is not null or bundle_path is not null)
);
create index games_creator_idx on public.games (creator_id);

-- ---------------------------------------------------------------------------
-- Social tables. Composite primary keys mean "you can only like a game once".
-- ---------------------------------------------------------------------------
create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index likes_game_idx on public.likes (game_id);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);
create index follows_creator_idx on public.follows (creator_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);
create index comments_game_idx on public.comments (game_id, created_at);

-- One view per person per game, so nobody can inflate numbers by scrolling.
create table public.views (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index views_game_idx on public.views (game_id);

-- Quick feedback chips ("Too hard", "Fun"...). Private: only the player and the creator see it.
create table public.feedback (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  tags       text[] not null check (cardinality(tags) between 1 and 6),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Every finished round. Used for "best score" and "games played".
create table public.plays (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    uuid not null references public.games (id) on delete cascade,
  score      integer not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index plays_user_game_idx on public.plays (user_id, game_id, score desc);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- auth.uid() = the id of the signed-in user making the request (null if signed out).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.games    enable row level security;
alter table public.likes    enable row level security;
alter table public.follows  enable row level security;
alter table public.comments enable row level security;
alter table public.views    enable row level security;
alter table public.feedback enable row level security;
alter table public.plays    enable row level security;

-- Profiles: anyone can read, you can only edit your own.
create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Games: anyone sees published games; creators also see their own drafts.
create policy "published games are public" on public.games for select
  using (status = 'published' or (select auth.uid()) = creator_id);
create policy "creators add own games" on public.games for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators edit own games" on public.games for update
  using ((select auth.uid()) = creator_id) with check ((select auth.uid()) = creator_id);
create policy "creators delete own games" on public.games for delete
  using ((select auth.uid()) = creator_id);

-- Likes and follows: public, but you can only add/remove your own.
create policy "likes are public" on public.likes for select using (true);
create policy "like as yourself" on public.likes for insert with check ((select auth.uid()) = user_id);
create policy "unlike your own" on public.likes for delete using ((select auth.uid()) = user_id);

create policy "follows are public" on public.follows for select using (true);
create policy "follow as yourself" on public.follows for insert with check ((select auth.uid()) = follower_id);
create policy "unfollow your own" on public.follows for delete using ((select auth.uid()) = follower_id);

-- Comments: public; delete your own, or any comment on a game you made.
create policy "comments are public" on public.comments for select using (true);
create policy "comment as yourself" on public.comments for insert with check ((select auth.uid()) = user_id);
create policy "delete own or on own game" on public.comments for delete using (
  (select auth.uid()) = user_id
  or (select auth.uid()) = (select g.creator_id from public.games g where g.id = game_id)
);

-- Views and plays: private to you (counts are exposed through game_feed below).
create policy "see own views" on public.views for select using ((select auth.uid()) = user_id);
create policy "add own view" on public.views for insert with check ((select auth.uid()) = user_id);

create policy "see own plays" on public.plays for select using ((select auth.uid()) = user_id);
create policy "add own play" on public.plays for insert with check ((select auth.uid()) = user_id);

-- Feedback: the player and the game's creator can read it.
create policy "player or creator reads feedback" on public.feedback for select using (
  (select auth.uid()) = user_id
  or (select auth.uid()) = (select g.creator_id from public.games g where g.id = game_id)
);
create policy "give own feedback" on public.feedback for insert with check ((select auth.uid()) = user_id);
create policy "update own feedback" on public.feedback for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- GAME_FEED: one row per published game with its creator and counts.
-- This view runs with its owner's rights so it can COUNT views without
-- exposing who viewed what. It only returns totals, never individual rows.
-- ---------------------------------------------------------------------------
create view public.game_feed as
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
  (select count(*) from public.follows  f where f.creator_id = g.creator_id)::int as follower_count
from public.games g
join public.profiles p on p.id = g.creator_id
where g.status = 'published';

grant select on public.game_feed to anon, authenticated;

-- ---------------------------------------------------------------------------
-- AUTO-CREATE A PROFILE ON SIGN-UP
-- Gives every new user a starter handle like "player3f9a21c0" that they can change.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle',
             'player' || substr(replace(new.id::text, '-', ''), 1, 8)),
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
