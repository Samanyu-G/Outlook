-- Nativity: Phase 6, adults only (18+), consent records and retention.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- It is written to be safe to run more than once.
--
-- What it does
--   1. Policy versions and an append-only record of who accepted which version, and when.
--   2. A private age record per account. Date of birth is checked HERE, on the server,
--      against today's date in India (Asia/Kolkata). Only adults' birth dates are stored.
--   3. can_participate(): signed in, not a guest, 18+ on record, current Terms and
--      Privacy Policy accepted, not suspended. Every write that members make (cheers,
--      crews, notes, stamps, uploads, profile edits) now requires it, so changing the
--      app or calling the API directly cannot get around the age check.
--   4. Content from accounts that are not confirmed adults is not shown to others.
--   5. Date-of-birth corrections go through a request that a moderator reviews.
--   6. Account deletion keeps a minimal registration record for 180 days
--      (IT Rules 2021, rule 3(1)(h)) and preserves moderated content records for 180 days
--      (rule 3(1)(g)), then purges them. Guest IDs are purged after 90 days.
--   7. New report reasons (intimate images, under-18 account, impersonation, privacy).
--   8. A record of the quarterly rules reminder (IT Rules 2021, rule 3(1)(c), as amended 2026).

-- ---------------------------------------------------------------------------
-- 0. A private schema the website API cannot reach (Supabase only exposes "public").
-- ---------------------------------------------------------------------------
create schema if not exists compliance;
revoke all on schema compliance from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. POLICY VERSIONS AND ACCEPTANCES
-- ---------------------------------------------------------------------------
create table if not exists public.policy_versions (
  doc          text primary key check (doc in ('terms', 'privacy')),
  version      text not null,
  published_at timestamptz not null default now()
);
alter table public.policy_versions enable row level security;
drop policy if exists "policy versions are public" on public.policy_versions;
create policy "policy versions are public" on public.policy_versions for select using (true);
grant select on public.policy_versions to anon, authenticated;

-- The versions the app shows. Bump these (and the app's legal.js) when the documents change:
-- everyone is then asked to accept again before they can post.
insert into public.policy_versions (doc, version) values ('terms', 'v2'), ('privacy', 'v2')
on conflict (doc) do update set version = excluded.version, published_at = now()
  where public.policy_versions.version is distinct from excluded.version;

create table if not exists public.policy_acceptances (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  doc         text not null check (doc in ('terms', 'privacy')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, doc, version)
);
alter table public.policy_acceptances enable row level security;
drop policy if exists "see own acceptances" on public.policy_acceptances;
create policy "see own acceptances" on public.policy_acceptances for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.policy_acceptances to authenticated;   -- written only by accept_policies()

-- ---------------------------------------------------------------------------
-- 2. AGE RECORDS (private: only the account holder can read their own)
--   status 'adult'      : 18+ when checked; birth_date stored (needed for corrections)
--   status 'ineligible' : under 18 when checked; NO birth date is stored
--   status 'operator'   : demo accounts run by the Nativity team (seed data, no real person)
-- ---------------------------------------------------------------------------
create table if not exists public.account_age (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  status     text not null check (status in ('adult', 'ineligible', 'operator')),
  birth_date date,
  method     text not null check (method in ('self_declared_dob', 'correction_reviewed', 'operator_attested')),
  checked_at timestamptz not null default now(),
  check ((status = 'adult') = (birth_date is not null))
);
alter table public.account_age enable row level security;
drop policy if exists "see own age record" on public.account_age;
create policy "see own age record" on public.account_age for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.account_age to authenticated;   -- no insert/update grants: functions only

-- Today's date in India. Ages are worked out against this, never against the device clock.
create or replace function public.today_ist()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.is_eligible_author(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.account_age a where a.user_id = p_user and a.status in ('adult', 'operator'));
$$;
grant execute on function public.is_eligible_author(uuid) to anon, authenticated;

create or replace function public.has_current_consent(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.policy_versions pv
    where not exists (
      select 1 from public.policy_acceptances pa
      where pa.user_id = p_user and pa.doc = pv.doc and pa.version = pv.version
    )
  );
$$;

-- The one rule every member write goes through.
create or replace function public.can_participate()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and exists (select 1 from public.account_age a where a.user_id = (select auth.uid()) and a.status in ('adult', 'operator'))
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.banned)
     and public.has_current_consent((select auth.uid()));
$$;
grant execute on function public.can_participate() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. CONSENT: record acceptance of the current Terms and Privacy Policy
-- ---------------------------------------------------------------------------
create or replace function public.accept_policies(p_terms text, p_privacy text)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in first.';
  end if;
  if p_terms is distinct from (select version from public.policy_versions where doc = 'terms')
     or p_privacy is distinct from (select version from public.policy_versions where doc = 'privacy') then
    raise exception 'The Terms or Privacy Policy changed. Reload Nativity to read the latest version.';
  end if;
  insert into public.policy_acceptances (user_id, doc, version) values (uid, 'terms', p_terms), (uid, 'privacy', p_privacy)
  on conflict (user_id, doc, version) do nothing;
  update public.profiles set terms_accepted_at = now() where id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. DATE OF BIRTH: checked on the server, once per account
-- ---------------------------------------------------------------------------
-- Under-18 accounts: hide what they posted and remove their activity.
create or replace function public.restrict_ineligible(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.games set status = 'hidden' where creator_id = p_user and status = 'published';
  update public.comments set hidden = true where user_id = p_user;
  delete from public.likes where user_id = p_user;
  delete from public.follows where follower_id = p_user or creator_id = p_user;
  delete from public.feedback where user_id = p_user;
  delete from public.views where user_id = p_user;
  delete from public.plays where user_id = p_user;
  delete from public.play_starts where user_id = p_user;
end;
$$;
revoke execute on function public.restrict_ineligible(uuid) from public, anon, authenticated;

create or replace function public.confirm_birth_date(p_dob date)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := public.today_ist();
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in first.';
  end if;
  if exists (select 1 from public.account_age where user_id = uid) then
    raise exception 'Your date of birth is already on record. To change it, send a correction request from Options.';
  end if;
  if p_dob is null or p_dob < date '1900-01-01' or p_dob > today then
    raise exception 'Enter your real date of birth.';
  end if;

  if p_dob > (today - interval '18 years')::date then
    -- Under 18: record only the outcome, never the birth date.
    insert into public.account_age (user_id, status, birth_date, method) values (uid, 'ineligible', null, 'self_declared_dob');
    perform public.restrict_ineligible(uid);
    return 'ineligible';
  end if;

  insert into public.account_age (user_id, status, birth_date, method) values (uid, 'adult', p_dob, 'self_declared_dob');
  return 'adult';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. DATE-OF-BIRTH CORRECTIONS (reviewed by a moderator; no ID documents collected)
-- ---------------------------------------------------------------------------
create table if not exists public.dob_corrections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  requested_dob date not null,
  reason        text not null check (char_length(reason) between 10 and 500),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewer_note text check (char_length(reviewer_note) <= 300)
);
create unique index if not exists dob_corrections_one_pending on public.dob_corrections (user_id) where status = 'pending';
alter table public.dob_corrections enable row level security;
drop policy if exists "see own corrections" on public.dob_corrections;
create policy "see own corrections" on public.dob_corrections for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.dob_corrections to authenticated;

create or replace function public.request_birth_date_correction(p_dob date, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in first.';
  end if;
  if not exists (select 1 from public.account_age where user_id = uid and status in ('adult', 'ineligible')) then
    raise exception 'Confirm your date of birth first.';
  end if;
  if p_dob is null or p_dob < date '1900-01-01' or p_dob > public.today_ist() then
    raise exception 'Enter your real date of birth.';
  end if;
  if exists (select 1 from public.dob_corrections where user_id = uid and status = 'pending') then
    raise exception 'You already have a correction waiting for review.';
  end if;
  if (select count(*) from public.dob_corrections where user_id = uid and created_at > now() - interval '365 days') >= 2 then
    raise exception 'You can request at most 2 corrections a year. Contact the Grievance Officer if you need help.';
  end if;
  insert into public.dob_corrections (user_id, requested_dob, reason) values (uid, p_dob, trim(p_reason));
end;
$$;

-- Moderators: the queue, with the date currently on record.
create or replace function public.list_birth_date_corrections()
returns table (id uuid, user_id uuid, handle text, current_status text, current_dob date, requested_dob date, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.'; end if;
  return query
    select c.id, c.user_id, p.handle, a.status, a.birth_date, c.requested_dob, c.reason, c.created_at
    from public.dob_corrections c
    join public.profiles p on p.id = c.user_id
    left join public.account_age a on a.user_id = c.user_id
    where c.status = 'pending'
    order by c.created_at;
end;
$$;

create or replace function public.review_birth_date_correction(p_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare
  c public.dob_corrections%rowtype;
  adult boolean;
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.'; end if;
  select * into c from public.dob_corrections where id = p_id and status = 'pending' for update;
  if not found then raise exception 'That request was already reviewed.'; end if;
  if c.user_id = (select auth.uid()) then raise exception 'Another moderator must review your own request.'; end if;

  if p_approve then
    adult := c.requested_dob <= (public.today_ist() - interval '18 years')::date;
    update public.account_age
      set status = case when adult then 'adult' else 'ineligible' end,
          birth_date = case when adult then c.requested_dob else null end,
          method = 'correction_reviewed', checked_at = now()
      where user_id = c.user_id;
    if not adult then perform public.restrict_ineligible(c.user_id); end if;
  end if;

  update public.dob_corrections
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_at = now(), reviewed_by = (select auth.uid()), reviewer_note = left(coalesce(p_note, ''), 300)
    where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. ENFORCEMENT: every member write requires can_participate()
-- (restrictive policies are ANDed with the existing ones)
-- ---------------------------------------------------------------------------
drop policy if exists "adults only: like"          on public.likes;
drop policy if exists "adults only: follow"        on public.follows;
drop policy if exists "adults only: comment"       on public.comments;
drop policy if exists "adults only: feedback"      on public.feedback;
drop policy if exists "adults only: edit feedback" on public.feedback;
drop policy if exists "adults only: add game"      on public.games;
drop policy if exists "adults only: edit game"     on public.games;
drop policy if exists "adults only: edit profile"  on public.profiles;
drop policy if exists "adults only: upload files"  on storage.objects;

create policy "adults only: like" on public.likes as restrictive for insert to authenticated
  with check ((select public.can_participate()));
create policy "adults only: follow" on public.follows as restrictive for insert to authenticated
  with check ((select public.can_participate()));
create policy "adults only: comment" on public.comments as restrictive for insert to authenticated
  with check ((select public.can_participate()));
create policy "adults only: feedback" on public.feedback as restrictive for insert to authenticated
  with check ((select public.can_participate()));
create policy "adults only: edit feedback" on public.feedback as restrictive for update to authenticated
  using ((select public.can_participate())) with check ((select public.can_participate()));
create policy "adults only: add game" on public.games as restrictive for insert to authenticated
  with check ((select public.can_participate()));
create policy "adults only: edit game" on public.games as restrictive for update to authenticated
  using ((select public.can_participate())) with check ((select public.can_participate()));
create policy "adults only: edit profile" on public.profiles as restrictive for update to authenticated
  using ((select public.can_participate())) with check ((select public.can_participate()));
create policy "adults only: upload files" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('games', 'trailers') or (select public.can_participate()));
-- Deleting your own things, reporting, blocking and deleting your account stay open to every
-- signed-in member, so safety tools and privacy rights never depend on the age check.

-- ---------------------------------------------------------------------------
-- 7. VISIBILITY: only content from confirmed adults (or the team's demo accounts) is shown
-- ---------------------------------------------------------------------------
drop policy if exists "published games are public" on public.games;
create policy "published games are public" on public.games for select
  using ((status = 'published' and public.is_eligible_author(creator_id))
         or (select auth.uid()) = creator_id or (select public.is_admin()));

drop policy if exists "visible comments" on public.comments;
create policy "visible comments" on public.comments for select
  using ((not hidden and public.is_eligible_author(user_id))
         or (select auth.uid()) = user_id or (select public.is_admin()));

-- Same columns as 0007, plus the eligibility condition.
create or replace view public.game_feed as
select
  g.id, g.title, g.description, g.tags, g.builtin_key, g.bundle_path, g.trailer_path,
  g.touch_friendly, g.created_at, g.creator_id,
  p.handle        as creator_handle,
  p.display_name  as creator_name,
  p.avatar_color  as creator_color,
  p.bio           as creator_bio,
  (select count(*) from public.likes    l where l.game_id = g.id)::int        as like_count,
  (select count(*) from public.comments c where c.game_id = g.id and not c.hidden)::int as comment_count,
  (select count(*) from public.views    v where v.game_id = g.id)::int        as view_count,
  (select count(*) from public.follows  f where f.creator_id = g.creator_id)::int as follower_count,
  (select count(*) from public.play_starts s where s.game_id = g.id)::int                   as player_count,
  (select coalesce(sum(s.starts), 0) from public.play_starts s where s.game_id = g.id)::int as start_count,
  (select count(*) from public.feedback fb where fb.game_id = g.id
     and fb.tags && array['Fun', 'Pretty', 'Clever', 'Great visuals'])::int                 as positive_feedback,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Fun'])::int                       as stamp_fun,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Clever'])::int                    as stamp_clever,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Pretty', 'Great visuals'])::int    as stamp_pretty,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Tough', 'Too hard'])::int         as stamp_tough,
  (select count(*) from public.feedback fb where fb.game_id = g.id and fb.tags && array['Want more', 'Want more levels'])::int as stamp_more
from public.games g
join public.profiles p on p.id = g.creator_id
where g.status = 'published' and public.is_eligible_author(g.creator_id);

grant select on public.game_feed to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. EXISTING ACCOUNTS
-- Nobody is assumed to be an adult. Real accounts get no age record, so they must
-- confirm their date of birth (and accept the new terms) before they can post again,
-- and their games and notes are not shown until they do.
-- The five seed accounts from seed.sql are fictional demo personas run by the
-- Nativity team (emails end in @demo.invalid), so they are marked 'operator'.
-- ---------------------------------------------------------------------------
insert into public.account_age (user_id, status, birth_date, method)
select u.id, 'operator', null, 'operator_attested'
from auth.users u
where u.id in ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002',
               '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004',
               '00000000-0000-4000-a000-000000000005')
  and u.email like '%@demo.invalid'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. REPORT REASONS (new ones for the IT Rules grievance tracks)
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in (
  'sexual', 'intimate', 'violence', 'harassment', 'minor', 'impersonation', 'privacy',
  'scam', 'copyright', 'spam', 'other'));

-- ---------------------------------------------------------------------------
-- 10. QUARTERLY RULES REMINDER (IT Rules 3(1)(c): inform users at least every 3 months)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists rules_notified_at timestamptz;
create or replace function public.ack_rules_notice()
returns void language sql security definer set search_path = ''
as $$ update public.profiles set rules_notified_at = now() where id = (select auth.uid()); $$;

-- What the app needs to know about the signed-in account (one call).
create or replace function public.my_account_state()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'age_status', (select a.status from public.account_age a where a.user_id = (select auth.uid())),
    'birth_date', (select a.birth_date from public.account_age a where a.user_id = (select auth.uid())),
    'accepted', coalesce((select jsonb_object_agg(pa.doc, pa.version) from (
        select distinct on (doc) doc, version from public.policy_acceptances
        where user_id = (select auth.uid()) order by doc, accepted_at desc) pa), '{}'::jsonb),
    'current', (select jsonb_object_agg(doc, version) from public.policy_versions),
    'correction', (select jsonb_build_object('status', c.status, 'requested_dob', c.requested_dob, 'created_at', c.created_at, 'note', c.reviewer_note)
        from public.dob_corrections c where c.user_id = (select auth.uid()) order by c.created_at desc limit 1),
    'rules_notified_at', (select p.rules_notified_at from public.profiles p where p.id = (select auth.uid())),
    'can_participate', public.can_participate()
  );
$$;

-- ---------------------------------------------------------------------------
-- 11. RETENTION
-- ---------------------------------------------------------------------------
-- Minimal registration record kept 180 days after an account is deleted (IT Rules 3(1)(h)).
create table if not exists compliance.deleted_accounts (
  user_id            uuid not null,
  email              text,
  handle             text,
  account_created_at timestamptz,
  age_status         text,
  reason             text not null,
  deleted_at         timestamptz not null default now(),
  purge_after        timestamptz not null default now() + interval '180 days'
);
-- Moderated (hidden) content and its reports, kept 180 days when the author deletes
-- their account (IT Rules 3(1)(g)). Uploaded files themselves are not kept.
create table if not exists compliance.preserved_content (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  kind        text not null,
  payload     jsonb not null,
  saved_at    timestamptz not null default now(),
  purge_after timestamptz not null default now() + interval '180 days'
);
revoke all on all tables in schema compliance from public, anon, authenticated;

create or replace function compliance.archive_account(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into compliance.deleted_accounts (user_id, email, handle, account_created_at, age_status, reason)
  select u.id, u.email, p.handle, u.created_at, a.status, p_reason
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.account_age a on a.user_id = u.id
  where u.id = p_user;

  insert into compliance.preserved_content (user_id, kind, payload)
  select p_user, 'hidden_game', to_jsonb(g) from public.games g where g.creator_id = p_user and g.status = 'hidden';
  insert into compliance.preserved_content (user_id, kind, payload)
  select p_user, 'hidden_comment', to_jsonb(c) from public.comments c where c.user_id = p_user and c.hidden;
  insert into compliance.preserved_content (user_id, kind, payload)
  select p_user, 'report_about_user', to_jsonb(r) from public.reports r
  where (r.target_type = 'game' and r.target_id in (select id from public.games where creator_id = p_user))
     or (r.target_type = 'comment' and r.target_id in (select id from public.comments where user_id = p_user));
end;
$$;

-- Replaces 0007's version: archive first, then delete.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform compliance.archive_account(uid, 'deleted_by_user');
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace function compliance.run_retention()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a int; b int; c int; d int;
begin
  delete from compliance.deleted_accounts where purge_after < now(); get diagnostics a = row_count;
  delete from compliance.preserved_content where purge_after < now(); get diagnostics b = row_count;
  -- Guest IDs (anonymous sessions) and their view/play history: 90 days.
  delete from auth.users where is_anonymous and created_at < now() - interval '90 days'; get diagnostics c = row_count;
  -- Under-18 accounts that uploaded nothing: removed 30 days after the check
  -- (registration record kept 180 days as above). Accounts with uploads are left
  -- for a moderator, because their files must be removed through Storage.
  with gone as (
    select a.user_id from public.account_age a
    where a.status = 'ineligible' and a.checked_at < now() - interval '30 days'
      and not exists (select 1 from public.games g where g.creator_id = a.user_id and g.builtin_key is null)
  )
  select count(*) into d from gone;
  perform compliance.archive_account(user_id, 'under_18') from public.account_age
    where status = 'ineligible' and checked_at < now() - interval '30 days'
      and not exists (select 1 from public.games g where g.creator_id = account_age.user_id and g.builtin_key is null);
  delete from auth.users where id in (
    select a.user_id from public.account_age a
    where a.status = 'ineligible' and a.checked_at < now() - interval '30 days'
      and not exists (select 1 from public.games g where g.creator_id = a.user_id and g.builtin_key is null));
  return jsonb_build_object('deleted_account_records', a, 'preserved_content', b, 'guests', c, 'under_18_accounts', d);
end;
$$;
revoke all on function compliance.run_retention() from public, anon, authenticated;

-- Run retention every night at 03:30 IST (22:00 UTC) if pg_cron is available.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not available: enable it under Database -> Extensions, then run this block again.';
    return;
  end;
  perform cron.unschedule(jobid) from cron.job where jobname = 'nativity-retention';
  perform cron.schedule('nativity-retention', '0 22 * * *', 'select compliance.run_retention()');
  raise notice 'Scheduled nightly retention job.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. FUNCTION PERMISSIONS
-- ---------------------------------------------------------------------------
revoke all on function public.has_current_consent(uuid) from public, anon;
grant execute on function public.has_current_consent(uuid) to authenticated;
revoke all on function public.my_account_state() from public, anon;
grant execute on function public.my_account_state() to authenticated;
revoke all on function public.accept_policies(text, text) from public, anon;
grant execute on function public.accept_policies(text, text) to authenticated;
revoke all on function public.confirm_birth_date(date) from public, anon;
grant execute on function public.confirm_birth_date(date) to authenticated;
revoke all on function public.request_birth_date_correction(date, text) from public, anon;
grant execute on function public.request_birth_date_correction(date, text) to authenticated;
revoke all on function public.list_birth_date_corrections() from public, anon;
grant execute on function public.list_birth_date_corrections() to authenticated;
revoke all on function public.review_birth_date_correction(uuid, boolean, text) from public, anon;
grant execute on function public.review_birth_date_correction(uuid, boolean, text) to authenticated;
revoke all on function public.ack_rules_notice() from public, anon;
grant execute on function public.ack_rules_notice() to authenticated;
