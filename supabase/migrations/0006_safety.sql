-- Nativity: Phase 4, safety.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Adds: moderator role, suspended accounts, terms acceptance, reports (with
-- auto-hide at 3 reports), blocking, hidden comments, and moderator actions.
-- After running it, make yourself a moderator (see the last lines of this file).

-- ---------------------------------------------------------------------------
-- 1. PROFILES: role, suspension, terms
-- Users can only edit handle, display_name and bio (column grant in 0002),
-- so nobody can make themselves an admin or lift their own suspension.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column role text not null default 'member' check (role in ('member', 'admin')),
  add column banned boolean not null default false,
  add column terms_accepted_at timestamptz;

create function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and not banned
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

create function public.accept_terms()
returns void
language sql
security definer set search_path = ''
as $$
  update public.profiles set terms_accepted_at = now()
  where id = (select auth.uid()) and terms_accepted_at is null;
$$;
revoke execute on function public.accept_terms() from public, anon;
grant execute on function public.accept_terms() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. REPORTS
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('game', 'comment')),
  target_id   uuid not null,
  reason      text not null check (reason in ('sexual', 'violence', 'harassment', 'scam', 'copyright', 'spam', 'other')),
  details     text not null default '' check (char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  unique (reporter_id, target_type, target_id)   -- one report per person per thing
);
create index reports_open_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
alter table public.reports enable row level security;

create policy "report as yourself" on public.reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id);
create policy "members only: report" on public.reports as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
create policy "see own reports, admins see all" on public.reports for select
  using ((select auth.uid()) = reporter_id or (select public.is_admin()));
grant select, insert on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- 3. BLOCKS: hide someone's games and comments from yourself
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "see own blocks" on public.blocks for select using ((select auth.uid()) = blocker_id);
create policy "block as yourself" on public.blocks for insert to authenticated with check ((select auth.uid()) = blocker_id);
create policy "unblock your own" on public.blocks for delete to authenticated using ((select auth.uid()) = blocker_id);
create policy "members only: block" on public.blocks as restrictive for insert to authenticated
  with check ((select (auth.jwt() ->> 'is_anonymous')::boolean) is not true);
grant select on public.blocks to anon, authenticated;   -- anon: ranked_feed reads it (RLS returns nothing)
grant insert, delete on public.blocks to authenticated;

-- ---------------------------------------------------------------------------
-- 4. HIDDEN CONTENT
-- Hidden comments are only visible to their author and moderators.
-- Hidden games (status 'hidden') are only visible to their creator and moderators.
-- ---------------------------------------------------------------------------
alter table public.comments add column hidden boolean not null default false;

drop policy "comments are public" on public.comments;
create policy "visible comments" on public.comments for select
  using (not hidden or (select auth.uid()) = user_id or (select public.is_admin()));

drop policy "published games are public" on public.games;
create policy "published games are public" on public.games for select
  using (status = 'published' or (select auth.uid()) = creator_id or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 5. AUTO-HIDE: 3 different people report the same thing -> hidden until reviewed
-- ---------------------------------------------------------------------------
create function public.auto_hide()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare n integer;
begin
  select count(distinct reporter_id) into n from public.reports
  where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if n >= 3 then
    if new.target_type = 'game' then
      update public.games set status = 'hidden' where id = new.target_id and status = 'published';
    else
      update public.comments set hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger reports_auto_hide after insert on public.reports for each row execute function public.auto_hide();

-- ---------------------------------------------------------------------------
-- 6. MODERATOR ACTIONS (only work for admins)
-- ---------------------------------------------------------------------------
create function public.moderate(p_type text, p_id uuid, p_action text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.'; end if;
  if p_action not in ('hide', 'restore', 'dismiss') then raise exception 'Unknown action.'; end if;

  if p_type = 'game' then
    if p_action = 'hide' then update public.games set status = 'hidden' where id = p_id;
    elsif p_action = 'restore' then update public.games set status = 'published' where id = p_id and status = 'hidden';
    end if;
  elsif p_type = 'comment' then
    if p_action = 'hide' then update public.comments set hidden = true where id = p_id;
    elsif p_action = 'restore' then update public.comments set hidden = false where id = p_id;
    end if;
  else
    raise exception 'Unknown content type.';
  end if;

  update public.reports
  set status = case when p_action = 'hide' then 'actioned' else 'dismissed' end,
      resolved_at = now(), resolved_by = (select auth.uid())
  where target_type = p_type and target_id = p_id and status = 'open';
end;
$$;

create function public.set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.'; end if;
  if p_user = (select auth.uid()) then raise exception 'You can’t suspend yourself.'; end if;
  update public.profiles set banned = p_suspended where id = p_user and role <> 'admin';
end;
$$;

revoke execute on function public.moderate(text, uuid, text) from public, anon;
revoke execute on function public.set_suspended(uuid, boolean) from public, anon;
grant execute on function public.moderate(text, uuid, text) to authenticated;
grant execute on function public.set_suspended(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. LIMITS: suspended accounts can't post; max 20 reports a day
-- (replaces the function from 0004; the existing triggers keep using it)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_limits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null then return new; end if;

  if exists (select 1 from public.profiles where id = uid and banned) then
    raise exception 'Your account is suspended. Contact the Nativity team if you think this is a mistake.';
  end if;

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

  elsif tg_table_name = 'reports' then
    select count(*) into n from public.reports where reporter_id = uid and created_at > now() - interval '1 day';
    if n >= 20 then raise exception 'You’ve sent a lot of reports today. Thank you! Try again tomorrow.'; end if;
  end if;

  return new;
end;
$$;

create trigger limit_reports  before insert on public.reports  for each row execute function public.enforce_limits();
create trigger limit_feedback before insert on public.feedback for each row execute function public.enforce_limits();

-- ---------------------------------------------------------------------------
-- 8. FEED: never show you games from people you've blocked
-- (same as 0004 plus one "not blocked" condition)
-- ---------------------------------------------------------------------------
create or replace function public.ranked_feed(p_tab text default 'foryou', p_limit integer default 50)
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
    where (p_tab <> 'following'
       or f.creator_id in (select fo.creator_id from public.follows fo, me where fo.follower_id = me.uid))
      and not exists (select 1 from public.blocks b, me where b.blocker_id = me.uid and b.blocked_id = f.creator_id)
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

-- ---------------------------------------------------------------------------
-- 9. MAKE YOURSELF A MODERATOR
-- Run this separately afterwards, with YOUR handle instead of your-handle:
--
--   update public.profiles set role = 'admin' where handle = 'your-handle';
-- ---------------------------------------------------------------------------
