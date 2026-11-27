-- Tests for 0009_india_only.sql (run AFTER 0008 and 0009). Runs inside ONE block that
-- ends with an error on purpose, so all test data is rolled back. Results are in the
-- error message: "NATIVITY INDIA TESTS: N passed, 0 failed".
--
-- The connection country is simulated with request.headers, exactly where the API
-- puts Cloudflare's cf-ipcountry header for real requests.

do $$
declare
  game constant uuid := '10000000-0000-4000-a000-000000000001';
  u_home    constant uuid := 'dddddddd-0000-4000-a000-000000000001';  -- Indian resident, in India
  u_travel  constant uuid := 'dddddddd-0000-4000-a000-000000000002';  -- Indian resident, abroad
  u_visitor constant uuid := 'dddddddd-0000-4000-a000-000000000003';  -- non-resident, in India
  u_abroad  constant uuid := 'dddddddd-0000-4000-a000-000000000004';  -- non-resident, abroad
  u_vpn     constant uuid := 'dddddddd-0000-4000-a000-000000000005';  -- VPN / unknown country
  u_hacker  constant uuid := 'dddddddd-0000-4000-a000-000000000006';  -- tries API tricks
  u_old     constant uuid := 'dddddddd-0000-4000-a000-000000000007';  -- existing account, no residency
  admin_id uuid;
  review_id uuid;
  r text; n int; ok boolean; msg text;
  lines text[] := '{}';
  passed int; failed int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, is_anonymous)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.email, json_build_object('handle', x.h)::jsonb, now(), now(), false
  from (values (u_home, 'home@test.invalid', 't_home'), (u_travel, 'travel@test.invalid', 't_travel'),
               (u_visitor, 'visitor@test.invalid', 't_visitor'), (u_abroad, 'abroad@test.invalid', 't_abroad'),
               (u_vpn, 'vpn@test.invalid', 't_vpn'), (u_hacker, 'hacker@test.invalid', 't_hacker'),
               (u_old, 'old@test.invalid', 't_old')) as x(id, email, h);
  -- Everyone is an adult who accepted the current terms, so only residency differs.
  insert into public.account_age (user_id, status, birth_date, method)
  select id, 'adult', '1995-05-05', 'self_declared_dob' from auth.users where id::text like 'dddddddd-%';
  insert into public.policy_acceptances (user_id, doc, version)
  select u.id, pv.doc, pv.version from auth.users u cross join public.policy_versions pv where u.id::text like 'dddddddd-%';
  -- The existing account posted a note before this migration.
  insert into public.comments (id, game_id, user_id, body) values ('eeeeeeee-0000-4000-a000-000000000001', game, u_old, 'old note');

  -- 1. Indian resident registering from India
  perform set_config('request.jwt.claims', json_build_object('sub', u_home, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.headers', '{"cf-ipcountry":"IN"}', true);
  set local role authenticated;
  r := public.confirm_residency(true);
  lines := lines || format('%s  1. resident in India is approved  (%s)', case when r = 'resident' then 'PASS' else 'FAIL' end, r);
  begin insert into public.likes (user_id, game_id) values (u_home, game); ok := true; msg := 'cheered';
  exception when others then ok := false; msg := sqlerrm; end;
  lines := lines || format('%s  1. ...and can cheer (18+ AND resident)  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  -- Later travel doesn't take residency away
  perform set_config('request.headers', '{"cf-ipcountry":"GB"}', true);
  begin insert into public.comments (game_id, user_id, body) values (game, u_home, 'posting from a trip'); ok := true; msg := 'posted while abroad';
  exception when others then ok := false; msg := sqlerrm; end;
  lines := lines || format('%s  1. ...and can still post later while travelling  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;

  -- 2. Indian resident travelling outside India
  perform set_config('request.jwt.claims', json_build_object('sub', u_travel, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.headers', '{"cf-ipcountry":"AE"}', true);
  set local role authenticated;
  r := public.confirm_residency(true, 'I live in Pune, on a work trip to Dubai');
  lines := lines || format('%s  2. resident abroad goes to review, not rejected  (%s)', case when r = 'review' then 'PASS' else 'FAIL' end, r);
  begin insert into public.likes (user_id, game_id) values (u_travel, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  2. ...can''t post while waiting  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  perform set_config('request.headers', '{"cf-ipcountry":"IN"}', true);
  r := public.confirm_residency(true);
  lines := lines || format('%s  2. ...checking again from India approves it  (%s)', case when r = 'resident' then 'PASS' else 'FAIL' end, r);
  select count(*) into n from public.residency_reviews where user_id = u_travel and status = 'approved';
  lines := lines || format('%s  2. ...and closes the pending review  (%s approved)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  reset role;

  -- 3. Non-Indian resident attempting registration from India
  perform set_config('request.jwt.claims', json_build_object('sub', u_visitor, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.headers', '{"cf-ipcountry":"IN"}', true);
  set local role authenticated;
  r := public.confirm_residency(false);
  lines := lines || format('%s  3. non-resident in India is refused (Indian IP is not residency)  (%s)', case when r = 'not_resident' then 'PASS' else 'FAIL' end, r);
  begin insert into public.likes (user_id, game_id) values (u_visitor, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  3. ...and cannot post  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.confirm_residency(true); ok := false; msg := 'switched to resident';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  3. ...and cannot just change the answer  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;

  -- 4. Non-Indian resident registering from outside India
  perform set_config('request.jwt.claims', json_build_object('sub', u_abroad, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.headers', '{"cf-ipcountry":"US"}', true);
  set local role authenticated;
  r := public.confirm_residency(false);
  lines := lines || format('%s  4. non-resident abroad is refused  (%s)', case when r = 'not_resident' then 'PASS' else 'FAIL' end, r);
  select count(*) into n from public.account_residency where user_id = u_abroad and signal_country = 'US' and status = 'not_resident';
  lines := lines || format('%s  4. ...only the country code is kept, no IP  (%s rows)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin perform public.request_residency_review('Actually I moved to Chennai last month'); ok := true; msg := 'review requested';
  exception when others then ok := false; msg := sqlerrm; end;
  lines := lines || format('%s  4. ...can ask a person to review it  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  select count(*) into n from public.account_residency where user_id = u_abroad and status = 'review';
  lines := lines || format('%s  4. ...which doesn''t approve anything by itself  (%s in review)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  reset role;

  -- 5. VPN or unknown location
  perform set_config('request.jwt.claims', json_build_object('sub', u_vpn, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.headers', '{"cf-ipcountry":"XX"}', true);
  set local role authenticated;
  r := public.confirm_residency(true);
  lines := lines || format('%s  5. unknown country (VPN/bad geo-IP) goes to review  (%s)', case when r = 'review' then 'PASS' else 'FAIL' end, r);
  perform set_config('request.headers', '{"cf-ipcountry":"T1"}', true);
  r := public.confirm_residency(true);
  lines := lines || format('%s  5. Tor exit stays in review  (%s)', case when r = 'review' then 'PASS' else 'FAIL' end, r);
  select count(*) into n from public.residency_reviews where user_id = u_vpn and status = 'pending';
  lines := lines || format('%s  5. ...only one pending review per person  (%s)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  reset role;

  -- 6. API manipulation
  perform set_config('request.jwt.claims', json_build_object('sub', u_hacker, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('request.headers', '{"cf-ipcountry":"US"}', true);
  set local role authenticated;
  begin insert into public.account_residency (user_id, status, declared_india, method) values (u_hacker, 'resident', true, 'declared_signal_match'); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  6. cannot write own residency record  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin insert into public.likes (user_id, game_id) values (u_hacker, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  6. cannot post without residency (direct API call)  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform * from public.list_residency_reviews(); ok := false; msg := 'listed';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  6. cannot see the review queue  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin perform public.review_residency(gen_random_uuid(), true, ''); ok := false; msg := 'approved';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  6. cannot approve reviews  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin insert into storage.objects (bucket_id, name, owner) values ('games', u_hacker || '/x/index.html', u_hacker); ok := false; msg := 'upload row inserted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  6. cannot upload without residency  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;
  -- Phone sign-up with a non-Indian number is refused at the database (any auth method)
  begin update auth.users set phone = '14155550123' where id = u_hacker; ok := false; msg := 'US number accepted';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  6. non-+91 phone number refused  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  begin update auth.users set phone = '919876543210' where id = u_hacker; ok := true; msg := '+91 accepted';
  exception when others then ok := false; msg := sqlerrm; end;
  lines := lines || format('%s  6. +91 mobile number accepted  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);

  -- 7. Existing account with no residency information
  perform set_config('request.jwt.claims', json_build_object('sub', u_old, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  begin insert into public.likes (user_id, game_id) values (u_old, game); ok := false; msg := 'insert succeeded';
  exception when others then ok := true; msg := sqlerrm; end;
  lines := lines || format('%s  7. existing account can''t post until residency is confirmed  (%s)', case when ok then 'PASS' else 'FAIL' end, msg);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_home, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
  select count(*) into n from public.comments where id = 'eeeeeeee-0000-4000-a000-000000000001';
  lines := lines || format('%s  7. ...and its old notes are hidden from others  (%s visible)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.account_residency where user_id <> u_home;
  lines := lines || format('%s  privacy: can''t read anyone else''s residency  (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  reset role;

  -- Moderator approval (needs an admin account; skipped if there isn't one)
  select id into admin_id from public.profiles where role = 'admin' and not banned limit 1;
  if admin_id is not null then
    select id into review_id from public.residency_reviews where user_id = u_vpn and status = 'pending';
    perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    set local role authenticated;
    select count(*) into n from public.list_residency_reviews() q where q.user_id = u_vpn;
    lines := lines || format('%s  moderator sees the traveller in the review queue  (%s)', case when n = 1 then 'PASS' else 'FAIL' end, n);
    perform public.review_residency(review_id, true, 'Confirmed by email');
    reset role;
    select count(*) into n from public.account_residency where user_id = u_vpn and status = 'resident' and method = 'review_approved';
    lines := lines || format('%s  moderator approval makes the traveller a resident  (%s)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  end if;

  select count(*) filter (where l like 'PASS%'), count(*) filter (where l like 'FAIL%') into passed, failed from unnest(lines) as l;
  raise exception '%', format(E'NATIVITY INDIA TESTS: %s passed, %s failed (all test data rolled back)\n%s',
    passed, failed, array_to_string(lines, E'\n'));
end $$;
