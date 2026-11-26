import { useEffect, useRef, useState } from 'react'
import { createRunner } from '../games/engine.js'
import { BUILTIN_GAMES } from '../games/builtin.js'
import { BOOST_VIEWS, fmt, initials } from '../lib/api.js'
import { CommentIcon, HeartBurst, HeartIcon, PlayIcon, ShareIcon } from './Icons.jsx'

/* The trailer: the game playing itself, only while its card is on screen. */
function TrailerCanvas({ gameKey, active }) {
  const canvasRef = useRef(null)
  const runnerRef = useRef(null)

  useEffect(() => {
    const factory = BUILTIN_GAMES[gameKey]
    if (!factory) return
    const r = createRunner(canvasRef.current, factory, 'demo')
    r.warm(1.5) // simulate 1.5s so the still frame isn't empty
    runnerRef.current = r
    return () => { r.destroy(); runnerRef.current = null }
  }, [gameKey])

  useEffect(() => {
    const r = runnerRef.current
    if (!r) return
    if (active) r.start(); else r.stop()
  }, [active, gameKey])

  return <canvas ref={canvasRef} className="trailer" aria-hidden="true" />
}

/* Uploaded games: the creator's trailer video. Plays only while on screen. */
function VideoTrailer({ src, active }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])
  return <video ref={ref} className="trailer" src={src} muted loop playsInline preload={active ? 'auto' : 'metadata'} aria-hidden="true" />
}

function GameCard({ game, active, showCoach, onPlay, onLike, onFollow, onComments, onShare, bursts }) {
  const c = game.creator
  const [captionOpen, setCaptionOpen] = useState(false)
  return (
    <>
      {game.builtinKey
        ? <TrailerCanvas gameKey={game.builtinKey} active={active} />
        : <VideoTrailer src={game.trailerUrl} active={active} />}
      <div className="shade" />
      <div className="chips-top">
        <span className="chip-trailer"><i />Trailer</span>
        {game.touchFriendly === false && <span className="chip-trailer">Needs keyboard</span>}
      </div>
      <button type="button" className="play" onClick={() => onPlay(game)} aria-label={`Play ${game.title}`}>
        <span className="disc"><PlayIcon /></span>
        <span className="lbl">Tap to play</span>
        <span className="sub">or swipe ←</span>
      </button>
      {showCoach && <div className="coach">↑ Swipe up for the next game</div>}

      <aside className="rail">
        <button type="button" className="avatar" aria-pressed={game.following} aria-label={`${game.following ? 'Unfollow' : 'Follow'} @${c.handle}`} style={{ background: c.color }} onClick={() => onFollow(game)}>
          {initials(c.name || c.handle)}<span className="plus">{game.following ? '✓' : '+'}</span>
        </button>
        <button type="button" aria-pressed={game.liked} aria-label="Like" onClick={() => onLike(game, !game.liked)}>
          <HeartIcon /><span>{fmt(game.likes)}</span>
        </button>
        <button type="button" aria-label="Comments" onClick={() => onComments(game)}>
          <CommentIcon /><span>{fmt(game.comments)}</span>
        </button>
        <button type="button" aria-label="Share" onClick={() => onShare(game)}>
          <ShareIcon /><span>Share</span>
        </button>
      </aside>

      <div className="meta">
        {game.views < BOOST_VIEWS && (
          <div className="boost">
            <b>Fresh creator boost</b>
            <span>Guaranteed views: {game.views} of {BOOST_VIEWS}</span>
            <div className="bar"><i style={{ width: `${(game.views / BOOST_VIEWS) * 100}%` }} /></div>
          </div>
        )}
        <div className="who">
          <strong>@{c.handle}</strong>
          <button type="button" className="follow-btn" aria-pressed={game.following} onClick={() => onFollow(game)}>
            {game.following ? 'Following' : 'Follow'}
          </button>
        </div>
        <h2>{game.title}</h2>
        {/* Caption is collapsed to one line, like Instagram. Tap to expand. */}
        <button type="button" className={`caption${captionOpen ? ' open' : ''}`} aria-expanded={captionOpen} onClick={() => setCaptionOpen((o) => !o)}>
          <span className="txt">{game.description}</span>
          <span className="more">{captionOpen ? 'less' : 'more'}</span>
        </button>
        {captionOpen && <div className="tags">{game.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
      </div>
      {bursts.map((b) => <HeartBurst key={b.id} x={b.x} y={b.y} />)}
    </>
  )
}

const COACH_KEY = 'nativity:coach-seen'
const readCoach = () => { try { return localStorage.getItem(COACH_KEY) === '1' } catch { return true } }

export default function Feed({ games, loading, error, tab, paused, onPlay, onLike, onFollow, onComments, onShare, onView, onRetry, onFindFresh }) {
  const feedRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [coachSeen, setCoachSeen] = useState(readCoach)
  const [bursts, setBursts] = useState([])
  const seenRef = useRef(new Set())

  // Work out which card is on screen (at least 60% visible).
  useEffect(() => {
    const root = feedRef.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActiveId(e.target.dataset.id)
    }, { root, threshold: [0, 0.6] })
    root.querySelectorAll('.card').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [games])

  // New list (tab switch / refresh) -> back to the top.
  useEffect(() => { feedRef.current?.scrollTo({ top: 0 }) }, [tab])

  // A view only counts once the trailer has been on screen for 3 seconds.
  // Swiping past quickly doesn't count, so creators get honest numbers.
  useEffect(() => {
    if (!activeId || paused || seenRef.current.has(activeId)) return
    const id = activeId
    const timer = setTimeout(() => { seenRef.current.add(id); onView(id) }, 3000)
    return () => clearTimeout(timer)
  }, [activeId, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hide the "swipe up" hint after the first swipe.
  useEffect(() => {
    if (!activeId) return
    if (!coachSeen && games.length && activeId !== games[0].id) {
      setCoachSeen(true)
      try { localStorage.setItem(COACH_KEY, '1') } catch { /* ignore */ }
    }
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gestures: double-tap = like, swipe left = play.
  const down = useRef(null)
  const lastTap = useRef({ t: 0, id: null, x: 0, y: 0 })
  const onPointerDown = (e) => {
    const card = e.target.closest('.card')
    down.current = card ? { x: e.clientX, y: e.clientY, t: Date.now(), id: card.dataset.id, onButton: !!e.target.closest('button'), card } : null
  }
  const onPointerUp = (e) => {
    const d = down.current; down.current = null
    if (!d) return
    const game = games.find((g) => g.id === d.id)
    if (!game) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (dx < -70 && Math.abs(dy) < 60) { onPlay(game); return }
    if (d.onButton || Math.hypot(dx, dy) > 12 || Date.now() - d.t > 300) return
    const now = Date.now(), lt = lastTap.current
    if (lt.id === d.id && now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 40) {
      const r = d.card.getBoundingClientRect()
      const burst = { id: now, gameId: d.id, x: e.clientX - r.left, y: e.clientY - r.top }
      setBursts((b) => [...b, burst])
      setTimeout(() => setBursts((b) => b.filter((x) => x !== burst)), 850)
      if (!game.liked) onLike(game, true)
      lastTap.current = { t: 0, id: null }
    } else {
      lastTap.current = { t: now, id: d.id, x: e.clientX, y: e.clientY }
    }
  }

  let body
  if (loading && !games.length) body = <div className="empty"><p>Loading games…</p></div>
  else if (error) body = <div className="empty"><h3>Couldn’t load the feed</h3><p>{error}</p><button type="button" onClick={onRetry}>Try again</button></div>
  else if (!games.length && tab === 'following') body = <div className="empty"><h3>No one followed yet</h3><p>Follow a creator from any game and their new games will show up here first.</p><button type="button" onClick={onFindFresh}>Find fresh creators</button></div>
  else if (!games.length) body = <div className="empty"><h3>No games yet</h3><p>Be the first to upload one.</p></div>
  else body = games.map((g, i) => (
    <section key={g.id} className="card" data-id={g.id} aria-label={`${g.title} by @${g.creator.handle}`}>
      <GameCard
        game={g}
        active={!paused && activeId === g.id}
        showCoach={i === 0 && !coachSeen}
        bursts={bursts.filter((b) => b.gameId === g.id)}
        onPlay={onPlay} onLike={onLike} onFollow={onFollow} onComments={onComments} onShare={onShare}
      />
    </section>
  ))

  return (
    <div className="feed" ref={feedRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { down.current = null }}>
      {body}
    </div>
  )
}
