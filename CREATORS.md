# Publishing your game on Nativity

Nativity shows your game to players as a short trailer in a swipe feed. If they like it, they tap to play.
**Every new game gets its first 100 views guaranteed**, whether or not you have followers.

## What to upload

1. **Your game** as a `.zip` of the game folder (or a single `.html` file).
2. **A trailer**: a video of your game being played, 30 seconds or less. A screen recording from your phone works well.

## Checklist

- [ ] The main page is called **`index.html`** and sits at the top of the zip. Zipping the folder itself is fine; we look inside it.
- [ ] Files are loaded with **relative paths**: `./sprites/hero.png` or `sprites/hero.png`, **not** `/sprites/hero.png`.
  - Using Vite? Add `base: './'` to `vite.config.js` and upload the zipped `dist` folder.
- [ ] Everything is under **25 MB** and **300 files**.
- [ ] Only these file types: html, js, css, json, txt, png, jpg, gif, webp, svg, mp3, ogg, wav, m4a, mp4, webm, woff/woff2/ttf/otf, wasm, glb/gltf.
- [ ] It works on a **phone held upright**, with taps and swipes. If it needs a keyboard, untick "Works with touch controls" so players know.
- [ ] Trailer is **.mp4** (H.264) or **.webm**, ideally vertical, 30 seconds or less, under 15 MB.

## What works inside Nativity

- ✅ Canvas, WebGL, Web Audio, Phaser, PixiJS, Three.js, Kaboom and other libraries (bundle them in your zip or load them from a CDN over `https://`).
- ✅ `localStorage` for high scores and save data. It's kept per game, in the player's browser.
- ✅ `fetch('./levels/1.json')` and other relative file loads.
- ❌ Pop-ups, opening other pages, or links to other `.html` files in your zip.
- ❌ Cookies, IndexedDB, and reading anything about the player. Your game runs in a sandbox, so it can't see who is playing.

## Optional: report the score

When a round ends, call:

```js
if (window.Nativity) Nativity.gameOver(score)
```

Nativity then shows the player their score and best score, and asks them for quick feedback (Fun, Too hard, Confusing controls…). That feedback is private and only you see it. Without this call, players can still tap **Rate** at any time.

## Why your game runs in a sandbox

Anyone can upload, so every game is treated as untrusted. It runs in a separate, locked-down frame: it can draw, play sound and read touches, but it can't access the player's account or the rest of the app. This keeps players safe, which keeps them willing to try games from people they've never heard of. That's the whole point of Nativity.
