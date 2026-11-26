// The rest of the app only imports `api` from here, never Supabase directly.
// That way the UI doesn't care whether it's talking to the real database or demo mode.
import { isConfigured } from './supabase.js'
import { supabaseApi } from './supabaseApi.js'
import { demoApi } from './demoApi.js'

export const api = isConfigured ? supabaseApi : demoApi

// Guests (anonymous accounts) can watch and play; members can also like, comment, follow and upload.
export const isMember = (user) => !!user && !user.is_anonymous

// A game keeps its "Fresh creator boost" until it reaches this many views.
export const BOOST_VIEWS = 100

export const initials = (name = '') => name.split(/[\s._]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

export const fmt =(n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n))

export function timeAgo(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  if (s < 604800) return Math.floor(s / 86400) + 'd'
  return Math.floor(s / 604800) + 'w'
}
