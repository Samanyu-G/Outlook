-- Nativity: demo content so the feed isn't empty on day one.
-- Run AFTER 0001_init.sql, in the same SQL Editor. Safe to skip in production.
--
-- These are fictional creators. They are inserted as auth users that can never
-- sign in (no password, fake .invalid emails), and the sign-up trigger turns
-- each one into a profile using the metadata below.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mira@demo.invalid',
   '{"handle":"mira.makes","full_name":"Mira Osei","avatar_color":"#f4b6a0"}', now(), now()),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'arjun@demo.invalid',
   '{"handle":"arjun.devs","full_name":"Arjun Nair","avatar_color":"#b9cde6"}', now(), now()),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lena@demo.invalid',
   '{"handle":"lena.codes","full_name":"Lena Brandt","avatar_color":"#b7d3c0"}', now(), now()),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tomas@demo.invalid',
   '{"handle":"tomas.pixel","full_name":"Tomás Rivera","avatar_color":"#f2d98d"}', now(), now()),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kofi@demo.invalid',
   '{"handle":"kofi.builds","full_name":"Kofi Mensah","avatar_color":"#e7b3c0"}', now(), now());

update public.profiles set bio = 'Art student learning JavaScript'      where handle = 'mira.makes';
update public.profiles set bio = 'Class 11 · making one game a month'    where handle = 'arjun.devs';
update public.profiles set bio = 'Just uploaded my first game'           where handle = 'lena.codes';
update public.profiles set bio = 'Hobby dev · retro stuff'               where handle = 'tomas.pixel';
update public.profiles set bio = 'Weekend game jams'                     where handle = 'kofi.builds';

insert into public.games (id, creator_id, title, description, tags, builtin_key, created_at) values
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'Kite Hop',
   'My first ever game! Tap to lift the kite between the towers. Built over three weekends.', '{onetap,arcade,firstgame}', 'kite', now() - interval '2 days'),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', 'Meteor Drift',
   'Drag to steer your ship through a meteor shower. It gets faster every 12 seconds.', '{drag,space,survival}', 'meteor', now() - interval '3 days'),
  ('10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000003', 'Pop Rush',
   'Pop the bubbles before they shrink away. Miss three and it is over.', '{tap,reflex,casual}', 'pop', now() - interval '5 hours'),
  ('10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000004', 'Brick Bounce',
   'Classic brick-breaking with a neon grid. Hit the edge of the paddle to aim.', '{drag,retro,arcade}', 'brick', now() - interval '3 weeks'),
  ('10000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000005', 'Stack Up',
   'Tap to drop each block. Whatever hangs over the edge gets sliced off. How high can you go?', '{onetap,timing,tower}', 'stack', now() - interval '1 day');

insert into public.comments (game_id, user_id, body, created_at) values
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'The tail wobble is so satisfying. Maybe slightly bigger gaps at the start?', now() - interval '3 hours'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005', 'Sunset colours are lovely. Got 14 on my third try.', now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'Thank you!! Making the first few gaps wider in the next update.', now() - interval '20 hours'),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003', 'Hard in a good way. Speed ramp feels fair.', now() - interval '5 hours'),
  ('10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001', 'Welcome! The ring timer around each bubble is a smart touch.', now() - interval '40 minutes'),
  ('10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000005', 'Aiming with the paddle edge is really well tuned.', now() - interval '6 hours'),
  ('10000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000003', 'The perfect-drop flash made me so happy.', now() - interval '2 hours');

insert into public.follows (follower_id, creator_id) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000001');

insert into public.likes (user_id, game_id) values
  ('00000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000004');
