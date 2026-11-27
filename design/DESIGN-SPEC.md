# Nativity — Design Specification

Editable source: **Figma › "Nativity — Design System & Screens"**
https://www.figma.com/design/4dqpKftyyv7yYsb4GX1Fy5

The file has six pages: Cover · Foundations · Icons · Components · Screens · Spec.

Every value below comes from that Figma file's variables and styles. If they disagree, Figma wins.

---

## 1. Principles

- **Mobile only.** The base canvas is 360 × 760 pt.
- **Calm, warm and neutral app shell.** Game art is never re-tinted. Trailers and games keep their own colours.
- **One loud action per screen.** That action is the coral PLAY button.
- **Unique vocabulary:**
  - Cheer: like
  - Talk: comments
  - Stamps: reaction tags
  - Shelves: saved games
  - Crew: following
  - Mailbox: notifications
  - Dock: bottom nav
  - Hub: home
  - Channel Tuner: feed tabs

---

## 2. Colour tokens

The colour collection has two modes:

- **Day** is the default.
- **Night** is used in the Player and anywhere the game should dominate.

Raw `palette/*` primitives are hidden from pickers. Components only use the semantic tokens below.

| Token | CSS | Day | Night |
|---|---|---|---|
| surface/page | `--nv-surface-page` | #F5EFE6 | #241E1A |
| surface/raised | `--nv-surface-raised` | #FFFAF3 | #2F2722 |
| surface/sunken | `--nv-surface-sunken` | #F0E7DB | #3A312A |
| border/subtle | `--nv-border-subtle` | #E2D8CB | #3A312A |
| text/primary | `--nv-text-primary` | #4A3F36 | #F7EFE6 |
| text/secondary | `--nv-text-secondary` | #6F6256 | #C9BBAB |
| text/disabled | `--nv-text-disabled` | #A99C8F | #A99C8F |
| text/inverse | `--nv-text-inverse` | #FFFAF3 | #241E1A |
| brand/primary (coral) | `--nv-brand-primary` | #E7A58C | #E7A58C |
| brand/primaryHover | `--nv-brand-primary-hover` | #ECB29C | #ECB29C |
| brand/primaryPressed | `--nv-brand-primary-pressed` | #DD957A | #DD957A |
| brand/primaryStrong | `--nv-brand-primary-strong` | #C9785C | #C9785C |
| brand/onPrimary | `--nv-brand-on-primary` | #3E2A21 | #3E2A21 |
| brand/link | `--nv-brand-link` | #9A5B42 | #E7A58C |
| brand/secondary (sage) | `--nv-brand-secondary` | #8FB39C | #8FB39C |
| brand/secondaryStrong | `--nv-brand-secondary-strong` | #4F7560 | #8FB39C |
| brand/onSecondary | `--nv-brand-on-secondary` | #2F4A3A | #2F4A3A |
| stamp/fun · funInk | `--nv-stamp-fun(-ink)` | #F2D98D · #6B4E14 | same |
| stamp/clever · cleverInk | `--nv-stamp-clever(-ink)` | #B9CDE6 · #2E4C70 | same |
| stamp/pretty · prettyInk | `--nv-stamp-pretty(-ink)` | #C9BDE3 · #4B3D78 | same |
| stamp/tough · toughInk | `--nv-stamp-tough(-ink)` | #E0899A · #3E2A21 | same |
| stamp/more · moreInk | `--nv-stamp-more(-ink)` | #B7D3C0 · #2F4A3A | same |
| feedback/danger | `--nv-feedback-danger` | #B4566A | #E0899A |
| feedback/dangerSoft | `--nv-feedback-danger-soft` | #F6DDE2 | #3A312A |
| feedback/success | `--nv-feedback-success` | #4F7560 | #8FB39C |

**Contrast rules:**

- Text on a coral fill always uses `brand/onPrimary`, never white.
- Each stamp's text uses its matching `*Ink` token.
- Body text pairs (`text/primary` and `text/secondary` on any surface) meet WCAG AA at 4.5:1.

---

## 3. Typography

There are three families, all from Google Fonts:

- **Bricolage Grotesque** for display and headings.
- **DM Sans** for UI and body text.
- **JetBrains Mono** for HUD, numbers and overlines.

| Style | Font | Size / line height | Tracking | Use |
|---|---|---|---|---|
| Display/XL | Bricolage ExtraBold | 56 / 60 | 0 | Cover, Press start |
| Heading/1 | Bricolage ExtraBold | 40 / 44 | 0 | Onboarding hero |
| Heading/2 | Bricolage Bold | 28 / 32 | 0 | Screen titles |
| Heading/3 | Bricolage Bold | 22 / 28 | 0 | Card and game titles |
| Title | Bricolage SemiBold | 18 / 24 | 0 | Section headers, sheets |
| Button/PLAY | Bricolage ExtraBold | 18 / 22 | +4% | PLAY button only |
| Body/Large | DM Sans Regular | 17 / 26 | 0 | Intro copy |
| Body/Default | DM Sans Regular | 15 / 22 | 0 | Descriptions, Talk notes |
| Body/Strong | DM Sans Bold | 15 / 22 | 0 | Handles, emphasis |
| Label | DM Sans SemiBold | 14 / 20 | 0 | Buttons, fields, rows |
| Caption | DM Sans Medium | 12 / 16 | 0 | Meta, Dock labels |
| Overline | JetBrains Mono Bold | 11 / 14 | +12%, UPPERCASE | Eyebrows, badges |
| HUD/Large | JetBrains Mono Bold | 20 / 24 | 0 | Score in Player |
| HUD/Small | JetBrains Mono Medium | 13 / 16 | 0 | Counts, timers |

**Type rules:**

- Minimum text size is 12.
- Never centre body text longer than 2 lines.
- Descriptions collapse to one line with a "more" toggle.
- Follower counts are never shown.

---

## 4. Spacing, radius and elevation

**Spacing.** The scale is a 4-pt base. Variables are `space/N`.

| Token | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 14 |
|---|---|---|---|---|---|---|---|---|---|
| px | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 56 |

**Radius.** Variables are `radius/*`.

| Token | xs | sm | md | lg | xl | pill |
|---|---|---|---|---|---|---|
| px | 6 | 10 | 16 | 24 | 28 | 999 |

**Elevation.** These are effect styles. All shadows are drop shadows in #4A3A2E.

| Style | x / y / blur | Opacity | Use |
|---|---|---|---|
| Elevation/e1 Card | 0 / 2 / 8 | 8% | Cards, tiles |
| Elevation/e2 Dock | 0 / 10 / 30 | 16% | Floating Dock, toasts |
| Elevation/e3 Sheet | 0 / −12 / 40 | 18% | Bottom sheets |
| Elevation/PLAY glow | 0 / 6 / 16 | 18% | PLAY button |

---

## 5. Layout rules

- **Screen frame.** 360 × 760, vertical auto layout, in this order:
  1. Status Bar (38 tall)
  2. `Content` (auto layout, fills the remaining space)
  3. Dock, set to absolute position
- **Gutter.** 16 on both sides, so content is 328 wide. The Player is full-bleed.
- **Section gap.** 24 between sections. Use 12 inside a group and 8 between a label and its control.
- **Dock:**
  - Absolute position, horizontally centred, 20 from the bottom edge.
  - Width varies by mode and is at most 342. Height is 74, radius 28, with Elevation/e2.
  - Scrolling content needs 110 of bottom padding so nothing sits under the Dock.
- **Touch targets.** At least 48 × 48. Dock slots are 48 wide, Icon Buttons are 56, and the Close button is 40 visual inside a 48 hit area.
- **Cartridge Card.** 328 wide with a 312 × 410 trailer window. Card radius is 28 and the window radius is 20.
- **Grids:**
  - Shelves and Find use a 2-up grid of Cartridge Spines (120 × 156, gap 12).
  - Stat Tiles go 3-up (104 wide, gap 8).
- **Game area.** Games render inside a sandboxed frame. The app never draws over the play area except the Back Chip and the HUD in the top 56 pt.
- **Motion:**
  - Standard is 200 ms ease-out.
  - Sheets use 280 ms with cubic-bezier(.2,.8,.2,1).
  - The Cheer burst is 600 ms.
  - Honour `prefers-reduced-motion`: crossfade instead.
- **Responsive.** Below 340 wide, the Dock search field collapses to an icon. Above 430, centre the 360–430 column on `surface/page`.

---

## 6. Components

All of these live on the **Components** page. Every component uses auto layout, binds its fills and strokes to the tokens above, and exposes its properties in the right panel.

| Component | Variants | Key properties | Base size (w × h) | Layout |
|---|---|---|---|---|
| Button | Style (Primary, Secondary, Ghost, Danger) × State (Default, Hover, Pressed, Selected, Disabled, Loading) = 24 | Label (text), Show icon (bool), Icon (swap) | hug × 52 | H, pad 16/24, gap 8, r 16 |
| PLAY Button | 5 states | — | 140 × 56 | H, pad 4/20, gap 8, pill |
| Icon Button | 4 states | Label, Icon (swap) | 56 × 56 | V, gap 4, r 24 |
| Hub Button | — | — | 50 × 56 | V, r 24 |
| Stamp | Kind (Fun, Clever, Pretty, Tough, Want more) × State (Stamped, Chip, Unpicked, Disabled) = 20 | — | hug × 42 | H, pad 8/12, pill |
| Badge | Fresh maker, Level, Heating up, Touch, Keyboard | — | hug × 22 | H, pad 4/8, r 6 |
| Status Pill | 5 | — | hug × 28 | H, pad 4/12, pill |
| Tag | — | label | hug × 28 | H, pad 4/12, r 10 |
| Avatar | Size (24, 32, 48, 72) × Marker (None, Fresh, Crew) | Initials (text) | 24–72 square | circle |
| Status Bar | Theme (Day, Night) | — | 360 × 38 | H, pad 8/26 |
| Dock | 11 modes: Feed, Feed cheered, Player (Night), Browse, Profile, Make step, Studio, Maker, Mailbox, Ref desk, Onboarding | slot labels | ≤ 342 × 74 | H, pad 8, gap 4, r 28 |
| Channel Tuner | Active (For you, Fresh, Crew) | — | 270 × 48 | H, pad 4/5, gap 4, pill |
| Back Chip | — | Destination (text) | hug × 36 | H, pad 7/8, pill |
| Close Button | — | — | 40 × 40 | pill |
| Cartridge Card | — | Title, Description, Maker, Fresh maker (bool), Trailer (swap) | 328 × hug (≈552) | V, pad 8, gap 8, r 28 |
| Cartridge Spine | — | Title, Played, Trailer (swap) | 120 × 156 | V, pad 6, gap 6, r 16 |
| Cheer Meter | Size (Compact, Wide) | — | 70 × 8 | V |
| Maker Chip | Joined (No, Yes) | — | 328 × 58 | H, pad 8, gap 10, r 24 |
| Stat Tile | — | Value, Label | 104 × 58 | V, pad 8/12, r 16 |
| Talk Note | Type (Player, Maker) | Body, Handle | 328 × hug | V, pad 12, gap 6, r 16 |
| Text Field | 5 states (Default, Focus, Filled, Error, Disabled) | label, value, helper | 300 × hug | V, gap 6 |
| Toggle | 3 (On, Off, Disabled) | — | 52 × 32 | r 16 |
| Checkbox | 3 | — | 26 × 26 | r 7 |
| Toast | Info, Success, Error | Message | 328 × 44 | H, pad 12, gap 10, r 16 |
| Options Row | Control (Chevron, Toggle on, Toggle off) | Label | 328 × 48 | H, pad 12/16 |
| Mailbox Item | — | Title, Meta, Unread (bool), Icon (swap) | 328 × hug | H, pad 12, gap 10, r 16 |
| Section Header | — | title, action | 328 × 24 | H, space-between |
| Trailer art (6) | Kite Hop, Meteor Drift, Pop Rush, Brick Bounce, Stack Up, Firefly Catch | — | 312 × 410 | vector, SCALE constraints |
| Icons (39) | `Icon/<name>` | — | 24 × 24, 2 px stroke | stroke bound to text/primary |

The 39 icons are:

> play, cheer, talk, pass, shelve, flag, more, hub, find, mail, you, make, back, close, options, shelf, crew, check, pause, upload, film, zip, spark, chevron, down, eye, bolt, shield, block, link, qr, info, warn, trash, sound, keys, touch, trophy, rise

**State rules:**

- Hover is +6% lighter.
- Pressed is −6% darker and scaled to 0.98.
- Disabled uses `text/disabled` on `surface/sunken`, and the disabled control cannot be focused.
- Focus is a 2 px `brand/primaryStrong` ring with a 2 px offset.
- Loading swaps the label for a spinner and keeps the width.

---

## 7. Screens

All 15 screens are on the **Screens** page, laid out 5 per row.

| # | Screen | Figma node | Mode | PNG |
|---|---|---|---|---|
| 01 | Discover | 7:2 | Day | `exports/screens/01-discover.png` |
| 02 | Playing | 7:145 | Night | `exports/screens/02-playing.png` |
| 03 | Game details | 7:214 | Day | `exports/screens/03-game-details.png` |
| 04 | Find | 7:331 | Day | `exports/screens/04-find.png` |
| 05 | Shelves | 7:480 | Day | `exports/screens/05-shelves.png` |
| 06 | Maker profile | 8:492 | Day | `exports/screens/06-maker-profile.png` |
| 07 | You | 8:617 | Day | `exports/screens/07-you.png` |
| 08 | Talk | 8:791 | Day | `exports/screens/08-talk.png` |
| 09 | Mailbox | 8:864 | Day | `exports/screens/09-mailbox.png` |
| 10 | Make (upload) | 8:965 | Day | `exports/screens/10-make.png` |
| 11 | Studio | 9:842 | Day | `exports/screens/11-studio.png` |
| 12 | Options | 9:952 | Day | `exports/screens/12-options.png` |
| 13 | Press start (sign in) | 9:1035 | Day | `exports/screens/13-press-start.png` |
| 14 | Onboarding | 9:1081 | Day | `exports/screens/14-onboarding.png` |
| 15 | Ref desk (moderation) | 9:1147 | Day | `exports/screens/15-ref-desk.png` |

To switch any screen to Night, select the frame and go to **Layer › Appearance › Color › Night**. Every token in the screen flips.

---

## 8. Export index

```
design/
  DESIGN-SPEC.md                ← this file
  exports/
    screens/   01–15 *.png      360 × 760 @1x
    icons/     icon-*.svg       39 files, 24 × 24, stroke #4A3F36
    trailers/  trailer-*.svg    6 files, 312 × 410
```

For @2x or @3x PNGs, select the screens in Figma and use **Export › PNG 2x / 3x**. The PNGs here are @1x, the size the export service returned.

---

## 9. Editability checklist (verified)

- All 15 screens are frames with vertical auto layout, not images.
- There are 0 raster or IMAGE fills across the Screens page. Everything is vector, text or instance.
- There are 0 default-named layers ("Frame 12", "Rectangle 3"). Every layer has a meaningful name.
- Each screen is built from 6–30 component instances. For example, 01 Discover has 92 layers and 20 instances.
  - You can select any instance, change its properties in the right panel, or detach it.
- All text is live text tied to text styles.
- All colours are bound to variables, so changing one token updates every screen.
