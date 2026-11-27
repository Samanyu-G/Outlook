// Demo backend: same functions as supabaseApi.js, but everything lives in this
// browser's localStorage. Used automatically when .env has no Supabase keys,
// so you can try the app (and so tests work offline). Nothing here is shared.

import { buildMailbox, buildStudio, countStamps } from './activity.js'

const KEY = 'nativity:demo:v1'
const COLORS = ['#f4b6a0', '#b9cde6', '#b7d3c0', '#f2d98d', '#e7b3c0']
const ago = (ms) => new Date(Date.now() - ms).toISOString()
const H = 3600e3, D = 24 * H

function seed() {
  const profiles = {
    c1: { id: 'c1', handle: 'mira.makes', display_name: 'Mira Osei', bio: 'Art student learning JavaScript', avatar_color: '#f4b6a0' },
    c2: { id: 'c2', handle: 'arjun.devs', display_name: 'Arjun Nair', bio: 'Class 11 · making one game a month', avatar_color: '#b9cde6' },
    c3: { id: 'c3', handle: 'lena.codes', display_name: 'Lena Brandt', bio: 'Just uploaded my first game', avatar_color: '#b7d3c0' },
    c4: { id: 'c4', handle: 'tomas.pixel', display_name: 'Tomás Rivera', bio: 'Hobby dev · retro stuff', avatar_color: '#f2d98d' },
    c5: { id: 'c5', handle: 'kofi.builds', display_name: 'Kofi Mensah', bio: 'Weekend game jams', avatar_color: '#e7b3c0' },
  }
  const games = [
    { id: 'g1', creator_id: 'c1', title: 'Kite Hop', description: 'My first ever game! Tap to lift the kite between the towers. Built over three weekends.', tags: ['onetap', 'arcade', 'firstgame'], builtin_key: 'kite', created_at: ago(2 * D) },
    { id: 'g2', creator_id: 'c2', title: 'Meteor Drift', description: 'Drag to steer your ship through a meteor shower. It gets faster every 12 seconds.', tags: ['drag', 'space', 'survival'], builtin_key: 'meteor', created_at: ago(3 * D) },
    { id: 'g3', creator_id: 'c3', title: 'Pop Rush', description: 'Pop the bubbles before they shrink away. Miss three and it is over.', tags: ['tap', 'reflex', 'casual'], builtin_key: 'pop', created_at: ago(5 * H) },
    { id: 'g4', creator_id: 'c4', title: 'Brick Bounce', description: 'Classic brick-breaking with a neon grid. Hit the edge of the paddle to aim.', tags: ['drag', 'retro', 'arcade'], builtin_key: 'brick', created_at: ago(21 * D) },
    { id: 'g5', creator_id: 'c5', title: 'Stack Up', description: 'Tap to drop each block. Whatever hangs over the edge gets sliced off. How high can you go?', tags: ['onetap', 'timing', 'tower'], builtin_key: 'stack', created_at: ago(1 * D) },
  ]
  const comments = [
    { id: 'm1', game_id: 'g1', user_id: 'c2', body: 'The tail wobble is so satisfying. Maybe slightly bigger gaps at the start?', created_at: ago(3 * H) },
    { id: 'm2', game_id: 'g1', user_id: 'c5', body: 'Sunset colours are lovely. Got 14 on my third try.', created_at: ago(D) },
    { id: 'm3', game_id: 'g1', user_id: 'c1', body: 'Thank you!! Making the first few gaps wider in the next update.', created_at: ago(20 * H) },
    { id: 'm4', game_id: 'g2', user_id: 'c3', body: 'Hard in a good way. Speed ramp feels fair.', created_at: ago(5 * H) },
    { id: 'm5', game_id: 'g3', user_id: 'c1', body: 'Welcome! The ring timer around each bubble is a smart touch.', created_at: ago(40 * 60e3) },
    { id: 'm6', game_id: 'g4', user_id: 'c5', body: 'Aiming with the paddle edge is really well tuned.', created_at: ago(6 * H) },
    { id: 'm7', game_id: 'g5', user_id: 'c3', body: 'The perfect-drop flash made me so happy.', created_at: ago(2 * H) },
  ]
  // Fake view/like/follow history from other demo users, so counts look alive.
  const views = []
  const fakeViews = { g1: 61, g2: 38, g3: 12, g4: 930, g5: 84 }
  for (const [g, n] of Object.entries(fakeViews)) for (let i = 0; i < n; i++) views.push({ user_id: `fake${i}`, game_id: g })
  const likes = []
  const fakeLikes = { g1: 23, g2: 9, g3: 2, g4: 148, g5: 37 }
  for (const [g, n] of Object.entries(fakeLikes)) for (let i = 0; i < n; i++) likes.push({ user_id: `fake${i}`, game_id: g })
  const follows = []
  const fakeFollows = { c1: 14, c2: 3, c3: 0, c4: 212, c5: 41 }
  for (const [c, n] of Object.entries(fakeFollows)) for (let i = 0; i < n; i++) follows.push({ follower_id: `fake${i}`, creator_id: c })
  const feedback = []
  const fakeStamps = { g1: ['Fun', 'Fun', 'Clever', 'Pretty', 'Fun', 'Want more'], g2: ['Tough', 'Fun', 'Tough'], g3: ['Fun', 'Pretty'], g4: ['Fun', 'Clever', 'Tough', 'Fun'], g5: ['Clever', 'Fun', 'Want more', 'Pretty'] }
  for (const [g, tags] of Object.entries(fakeStamps)) tags.forEach((t, i) => feedback.push({ user_id: `fake${i}`, game_id: g, tags: [t], updated_at: ago(i * 5 * H) }))
  const play_starts = []
  const fakePlayers = { g1: 41, g2: 20, g3: 6, g4: 402, g5: 52 }
  for (const [g, n] of Object.entries(fakePlayers)) for (let i = 0; i < n; i++) play_starts.push({ user_id: `fake${i}`, game_id: g })
  return { profiles, games, comments, views, likes, follows, feedback, plays: [], play_starts, session: null }
}

let db
try { db = JSON.parse(localStorage.getItem(KEY)) } catch { db = null }
if (!db) db = seed()
// Browsers that saved demo data before Phase 5 don't have these yet.
if (!db.play_starts) { const fresh = seed(); db.play_starts = fresh.play_starts; db.feedback = [...fresh.feedback, ...db.feedback] }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ } }

const listeners = new Set()
const me = () => db.session
const wait = () => new Promise((r) => setTimeout(r, 120)) // feel a bit like a network call

function needUser() { if (!me()) throw new Error('Sign in first.') }

export const demoApi = {
  mode: 'demo',

  async getUser() { return me() },
  onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
  async signInWithEmail(email) {
    await wait()
    // Demo mode signs you in straight away instead of emailing a link.
    let p = Object.values(db.profiles).find((x) => x.email === email)
    if (!p) {
      const id = 'u' + Math.random().toString(36).slice(2, 10)
      p = { id, email, handle: 'player' + id.slice(1, 7), display_name: email.split('@')[0].slice(0, 40), bio: '', avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)] }
      db.profiles[id] = p
    }
    db.session = { id: p.id, email }
    save(); listeners.forEach((l) => l(me()))
    return { sent: false, signedIn: true }
  },
  async signInWithGoogle() { throw new Error('Google sign-in needs Supabase. Use email in demo mode.') },
  async signOut() { db.session = null; save(); listeners.forEach((l) => l(null)) },

  async getMyProfile() { return me() ? db.profiles[me().id] : null },
  async updateMyProfile(f) {
    await wait()
    const handle = f.handle.trim().toLowerCase()
    if (!/^[a-z0-9._]{3,24}$/.test(handle)) throw new Error('Handles are 3–24 characters: lowercase letters, numbers, dots and underscores.')
    if (Object.values(db.profiles).some((p) => p.handle === handle && p.id !== me().id)) throw new Error('That handle is taken. Try another one.')
    Object.assign(db.profiles[me().id], { handle, display_name: f.display_name.trim().slice(0, 40), bio: f.bio.trim().slice(0, 160) })
    save(); return db.profiles[me().id]
  },

  async listFeed(tab) {
    await wait()
    const uid = me()?.id
    const following = new Set(db.follows.filter((f) => f.follower_id === uid).map((f) => f.creator_id))
    let games = db.games.map((g) => {
      const p = db.profiles[g.creator_id]
      return {
        id: g.id, title: g.title, description: g.description, tags: g.tags, builtinKey: g.builtin_key, createdAt: g.created_at,
        creator: { id: p.id, handle: p.handle, name: p.display_name, color: p.avatar_color, bio: p.bio, followers: db.follows.filter((f) => f.creator_id === p.id).length },
        likes: db.likes.filter((l) => l.game_id === g.id).length,
        comments: db.comments.filter((c) => c.game_id === g.id).length,
        views: db.views.filter((v) => v.game_id === g.id).length,
        players: new Set(db.play_starts.filter((x) => x.game_id === g.id).map((x) => x.user_id)).size,
        stamps: countStamps(db.feedback.filter((f) => f.game_id === g.id).map((f) => f.tags)),
        liked: db.likes.some((l) => l.game_id === g.id && l.user_id === uid),
        following: following.has(g.creator_id),
        played: db.play_starts.some((x) => x.game_id === g.id && x.user_id === (uid || 'guest')),
        touchFriendly: true,
      }
    })
    if (tab === 'following') games = games.filter((g) => g.following)
    games.sort(tab === 'fresh' ? (a, b) => a.views - b.views || b.createdAt.localeCompare(a.createdAt) : (a, b) => b.createdAt.localeCompare(a.createdAt))
    return games
  },
  async recordView(gameId) {
    const uid = me()?.id; if (!uid) return
    if (!db.views.some((v) => v.user_id === uid && v.game_id === gameId)) { db.views.push({ user_id: uid, game_id: gameId }); save() }
  },

  async recordPlayStart(gameId) {
    const uid = me()?.id || 'guest'
    if (!db.play_starts.some((x) => x.user_id === uid && x.game_id === gameId)) { db.play_starts.push({ user_id: uid, game_id: gameId }); save() }
  },

  async setLike(gameId, on) {
    needUser(); const uid = me().id
    db.likes = db.likes.filter((l) => !(l.user_id === uid && l.game_id === gameId))
    if (on) db.likes.push({ user_id: uid, game_id: gameId })
    save()
  },
  async setFollow(creatorId, on) {
    needUser(); const uid = me().id
    if (creatorId === uid) throw new Error("You can't follow yourself.")
    db.follows = db.follows.filter((f) => !(f.follower_id === uid && f.creator_id === creatorId))
    if (on) db.follows.push({ follower_id: uid, creator_id: creatorId })
    save()
  },
  async listComments(gameId) {
    await wait()
    const blocked = new Set((db.blocks || []).filter((b) => b.blocker_id === me()?.id).map((b) => b.blocked_id))
    return db.comments.filter((c) => c.game_id === gameId && !blocked.has(c.user_id)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => {
      const p = db.profiles[c.user_id]
      const f = db.feedback.find((x) => x.game_id === gameId && x.user_id === c.user_id)
      return { id: c.id, body: c.body, createdAt: c.created_at, userId: c.user_id, handle: p?.handle ?? 'unknown', color: p?.avatar_color ?? '#888888', stamp: f?.tags[0] ?? null }
    })
  },
  async addComment(gameId, body) {
    needUser()
    const c = { id: 'm' + Date.now(), game_id: gameId, user_id: me().id, body: body.trim().slice(0, 240), created_at: new Date().toISOString() }
    db.comments.push(c); save()
    const p = db.profiles[c.user_id]
    return { id: c.id, body: c.body, createdAt: c.created_at, userId: c.user_id, handle: p.handle, color: p.avatar_color }
  },
  async sendFeedback(gameId, tags) {
    needUser(); const uid = me().id
    db.feedback = db.feedback.filter((f) => !(f.user_id === uid && f.game_id === gameId))
    db.feedback.push({ user_id: uid, game_id: gameId, tags, updated_at: new Date().toISOString() }); save()
  },
  async getMyFeedback(gameId) {
    const uid = me()?.id
    return db.feedback.find((f) => f.user_id === uid && f.game_id === gameId)?.tags ?? null
  },
  async recordPlay(gameId, score) {
    const uid = me()?.id; if (!uid) return null
    const prev = Math.max(0, ...db.plays.filter((p) => p.user_id === uid && p.game_id === gameId).map((p) => p.score))
    db.plays.push({ user_id: uid, game_id: gameId, score }); save()
    return prev
  },
  // Safety features in demo mode: reports and blocks stay in this browser; no moderation.
  async acceptTerms() { if (me()) { db.profiles[me().id].terms_accepted_at = new Date().toISOString(); save() } },
  async report() { needUser(); await wait() },
  async block(userId) { needUser(); (db.blocks ||= []).push({ blocker_id: me().id, blocked_id: userId }); save() },
  async unblock(userId) { db.blocks = (db.blocks || []).filter((b) => !(b.blocker_id === me().id && b.blocked_id === userId)); save() },
  async listBlocked() { return (db.blocks || []).filter((b) => b.blocker_id === me()?.id).map((b) => db.profiles[b.blocked_id]).filter(Boolean) },
  async deleteComment(id) {
    const c = db.comments.find((x) => x.id === id)
    const game = c && db.games.find((g) => g.id === c.game_id)
    if (!c || (c.user_id !== me()?.id && game?.creator_id !== me()?.id)) throw new Error('You can only delete your own comments, or comments on your games.')
    db.comments = db.comments.filter((x) => x.id !== id); save()
  },
  async listReports() { return [] },
  async moderate() { throw new Error('Moderation needs the live database.') },
  async setSuspended() { throw new Error('Moderation needs the live database.') },

  // Uploads need real storage, so they only work with Supabase connected.
  canUpload: false,
  async createGame() { throw new Error('Uploading needs the live database. Connect Supabase first (see README).') },
  async listMyGames() {
    const uid = me()?.id
    return db.games.filter((g) => g.creator_id === uid).map((g) => ({
      id: g.id, title: g.title, status: 'published', createdAt: g.created_at, builtin: !!g.builtin_key,
      likes: db.likes.filter((l) => l.game_id === g.id).length, comments: db.comments.filter((c) => c.game_id === g.id).length,
      views: db.views.filter((v) => v.game_id === g.id).length, players: new Set(db.play_starts.filter((x) => x.game_id === g.id).map((x) => x.user_id)).size,
    }))
  },
  async deleteGame() { throw new Error('Not available in demo mode.') },

  async getMyStats() {
    const uid = me().id
    return {
      plays: db.plays.filter((p) => p.user_id === uid).length,
      likes: db.likes.filter((l) => l.user_id === uid).length,
      feedback: db.feedback.filter((f) => f.user_id === uid).length,
      following: db.follows.filter((f) => f.follower_id === uid).map((f) => db.profiles[f.creator_id]).filter(Boolean),
    }
  },

  async listNotesBy(userId) {
    const title = Object.fromEntries(db.games.map((g) => [g.id, g.title]))
    return db.comments.filter((c) => c.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20)
      .map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, gameId: c.game_id, gameTitle: title[c.game_id] ?? 'a game' }))
  },
  async getMyActivity() {
    const uid = me().id
    return {
      playedIds: [...new Set(db.play_starts.filter((x) => x.user_id === uid).map((x) => x.game_id))],
      stamps: db.feedback.filter((f) => f.user_id === uid).length,
      talk: db.comments.filter((c) => c.user_id === uid).length,
      following: db.follows.filter((f) => f.follower_id === uid).map((f) => db.profiles[f.creator_id]).filter(Boolean),
    }
  },
  async listMailbox() {
    const uid = me().id
    const mine = db.games.filter((g) => g.creator_id === uid)
    const ids = new Set(mine.map((g) => g.id))
    const title = Object.fromEntries(db.games.map((g) => [g.id, g.title]))
    const players = (id) => new Set(db.play_starts.filter((x) => x.game_id === id).map((x) => x.user_id)).size
    return buildMailbox({
      games: mine.map((g) => ({ id: g.id, title: g.title, players: players(g.id) })),
      stamps: db.feedback.filter((f) => ids.has(f.game_id) && f.updated_at).map((f) => ({ gameId: f.game_id, title: title[f.game_id], tags: f.tags, at: f.updated_at })),
      cheers: [],
      crew: [],
      notes: db.comments.filter((c) => ids.has(c.game_id) && c.user_id !== uid).map((c) => ({ id: c.id, handle: db.profiles[c.user_id]?.handle ?? 'someone', title: title[c.game_id], body: c.body, at: c.created_at })),
      replies: [],
    })
  },
  async getStudio(gameId) {
    const uid = me().id
    const g = db.games.find((x) => x.id === gameId)
    if (!g) return null
    const row = {
      views: db.views.filter((v) => v.game_id === gameId).length,
      players: new Set(db.play_starts.filter((x) => x.game_id === gameId).map((x) => x.user_id)).size,
      likes: db.likes.filter((l) => l.game_id === gameId).length,
      comments: db.comments.filter((c) => c.game_id === gameId).length,
    }
    const notes = db.comments.filter((c) => c.game_id === gameId).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => ({ mine: c.user_id === uid }))
    return buildStudio(row, db.feedback.filter((f) => f.game_id === gameId).map((f) => f.tags), notes)
  },
  async deleteMyAccount() {
    const uid = me().id
    delete db.profiles[uid]
    for (const k of ['likes', 'feedback', 'plays', 'views', 'comments', 'play_starts']) db[k] = db[k].filter((x) => x.user_id !== uid)
    db.follows = db.follows.filter((f) => f.follower_id !== uid && f.creator_id !== uid)
    db.session = null; save(); listeners.forEach((l) => l(null))
  },
}
