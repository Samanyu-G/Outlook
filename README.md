# Outlook

Swipe through tiny HTML games like reels. Every new creator's game gets its first 100 views guaranteed.

This is **Phase 1**: real accounts, real database, real likes, comments, follows, views, feedback and scores.
The 5 games are still built into the app; creator uploads come in Phase 2.

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
4. Open another new query, paste `supabase/seed.sql` and click **Run**. This adds the 5 demo games and fictional creators.
5. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
6. In this folder, copy `.env.example` to `.env` and paste the two values:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
7. Open **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (change it to your real domain when you deploy)
   - **Redirect URLs**: add `http://localhost:5173` and, later, your real domain
8. Restart `npm run dev`. The demo label disappears and sign-in sends a real email link.

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
    supabaseApi.js           Real backend: every database call lives here
    demoApi.js               Same functions, saved in localStorage
  games/
    engine.js                Runs a game on a canvas: trailer mode (AI plays) or play mode
    builtin.js               The 5 demo games
  components/
    Feed.jsx                 The swipe feed, trailers, double-tap like, swipe-left to play
    Player.jsx               Full-screen play mode, score, feedback chips
    CommentsSheet.jsx        Read and post comments
    AuthSheet.jsx            Sign in with an email link or Google
    ProfileSheet.jsx         Edit handle/name/bio, your stats, who you follow
    UploadSheet.jsx          Preview of the Phase 2 upload form
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

## Roadmap

- **Phase 1 (this):** accounts, database, social features ✅
- **Phase 2:** creator uploads (zip + trailer), storage, sandboxed game hosting on a separate domain
- **Phase 3:** the real feed algorithm, fair view counting, abuse limits
- **Phase 4:** reporting, moderation, terms and privacy policy
- **Phase 5:** closed beta with seeded games
