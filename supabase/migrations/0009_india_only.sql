-- Nativity: Phase 7, available only to residents of India (and still 18+).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- How residency is established (proportionate, no documents, no precise location):
--   1. The person declares whether they live in India.
--   2. At that moment the server reads the country of their connection from
--      Cloudflare's "cf-ipcountry" header. Cloudflare sets this itself; a client
--      cannot override it (tested 28 Nov 2026). Only the 2-letter country is kept,
--      never the IP address.
--   3. Declared India + connection in India      -> 'resident'
--      Declared India + connection elsewhere/unknown (travel, VPN, bad geo-IP)
--                                                 -> 'review': they can check again later
--                                                    from India, or a moderator reviews.
--      Declared outside India                     -> 'not_resident' (blocked; can ask for review)
--   IP location is only a signal. It does not prove residency, and an Indian IP
--   does not make someone a resident; the declaration and the Terms do that.
--
-- Both conditions are required to post: 18+ (0008) AND resident of India (this file).

-- ---------------------------------------------------------------------------
-- 1. RESIDENCY RECORDS (only the account holder can read their own)
-- ---------------------------------------------------------------------------
create table if not exists public.account_residency (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  status         text not null check (status in ('resident', 'review', 'not_resident', 'operator')),
  declared_india boolean,                      -- what the person told us
  signal_country text check (signal_country ~ '^[A-Z0-9]{2}$'),   -- connection country at the last check
  method         text not null check (method in ('declared_signal_match', 'declared_pending_review',
                   'declared_not_resident', 'review_approved', 'review_rejected', 'operator_attested')),
  checked_at     timestamptz not null default now()
);
alter table public.account_residency enable row level security;
drop policy if exists "see own residency" on public.account_residency;
create policy "see own residency" on public.account_residency for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.account_residency to authenticated;   -- written only by functions

create table if not exists public.residency_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  note           text not null default '' check (char_length(note) <= 500),
  signal_country text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewer_note  text check (char_length(reviewer_note) <= 300)
);
create unique index if not exists residency_reviews_one_pending on public.residency_reviews (user_id) where status = 'pending';
alter table public.residency_reviews enable row level security;
drop policy if exists "see own residency reviews" on public.residency_reviews;
create policy "see own residency reviews" on public.residency_reviews for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.residency_reviews to authenticated;

-- The connection's country, as set by Cloudflare in front of the API. NULL if unknown.
-- (XX = unknown, T1 = Tor are treated as unknown.)
create or replace function public.request_country()
returns text language sql stable set search_path = ''
as $$
  select case when c ~ '^[A-Z]{2}$' and c not in ('XX', 'T1') then c end
  from (select upper(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'cf-ipcountry', '')) as c) h;
$$;

-- ---------------------------------------------------------------------------
-- 2. DECLARE / RE-CHECK RESIDENCY
-- ---------------------------------------------------------------------------
create or replace function public.confirm_residency(p_india boolean, p_note text default '')
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cur text;
  c text := public.request_country();
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in first.';
  end if;
  select status into cur from public.account_residency where user_id = uid;
  if cur in ('resident', 'operator') then
    raise exception 'Your residency is already confirmed.';
  end if;
  if cur = 'not_resident' then
    raise exception 'This account is recorded as living outside India. If that''s wrong, ask for a review.';
  end if;

  if p_india is not true then
    insert into public.account_residency (user_id, status, declared_india, signal_country, method)
    values (uid, 'not_resident', false, c, 'declared_not_resident')
    on conflict (user_id) do update set status = 'not_resident', declared_india = false,
      signal_country = excluded.signal_country, method = excluded.method, checked_at = now();
    perform public.restrict_ineligible(uid);
    return 'not_resident';
  end if;

  if c = 'IN' then
    insert into public.account_residency (user_id, status, declared_india, signal_country, method)
    values (uid, 'resident', true, c, 'declared_signal_match')
    on conflict (user_id) do update set status = 'resident', declared_india = true,
      signal_country = 'IN', method = excluded.method, checked_at = now();
    update public.residency_reviews set status = 'approved', reviewed_at = now(),
      reviewer_note = 'Confirmed automatically: you checked again from a connection in India.'
      where user_id = uid and status = 'pending';
    return 'resident';
  end if;

  -- Declared India, but the connection isn't in India (or can't be told): review.
  insert into public.account_residency (user_id, status, declared_india, signal_country, method)
  values (uid, 'review', true, c, 'declared_pending_review')
  on conflict (user_id) do update set status = 'review', declared_india = true,
    signal_country = excluded.signal_country, method = excluded.method, checked_at = now();
  if not exists (select 1 from public.residency_reviews where user_id = uid and status = 'pending') then
    insert into public.residency_reviews (user_id, note, signal_country) values (uid, left(trim(coalesce(p_note, '')), 500), c);
  end if;
  return 'review';
end;
$$;

-- Someone recorded as outside India (or waiting) who wants a person to look at it.
create or replace function public.request_residency_review(p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in first.';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 10 then
    raise exception 'Tell us a bit more (at least 10 characters).';
  end if;
  if not exists (select 1 from public.account_residency where user_id = uid and status in ('review', 'not_resident')) then
    raise exception 'There is nothing to review.';
  end if;
  if (select count(*) from public.residency_reviews where user_id = uid and created_at > now() - interval '365 days') >= 3 then
    raise exception 'You can ask for at most 3 reviews a year. Contact the Grievance Officer if you need help.';
  end if;
  update public.residency_reviews set note = left(trim(p_note), 500) where user_id = uid and status = 'pending';
  if not found then
    insert into public.residency_reviews (user_id, note, signal_country) values (uid, left(trim(p_note), 500), public.request_country());
  end if;
  update public.account_residency set status = 'review', checked_at = now() where user_id = uid and status = 'not_resident';
end;
$$;

-- Moderators
create or replace function public.list_residency_reviews()
returns table (id uuid, user_id uuid, handle text, current_status text, declared_india boolean,
               signal_country text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.'; end if;
  return query
    select v.id, v.user_id, p.handle, r.status, r.declared_india, v.signal_country, v.note, v.created_at
    from public.residency_reviews v
    join public.profiles p on p.id = v.user_id
    left join public.account_residency r on r.user_id = v.user_id
    where v.status = 'pending'
    order by v.created_at;
end;
$$;

create or replace function public.review_residency(p_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare v public.residency_reviews%rowtype;
begin
  if not public.is_admin() then raise exception 'Only moderators can do that.'; end if;
  select * into v from public.residency_reviews where id = p_id and status = 'pending' for update;
  if not found then raise exception 'That request was already reviewed.'; end if;
  if v.user_id = (select auth.uid()) then raise exception 'Another moderator must review your own request.'; end if;
  update public.account_residency
    set status = case when p_approve then 'resident' else 'not_resident' end,
        method = case when p_approve then 'review_approved' else 'review_rejected' end,
        checked_at = now()
    where user_id = v.user_id;
  if not p_approve then perform public.restrict_ineligible(v.user_id); end if;
  update public.residency_reviews
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_at = now(), reviewed_by = (select auth.uid()), reviewer_note = left(coalesce(p_note, ''), 300)
    where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. BOTH CONDITIONS: 18+ AND resident of India
-- ---------------------------------------------------------------------------
create or replace function public.is_resident(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.account_residency r where r.user_id = p_user and r.status in ('resident', 'operator'));
$$;

create or replace function public.can_participate()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and exists (select 1 from public.account_age a where a.user_id = (select auth.uid()) and a.status in ('adult', 'operator'))
     and public.is_resident((select auth.uid()))
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and not p.banned)
     and public.has_current_consent((select auth.uid()));
$$;

-- Content is shown to others only from adults who are residents of India (or team demo accounts).
create or replace function public.is_eligible_author(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.account_age a where a.user_id = p_user and a.status in ('adult', 'operator'))
     and exists (select 1 from public.account_residency r where r.user_id = p_user and r.status in ('resident', 'operator'));
$$;

-- ---------------------------------------------------------------------------
-- 4. PHONE SIGN-IN (not enabled today): only Indian +91 mobile numbers, at the database.
-- Supabase stores phone numbers without "+", e.g. 919876543210.
-- ---------------------------------------------------------------------------
create or replace function public.india_phone_only()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.phone is not null and new.phone <> ''
     and regexp_replace(new.phone, '\D', '', 'g') !~ '^91[6-9][0-9]{9}$' then
    raise exception 'Nativity is currently available only to residents of India. Use an Indian (+91) mobile number.';
  end if;
  return new;
end;
$$;
drop trigger if exists india_phone_only on auth.users;
create trigger india_phone_only before insert or update of phone on auth.users
  for each row execute function public.india_phone_only();

-- ---------------------------------------------------------------------------
-- 5. EXISTING ACCOUNTS
-- No one is assumed to live in India. Real accounts must confirm residency before they
-- can post again, and their content is hidden from others until they do.
-- The five fictional seed personas (seed.sql, @demo.invalid) are team accounts.
-- ---------------------------------------------------------------------------
insert into public.account_residency (user_id, status, declared_india, signal_country, method)
select u.id, 'operator', null, null, 'operator_attested'
from auth.users u
where u.id in ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002',
               '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004',
               '00000000-0000-4000-a000-000000000005')
  and u.email like '%@demo.invalid'
on conflict (user_id) do nothing;

-- New Terms and Privacy Policy (v3) mention residency: everyone accepts again before posting.
insert into public.policy_versions (doc, version) values ('terms', 'v3'), ('privacy', 'v3')
on conflict (doc) do update set version = excluded.version, published_at = now()
  where public.policy_versions.version is distinct from excluded.version;

-- ---------------------------------------------------------------------------
-- 6. ACCOUNT STATE (adds residency) and RETENTION (adds non-residents)
-- ---------------------------------------------------------------------------
create or replace function public.my_account_state()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'age_status', (select a.status from public.account_age a where a.user_id = (select auth.uid())),
    'birth_date', (select a.birth_date from public.account_age a where a.user_id = (select auth.uid())),
    'residency_status', (select r.status from public.account_residency r where r.user_id = (select auth.uid())),
    'residency_signal', (select r.signal_country from public.account_residency r where r.user_id = (select auth.uid())),
    'residency_review', (select jsonb_build_object('status', v.status, 'note', v.reviewer_note, 'created_at', v.created_at)
        from public.residency_reviews v where v.user_id = (select auth.uid()) order by v.created_at desc limit 1),
    'connection_country', public.request_country(),
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

-- Keep a residency outcome in the 180-day registration record too.
alter table compliance.deleted_accounts add column if not exists residency_status text;
create or replace function compliance.archive_account(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into compliance.deleted_accounts (user_id, email, handle, account_created_at, age_status, residency_status, reason)
  select u.id, u.email, p.handle, u.created_at, a.status, r.status, p_reason
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.account_age a on a.user_id = u.id
  left join public.account_residency r on r.user_id = u.id
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

-- Accounts that can't be used (under 18, or recorded as living outside India) and uploaded
-- nothing are removed 30 days after the outcome. Pending reviews are left alone.
create or replace function compliance.run_retention()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a int; b int; c int; d int;
begin
  delete from compliance.deleted_accounts where purge_after < now(); get diagnostics a = row_count;
  delete from compliance.preserved_content where purge_after < now(); get diagnostics b = row_count;
  delete from auth.users where is_anonymous and created_at < now() - interval '90 days'; get diagnostics c = row_count;

  create temp table if not exists gone_users (user_id uuid, reason text) on commit drop;
  truncate gone_users;
  insert into gone_users
    select a.user_id, 'under_18' from public.account_age a
    where a.status = 'ineligible' and a.checked_at < now() - interval '30 days'
    union
    select r.user_id, 'outside_india' from public.account_residency r
    where r.status = 'not_resident' and r.checked_at < now() - interval '30 days'
      and not exists (select 1 from public.residency_reviews v where v.user_id = r.user_id and v.status = 'pending');
  delete from gone_users gu where exists (select 1 from public.games g where g.creator_id = gu.user_id and g.builtin_key is null);
  select count(*) into d from gone_users;
  perform compliance.archive_account(user_id, reason) from gone_users;
  delete from auth.users where id in (select user_id from gone_users);
  return jsonb_build_object('deleted_account_records', a, 'preserved_content', b, 'guests', c, 'ineligible_accounts', d);
end;
$$;
revoke all on function compliance.run_retention() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. REPORT REASON for accounts that don't seem to be in India? Not added: residency
--    is checked at sign-up; "Something else" covers it.
-- 8. FUNCTION PERMISSIONS
-- ---------------------------------------------------------------------------
revoke all on function public.request_country() from public, anon;
grant execute on function public.request_country() to authenticated;
revoke all on function public.confirm_residency(boolean, text) from public, anon;
grant execute on function public.confirm_residency(boolean, text) to authenticated;
revoke all on function public.request_residency_review(text) from public, anon;
grant execute on function public.request_residency_review(text) to authenticated;
revoke all on function public.list_residency_reviews() from public, anon;
grant execute on function public.list_residency_reviews() to authenticated;
revoke all on function public.review_residency(uuid, boolean, text) from public, anon;
grant execute on function public.review_residency(uuid, boolean, text) to authenticated;
grant execute on function public.is_resident(uuid) to anon, authenticated;
revoke all on function public.india_phone_only() from public, anon, authenticated;
