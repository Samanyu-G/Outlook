// Shared rules for the Phase 5 screens: stamps, levels, shelves, Mailbox and Studio.
// Both backends (live and demo) use these, so the numbers always mean the same thing.

/* ---------- Stamps: the five reactions a player can give a game ---------- */
export const STAMPS = [
  { key: 'fun', tag: 'Fun', label: 'Fun!' },
  { key: 'clever', tag: 'Clever', label: 'Clever' },
  { key: 'pretty', tag: 'Pretty', label: 'Pretty' },
  { key: 'tough', tag: 'Tough', label: 'Tough' },
  { key: 'more', tag: 'Want more', label: 'Want more' },
]
// Older feedback chips count as the matching stamp.
const OLD = { 'Great visuals': 'pretty', 'Too hard': 'tough', 'Want more levels': 'more' }
export const stampKey = (tag) => STAMPS.find((s) => s.tag === tag)?.key || OLD[tag] || null
export const stampOf = (key) => STAMPS.find((s) => s.key === key)

export function countStamps(tagLists) {
  const out = { fun: 0, clever: 0, pretty: 0, tough: 0, more: 0 }
  for (const tags of tagLists) {
    const seen = new Set(tags.map(stampKey).filter(Boolean))
    for (const k of seen) out[k]++
  }
  return out
}
export const stampTotal = (st = {}) => STAMPS.reduce((n, s) => n + (st[s.key] || 0), 0)
export function topStamp(st = {}) {
  const best = STAMPS.reduce((a, s) => ((st[s.key] || 0) > (st[a.key] || 0) ? s : a), STAMPS[0])
  return (st[best.key] || 0) > 0 ? best : null
}

/* ---------- Levels (worked out from public numbers, never stored) ---------- */
// Maker level grows with how many people have played your games.
const MAKER_STEPS = [0, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
export function makerLevel(players) {
  let lv = 1
  MAKER_STEPS.forEach((n, i) => { if (players >= n) lv = i + 1 })
  const next = MAKER_STEPS[lv] ?? null
  return { level: lv, next }
}
// Player level grows with how many different games you've played.
export const playerLevel = (played) => 1 + Math.floor(Math.sqrt(played * 1.5))

/* ---------- Shelves (Browse): each shelf collects games by their tags ---------- */
export const SHELVES = [
  { key: 'onethumb', label: 'One thumb', tags: ['onethumb', 'onetap', 'tap', 'drag'] },
  { key: 'arcade', label: 'Arcade', tags: ['arcade', 'retro', 'reflex', 'space', 'survival'] },
  { key: 'cosy', label: 'Cosy', tags: ['cosy', 'cozy', 'casual', 'relax', 'chill'] },
  { key: 'puzzle', label: 'Puzzle', tags: ['puzzle', 'timing', 'logic', 'tower', 'brain'] },
]
export const onShelf = (game, key) => {
  const shelf = SHELVES.find((s) => s.key === key)
  return !!shelf && game.tags.some((t) => shelf.tags.includes(t.toLowerCase()))
}

/* ---------- Milestones ---------- */
export const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
export function milestone(players) {
  const reached = [...MILESTONES].reverse().find((m) => players >= m) || null
  const next = MILESTONES.find((m) => players < m) || null
  return { reached, next }
}

/* ---------- Mailbox ---------- */
const DAY = 864e5
const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10)

// Turns raw rows into Mailbox items. Stamps and cheers are grouped per game per day.
export function buildMailbox({ games, stamps, cheers, crew, notes, replies }) {
  const items = []
  const groups = {}
  for (const s of stamps) {
    const k = `stamps:${s.gameId}:${dayKey(s.at)}`
    const g = (groups[k] ||= { id: k, kind: 'stamps', title: s.title, n: 0, tags: [], at: s.at })
    g.n++; g.tags.push(s.tags); if (s.at > g.at) g.at = s.at
  }
  for (const c of cheers) {
    const k = `cheers:${c.gameId}:${dayKey(c.at)}`
    const g = (groups[k] ||= { id: k, kind: 'cheers', title: c.title, n: 0, at: c.at })
    g.n++; if (c.at > g.at) g.at = c.at
  }
  for (const g of Object.values(groups)) {
    if (g.kind === 'stamps') {
      const top = topStamp(countStamps(g.tags))
      items.push({ id: g.id, filter: 'stamps', icon: 'cheer', title: `${g.title} got ${g.n} new stamp${g.n === 1 ? '' : 's'}`, meta: top ? `Mostly ${top.label}` : '', at: g.at })
    } else {
      items.push({ id: g.id, filter: 'stamps', icon: 'cheer', title: `${g.title} got ${g.n} cheer${g.n === 1 ? '' : 's'}`, meta: '', at: g.at })
    }
  }
  for (const c of crew) items.push({ id: `crew:${c.handle}:${c.at}`, filter: 'crew', icon: 'crew', title: `@${c.handle} joined your crew`, meta: '', at: c.at })
  for (const n of notes) items.push({ id: `note:${n.id}`, filter: 'talk', icon: 'talk', title: `@${n.handle} left a note on ${n.title}`, meta: `“${clip(n.body)}”`, at: n.at })
  for (const r of replies) items.push({ id: `reply:${r.id}`, filter: 'talk', icon: 'talk', title: `@${r.handle} replied on ${r.title}`, meta: `“${clip(r.body)}”`, at: r.at })
  items.sort((a, b) => b.at.localeCompare(a.at))

  // The milestone card: your game closest to (or most recently past) a players milestone.
  let top = null
  for (const g of games) {
    const m = milestone(g.players)
    if (!m.reached) continue
    if (!top || m.reached > top.reached) top = { game: g, ...m }
  }
  const milestoneCard = top && {
    title: `${top.game.title} reached ${top.reached} players!`,
    meta: top.next ? `${top.next - top.game.players} more to reach ${top.next}.` : 'That’s the top milestone. Amazing.',
    progress: top.next ? top.game.players / top.next : 1,
  }
  return { items, milestone: milestoneCard }
}
const clip = (s, n = 48) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

// Splits Mailbox items into Today / Earlier for display.
export const isToday = (iso) => Date.now() - new Date(iso).getTime() < DAY && dayKey(iso) === dayKey(new Date().toISOString())

/* ---------- Studio ---------- */
// row: { views, players, likes, comments } · tagLists: feedback tags · notes: [{ mine }] in time order
export function buildStudio(row, tagLists, notes) {
  if (!row) return null
  const stamps = countStamps(tagLists)
  // Notes from players that came after your last reply.
  let waiting = 0
  for (const n of notes) waiting = n.mine ? 0 : waiting + 1
  const playRate = row.views ? Math.round((row.players / row.views) * 100) : 0
  return { ...row, stamped: tagLists.length, stamps, waiting, playRate, milestone: milestone(row.players) }
}
