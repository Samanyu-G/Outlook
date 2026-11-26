// The real backend. Every function here talks to Supabase.
// Security is NOT enforced here: it's enforced by the RLS policies in
// supabase/migrations/0001_init.sql. This file just asks politely.
import { supabase } from './supabase.js'

let currentUser = null

function must({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

const publicUrl = (bucket, path) => (path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null)

// Uploads run a few at a time: faster than one by one, gentler than all at once.
async function runPool(items, size, worker) {
  let next = 0
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const item = items[next++]; await worker(item) }
  })
  await Promise.all(lanes)
}

// Storage can't list a folder recursively, so we walk it.
async function listAllFiles(bucket, prefix) {
  const out = []
  const { data, error } = await supabase.storage.from(bucket).list(prefix.replace(/\/$/, ''), { limit: 1000 })
  if (error) throw new Error(error.message)
  for (const item of data) {
    const path = `${prefix.replace(/\/$/, '')}/${item.name}`
    if (item.id) out.push(path) // files have an id, folders don't
    else out.push(...await listAllFiles(bucket, path))
  }
  return out
}

function toGame(row, likedIds, followingIds) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    builtinKey: row.builtin_key,
    bundleUrl: publicUrl('games', row.bundle_path),
    trailerUrl: publicUrl('trailers', row.trailer_path),
    touchFriendly: row.touch_friendly,
    createdAt: row.created_at,
    creator: {
      id: row.creator_id,
      handle: row.creator_handle,
      name: row.creator_name,
      color: row.creator_color,
      bio: row.creator_bio,
      followers: row.follower_count,
    },
    likes: row.like_count,
    comments: row.comment_count,
    views: row.view_count,
    liked: likedIds.has(row.id),
    following: followingIds.has(row.creator_id),
  }
}

export const supabaseApi = {
  mode: 'live',

  /* ---------- auth ---------- */
  async getUser() {
    const { data } = await supabase.auth.getSession()
    currentUser = data.session?.user ?? null
    return currentUser
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user ?? null
      cb(currentUser)
    })
    return () => data.subscription.unsubscribe()
  },
  async signInWithEmail(email) {
    // Sends a "magic link". Clicking it in the email signs you in and returns here.
    must(await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }))
    return { sent: true }
  },
  async signInWithGoogle() {
    must(await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }))
  },
  async signOut() {
    must(await supabase.auth.signOut())
  },

  /* ---------- profile ---------- */
  async getMyProfile() {
    if (!currentUser) return null
    return must(await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle())
  },
  async updateMyProfile(fields) {
    const clean = {
      handle: fields.handle?.trim().toLowerCase(),
      display_name: fields.display_name?.trim(),
      bio: fields.bio?.trim(),
    }
    const { data, error } = await supabase.from('profiles').update(clean).eq('id', currentUser.id).select().single()
    if (error?.code === '23505') throw new Error('That handle is taken. Try another one.')
    if (error?.code === '23514') throw new Error('Handles are 3–24 characters: lowercase letters, numbers, dots and underscores.')
    if (error) throw new Error(error.message)
    return data
  },

  /* ---------- feed ---------- */
  async listFeed(tab) {
    let followingIds = new Set()
    if (currentUser) {
      const rows = must(await supabase.from('follows').select('creator_id').eq('follower_id', currentUser.id))
      followingIds = new Set(rows.map((r) => r.creator_id))
    }
    if (tab === 'following' && followingIds.size === 0) return []

    let q = supabase.from('game_feed').select('*')
    if (tab === 'following') q = q.in('creator_id', [...followingIds])
    // Phase 1 ranking is simple on purpose. Phase 3 replaces this with the real algorithm.
    q = tab === 'fresh'
      ? q.order('view_count', { ascending: true }).order('created_at', { ascending: false })
      : q.order('created_at', { ascending: false })
    const rows = must(await q.limit(50))

    let likedIds = new Set()
    if (currentUser && rows.length) {
      const liked = must(await supabase.from('likes').select('game_id').eq('user_id', currentUser.id).in('game_id', rows.map((r) => r.id)))
      likedIds = new Set(liked.map((r) => r.game_id))
    }
    return rows.map((r) => toGame(r, likedIds, followingIds))
  },

  async recordView(gameId) {
    if (!currentUser) return // Phase 1: only signed-in views count.
    await supabase.from('views').upsert({ user_id: currentUser.id, game_id: gameId }, { onConflict: 'user_id,game_id', ignoreDuplicates: true })
  },

  /* ---------- social ---------- */
  async setLike(gameId, on) {
    if (on) must(await supabase.from('likes').upsert({ user_id: currentUser.id, game_id: gameId }, { onConflict: 'user_id,game_id', ignoreDuplicates: true }))
    else must(await supabase.from('likes').delete().eq('user_id', currentUser.id).eq('game_id', gameId))
  },
  async setFollow(creatorId, on) {
    if (creatorId === currentUser.id) throw new Error("You can't follow yourself.")
    if (on) must(await supabase.from('follows').upsert({ follower_id: currentUser.id, creator_id: creatorId }, { onConflict: 'follower_id,creator_id', ignoreDuplicates: true }))
    else must(await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('creator_id', creatorId))
  },
  async listComments(gameId) {
    const rows = must(await supabase
      .from('comments')
      .select('id, body, created_at, user_id, author:profiles(handle, avatar_color)')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(200))
    return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, userId: r.user_id, handle: r.author?.handle ?? 'unknown', color: r.author?.avatar_color ?? '#888888' }))
  },
  async addComment(gameId, body) {
    const r = must(await supabase
      .from('comments')
      .insert({ game_id: gameId, user_id: currentUser.id, body: body.trim() })
      .select('id, body, created_at, user_id, author:profiles(handle, avatar_color)')
      .single())
    return { id: r.id, body: r.body, createdAt: r.created_at, userId: r.user_id, handle: r.author.handle, color: r.author.avatar_color }
  },
  async sendFeedback(gameId, tags) {
    must(await supabase.from('feedback').upsert({ user_id: currentUser.id, game_id: gameId, tags, updated_at: new Date().toISOString() }, { onConflict: 'user_id,game_id' }))
  },
  async getMyFeedback(gameId) {
    if (!currentUser) return null
    const row = must(await supabase.from('feedback').select('tags').eq('user_id', currentUser.id).eq('game_id', gameId).maybeSingle())
    return row?.tags ?? null
  },
  async recordPlay(gameId, score) {
    // Returns your best score before this round (0 if none).
    if (!currentUser) return null
    const prev = must(await supabase.from('plays').select('score').eq('user_id', currentUser.id).eq('game_id', gameId).order('score', { ascending: false }).limit(1))
    must(await supabase.from('plays').insert({ user_id: currentUser.id, game_id: gameId, score }))
    return prev[0]?.score ?? 0
  },

  /* ---------- creator uploads ---------- */
  canUpload: true,

  /**
   * Publishes a game. Steps: save it as a hidden draft, upload the trailer and
   * every game file into your own folder, then flip it to "published".
   * If anything fails, everything uploaded so far is removed again.
   */
  async createGame({ title, description, tags, touchFriendly, pkg, trailer }, onProgress = () => {}) {
    const uid = currentUser.id
    const id = crypto.randomUUID()
    const folder = `${uid}/${id}/`
    const tExt = trailer.name.split('.').pop().toLowerCase()
    const trailerPath = `${folder}trailer.${tExt}`

    must(await supabase.from('games').insert({
      id, creator_id: uid, title: title.trim(), description: description.trim(), tags,
      touch_friendly: touchFriendly, bundle_path: folder, trailer_path: trailerPath, status: 'draft',
    }))

    const total = pkg.totalBytes + trailer.size
    let done = 0
    const step = (n) => { done += n; onProgress(Math.min(1, done / total)) }
    try {
      const up = async (bucket, path, body, contentType) => {
        const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false, cacheControl: '3600' })
        if (error) throw new Error(`Couldn’t upload ${path.slice(folder.length) || path}: ${error.message}`)
      }
      await up('trailers', trailerPath, trailer, trailer.type || 'video/mp4')
      step(trailer.size)
      await runPool(pkg.files, 4, async (f) => {
        await up('games', folder + f.path, new Blob([f.data], { type: f.type }), f.type)
        step(f.size)
      })
      must(await supabase.from('games').update({ status: 'published' }).eq('id', id))
      return id
    } catch (e) {
      await this.deleteGame(id).catch(() => {})
      throw e
    }
  },

  /** Your own games (published and drafts) with their counts. */
  async listMyGames() {
    const rows = must(await supabase.from('games').select('id, title, status, created_at, builtin_key')
      .eq('creator_id', currentUser.id).order('created_at', { ascending: false }))
    if (!rows.length) return []
    const counts = must(await supabase.from('game_feed').select('id, like_count, comment_count, view_count').in('id', rows.map((r) => r.id)))
    const byId = Object.fromEntries(counts.map((c) => [c.id, c]))
    return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, createdAt: r.created_at, builtin: !!r.builtin_key,
      likes: byId[r.id]?.like_count ?? 0, comments: byId[r.id]?.comment_count ?? 0, views: byId[r.id]?.view_count ?? 0 }))
  },

  /** Deletes a game and all of its files. Likes, comments and views go with it. */
  async deleteGame(id) {
    const row = must(await supabase.from('games').select('bundle_path, trailer_path').eq('id', id).maybeSingle())
    if (!row) return
    if (row.bundle_path) {
      const paths = await listAllFiles('games', row.bundle_path)
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabase.storage.from('games').remove(paths.slice(i, i + 100))
        if (error) throw new Error(error.message)
      }
    }
    if (row.trailer_path) await supabase.storage.from('trailers').remove([row.trailer_path])
    must(await supabase.from('games').delete().eq('id', id))
  },

  /* ---------- profile screen ---------- */
  async getMyStats() {
    const id = currentUser.id
    const count = async (table, col) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, id)
      if (error) throw new Error(error.message)
      return count ?? 0
    }
    const [plays, likes, feedback] = await Promise.all([count('plays', 'user_id'), count('likes', 'user_id'), count('feedback', 'user_id')])
    const following = must(await supabase.from('follows').select('creator:profiles!follows_creator_id_fkey(id, handle, display_name, bio, avatar_color)').eq('follower_id', id))
    return { plays, likes, feedback, following: following.map((f) => f.creator).filter(Boolean) }
  },
}
