# Nativity

Swipe through tiny HTML games like reels. Every new creator's game gets its first 100 views guaranteed.

Phases 1–4 are done: real accounts, likes, comments, follows, views, feedback and scores, plus **creator uploads** (a zip of the game + a trailer video), with every uploaded game running in a sandbox.
Creators: see [CREATORS.md](CREATORS.md) for how to prepare a game.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```powershell
npm install
npm run dev
```

Open http://localhost:5173. To try it on your phone, run `npm run dev -- --host` and open the "Network" address it prints, with your phone on the same Wi-Fi.

With no `.env` file the app runs in **demo mode**: everything works, but data is saved only in that browser. A small "Demo mode" label shows on wide screens.

## Connect the real database (Supabase)

1. Create a free account and a new project at [supabase.com](https://supabase.com). Choose a region close to your players and save the database password somewhere safe.
2. In the project, open **SQL Editor → New query**. Paste all of `supabase/migrations/0001_init.sql` and click **Run**.
3. Open another new query, paste `supabase/migrations/0002_grants.sql` and click **Run**. This gives the app permission to use the tables (the security rules still decide which rows).
4. Open another new query, paste `supabase/migrations/0003_uploads.sql` and click **Run**. This creates the storage for uploaded games and trailers, with rules so creators can only write to their own folder.
5. Open **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**. Visitors who haven't signed in get an invisible guest account, so their views count toward each game's boost.
6. Open another new query, paste `supabase/migrations/0004_feed.sql` and click **Run**. This adds the ranked feed, play tracking and spam limits.
7. Open another new query, paste `supabase/migrations/0005_feed_fix.sql` and click **Run**.
8. Open another new query, paste `supabase/migrations/0006_safety.sql` and click **Run**. This adds reports, blocking, moderation and terms acceptance.
9. Make yourself a moderator: run `update public.profiles set role = 'admin' where handle = 'your-handle';` with your own handle. A **Open moderation** button then appears in your Profile.
10. Open another new query, paste `supabase/seed.sql` and click **Run**. This adds the 5 demo games and fictional creators.
11. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
12. In this folder, copy `.env.example` to `.env` and paste the two values:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
13. Open **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (change it to your real domain when you deploy)
   - **Redirect URLs**: add `http://localhost:5173` and, later, your real domain
14. Restart `npm run dev`. The demo label disappears and sign-in sends a real email link.

### Optional: Google sign-in
In **Authentication → Providers → Google**, follow Supabase's steps to create a Google OAuth client and paste its ID and secret. The "Continue with Google" button works once that's done.

### Email limits
Supabase's built-in email sender only allows a few sign-in emails per hour. That's fine for testing. Before a public beta, connect your own email provider in **Authentication → Emails → SMTP settings** (for example Resend or Brevo, both have free tiers).

## How the code is organised

```
supabase/
  migrations/0001_init.sql   Tables, security rules (RLS), the game_feed view, auto-profile trigger
  seed.sql                   Demo creators, games and comments
src/
  main.jsx                   Starts React, registers the service worker (installable app)
  App.jsx                    The whole app's state: user, feed, which sheet is open, the player
  lib/
    supabase.js              Creates the Supabase client from .env (or switches to demo mode)
    api.js                   The ONE import the UI uses for data. Picks live or demo backend
    uploads.js               Checks a game zip and trailer on the phone before uploading
    supabaseApi.js           Real backend: every database call lives here
    demoApi.js               Same functions, saved in localStorage
  games/
    engine.js                Runs a game on a canvas: trailer mode (AI plays) or play mode
    builtin.js               The 5 demo games
  components/
    Feed.jsx                 The swipe feed, trailers, double-tap like, swipe-left to play
    Player.jsx               Full-screen play mode, score, feedback chips
    FrameGame.jsx            Runs an uploaded game inside a locked-down sandbox frame
    CommentsSheet.jsx        Read and post comments
    AuthSheet.jsx            Sign in with an email link or Google
    ProfileSheet.jsx         Edit handle/name/bio, your stats, who you follow
    UploadSheet.jsx          Upload a game: checks the zip and trailer, shows progress
    Sheet.jsx, Icons.jsx     Shared pieces
public/
  manifest.webmanifest, sw.js, icons   Make it installable ("Add to Home screen")
```

## Security model (important)

The browser talks to the database directly using the public anon key. That's normal for Supabase, and it's safe **only because Row Level Security is on for every table**. The policies in `0001_init.sql` decide who may read or change each row. For example, you can only delete your own likes, and only you and the game's creator can read your feedback.

- Never put the `service_role` key in this app or in `.env`. It bypasses all security.
- When you add a new table, always add `enable row level security` and policies for it.

## Deploying (when you're ready)

Push to GitHub, import the repo in [Vercel](https://vercel.com) or Cloudflare Pages, and add the two `VITE_SUPABASE_*` variables in the host's settings. Then add the live URL to Supabase's Site URL and Redirect URLs.

## How the feed is ordered

`ranked_feed()` in `supabase/migrations/0004_feed.sql` decides the order:

- **For You:** every 3rd game is a *boosted* game (fewer than 100 views, fewest first), so new creators always get seen. The other slots are ranked by engagement: how often viewers tap Play (50%), like (25%), replay (15%) and mark it "Fun" (10%), with a gentle boost for newer games. Games you've already seen go to the end.
- **Fresh:** all boosted games first, fewest views first.
- **Following:** newest games from people you follow.

A view counts once per person, and only after the trailer has been on screen for 3 seconds.

## Safety and moderation

- Every game and comment has a **⋯** menu with **Report** and **Block**. Reports go to moderators only.
- If 3 different people report the same game or comment, it's hidden automatically until a moderator decides.
- Moderators (profiles with `role = 'admin'`) get a moderation screen: hide or restore content, dismiss reports, suspend or unsuspend accounts. The database checks the role, so the screen can't be abused by others.
- Suspended accounts can still play but can't post, comment, like, follow, report or upload.
- Nativity is for adults 18+. Visitors confirm they're 18+ before any guest ID is created; members confirm their date of birth once after signing in, checked on the server (`0008_adults_only.sql`). See `docs/LEGAL-COMPLIANCE.md`.
- The Terms and Privacy Policy are plain-language drafts in `src/content/legal.js`. Put your contact email in `CONTACT_EMAIL` and have a lawyer review them before a public launch.

## Roadmap

- **Phase 1:** accounts, database, social features ✅
- **Phase 2:** creator uploads (zip + trailer), storage, sandboxed games ✅
- **Phase 3:** ranked feed with the new-creator boost, 3-second views, guest views, spam limits ✅
- **Phase 4:** reports with auto-hide, blocking, moderation screen, suspensions, terms and privacy policy ✅
- **Phase 6:** strictly 18+ with server-side date-of-birth checks, consent records, date-of-birth corrections, data download, retention rules and Indian-law Terms and Privacy Policy ✅ (see `docs/LEGAL-COMPLIANCE.md`; items marked "Requires legal review" need a lawyer)
- **Phase 5:** closed beta with seeded games
