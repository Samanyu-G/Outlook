// The real backend. Every function here talks to Supabase.
// Security is NOT enforced here: it's enforced by the RLS policies in
// supabase/migrations/0001_init.sql. This file just asks politely.
import { supabase } from './supabase.js'

let currentUser = null

function must({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

function toGame(row, likedIds, followingIds) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags || [],
    builtinKey: row.builtin_key,
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
