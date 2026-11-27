-- Tests for 0008_adults_only.sql. Run AFTER the migrations (0008 and 0009), in Supabase SQL Editor.
--
-- Everything runs inside ONE block that ends by raising an error on purpose.
-- That error rolls the whole thing back, so the test accounts and their actions
-- are never saved. Read the results in the error message:
--   "NATIVITY 18+ TESTS: 29 passed, 0 failed" followed by one line per check.

do $$
declare
  game   constant uuid := '10000000-0000-4000-a000-000000000001';
  guest  constant uuid := 'aaaaaaaa-0000-4000-a000-000000000001';
  unconf constant uuid := 'aaaaaaaa-0000-4000-a000-000000000002';
  adult  constant uuid := 'aaaaaaaa-0000-4000-a000-000000000003';
  minor  constant uuid := 'aaaaaaaa-0000-4000-a000-000000000004';
  viewer constant uuid := 'aaaaaaaa-0000-4000-a000-000000000005';
  today date := public.today_ist();
  r text; n int; ok boolean; msg text;
  lines text[] := '{}';
  passed int; failed int;
begin
  -- Test accounts: a guest, a member who hasn't confirmed anything, a future adult,
  -- a future under-18 and a second adult (the "other person" who looks at content).
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, is_anonymous) values
    (guest,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '{}', now(), now(), true),
    (unconf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-unconfirmed@test.invalid', '{"handle":"t_unconfirmed"}', now(), now(), false),
    (adult,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-adult@test.invalid', '{"handle":"t_adult"}', now(), now(), false),
    (minor,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-minor@test.invalid', '{"handle":"t_minor"}', now(), now(), false),
    (viewer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-viewer@test.invalid', '{"handle":"t_viewer"}', now(), now(), false);
  -- A note and a game by the unconfirmed member (as if posted before this migration).
  insert into public.comments (id, game_id, user_id, body) values
    ('bbbbbbbb-0000-4000-a000-000000000001', game, unconf, 'old note from an unconfirmed account');
  insert into public.games (id, creator_id, title, builtin_key, status) values
    ('cccccccc-0000-4000-a000-000000000001', unconf, 'Unconfirmed game', 'kite', 'published');
  -- These tests are about age, so the adult and the minor are already confirmed Indian
  -- residents (0009). Residency itself is tested in 0009_india_only_test.sql.
  insert into public.account_residency (user_id, status, declared_india, signal_country, method)
  values (adult, 'resident', true, 'IN', 'declared_signal_match'), (minor, 'resident', true, 'IN', 'declared_signal_match');

  -- 1-2. Guest
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  set local role authenticated;
  begin insert into public.likes (user_id, game_id) values (guest, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  guest cannot cheer  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.confirm_birth_date('1990-01-01'); ok := false; msg := 'allowed';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  guest cannot set a date of birth  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;

  -- 3-8. Signed-in member with no age record
  perform set_config('request.jwt.claims', json_build_object('sub', unconf, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin insert into public.likes (user_id, game_id) values (unconf, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  unconfirmed member cannot cheer  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin insert into public.comments (game_id, user_id, body) values (game, unconf, 'hello there'); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  unconfirmed member cannot comment  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  update public.profiles set bio = 'changed' where id = unconf; get diagnostics n = row_count;
  lines := lines || format('%s  unconfirmed member cannot edit profile  (%s rows changed)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  begin insert into storage.objects (bucket_id, name, owner) values ('games', unconf || '/x/index.html', unconf); ok := false; msg := 'upload row inserted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  unconfirmed member cannot upload  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin insert into public.account_age (user_id, status, birth_date, method) values (unconf, 'adult', '1990-01-01', 'self_declared_dob'); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  cannot write own age record directly  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.accept_policies('v1', 'v1'); ok := false; msg := 'old version accepted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  cannot accept an outdated policy version  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;

  -- 9-10. Content from the unconfirmed account is hidden from other people
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  select count(*) into n from public.comments where id = 'bbbbbbbb-0000-4000-a000-000000000001';
  lines := lines || format('%s  unconfirmed author''s note hidden from others  (%s visible)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.game_feed where id = 'cccccccc-0000-4000-a000-000000000001';
  lines := lines || format('%s  unconfirmed author''s game not in feed  (%s visible)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  reset role;

  -- 11-19. Adult
  perform set_config('request.jwt.claims', json_build_object('sub', adult, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin perform public.confirm_birth_date(today + 1); ok := false; msg := 'future date accepted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  future date rejected  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.confirm_birth_date('1899-12-31'); ok := false; msg := '1899 accepted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  implausible date rejected  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  r := public.confirm_birth_date((today - interval '18 years')::date);
  lines := lines || format('%s  18th birthday today counts as adult  (%s)', case when r = 'adult' then 'PASS' else 'FAIL' end, r);
  begin perform public.confirm_birth_date('1980-01-01'); ok := false; msg := 'changed';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  date of birth cannot be changed freely  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin insert into public.likes (user_id, game_id) values (adult, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  adult blocked until policies accepted  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  perform public.accept_policies((select version from public.policy_versions where doc = 'terms'), (select version from public.policy_versions where doc = 'privacy'));
  begin insert into public.likes (user_id, game_id) values (adult, game); ok := true; msg := 'cheered';
  exception when others then ok := false; msg := sqlerrm; end;
  lines := lines || format('%s  adult with consent can cheer  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  select count(*) into n from public.policy_acceptances where user_id = adult and version = (select version from public.policy_versions where doc = 'terms') and accepted_at is not null;
  lines := lines || format('%s  consent recorded with version and time  (%s rows)', case when n = 2 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.account_age where user_id <> adult;
  lines := lines || format('%s  cannot read other people''s age records  (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  begin perform * from public.list_birth_date_corrections(); ok := false; msg := 'listed';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  non-moderator cannot list corrections  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;

  -- 20-25. One day short of 18
  perform set_config('request.jwt.claims', json_build_object('sub', minor, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  perform public.accept_policies((select version from public.policy_versions where doc = 'terms'), (select version from public.policy_versions where doc = 'privacy'));
  r := public.confirm_birth_date((today - interval '18 years')::date + 1);
  lines := lines || format('%s  one day before 18th birthday is ineligible  (%s)', case when r = 'ineligible' then 'PASS' else 'FAIL' end, r);
  select count(*) into n from public.account_age where user_id = minor and birth_date is null and status = 'ineligible';
  lines := lines || format('%s  under-18 birth date not stored  (%s rows)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin insert into public.likes (user_id, game_id) values (minor, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  under-18 account cannot cheer  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.confirm_birth_date('1990-01-01'); ok := false; msg := 'retry accepted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  under-18 cannot retry with another date  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.request_birth_date_correction('1990-01-01', 'I typed the wrong year by mistake'); ok := true; msg := 'request filed';
  exception when others then ok := false; msg := sqlerrm; end;
  lines := lines || format('%s  correction request goes to review  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  select count(*) into n from public.account_age where user_id = minor and status = 'ineligible';
  lines := lines || format('%s  correction request changes nothing by itself  (%s rows)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  reset role;

  -- 26-28. Account deletion keeps a minimal registration record for 180 days
  perform set_config('request.jwt.claims', json_build_object('sub', adult, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  perform public.delete_my_account();
  reset role;
  select count(*) into n from compliance.deleted_accounts where user_id = adult and purge_after > now() + interval '179 days';
  lines := lines || format('%s  deletion keeps 180-day registration record  (%s rows)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from auth.users where id = adult;
  lines := lines || format('%s  deleted account is gone  (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.likes where user_id = adult;
  lines := lines || format('%s  deleted account''s cheers removed  (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);

  -- 29. The compliance records are not reachable through the API roles
  set local role authenticated;
  begin perform 1 from compliance.deleted_accounts limit 1; ok := false; msg := 'readable';
  exception when others then ok := true; msg := sqlerrm; end;
  reset role;
  lines := lines || format('%s  compliance records hidden from the API  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);

  select count(*) filter (where l like 'PASS%'), count(*) filter (where l like 'FAIL%')
    into passed, failed from unnest(lines) as l;
  raise exception '%', format(E'NATIVITY 18+ TESTS: %s passed, %s failed (all test data rolled back)\n%s',
    passed, failed, array_to_string(lines, E'\n'));
end $$;
