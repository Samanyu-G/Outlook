import { useEffect, useRef, useState } from 'react'
import { BOOST_VIEWS } from '../lib/api.js'
import Icon from './Icon.jsx'
import { BrandIcon } from './Logo.jsx'
import { Avatar, Badge, CheerMeter, LiveTrailer } from './ui.jsx'

// One game as a "cartridge card" (Figma: Cartridge Card): trailer window on top, info panel below.
function GameCard({ game, active, showCoach, dataSaver, onPlay, onFollow, onOpen, onMaker }) {
  const c = game.creator
  const [captionOpen, setCaptionOpen] = useState(false)
  return (
    <>
      <div className="window">
        <LiveTrailer game={game} active={active} dataSaver={dataSaver} />
        <button type="button" className="window-hit" onClick={() => onPlay(game)} aria-label={`Play ${game.title}`} />
        <div className="chips-top">
          <span className="chip-trailer"><i />Trailer</span>
          {game.views < BOOST_VIEWS && <Badge kind="fresh">Fresh maker</Badge>}
          {game.touchFriendly === false && <Badge kind="keys">Keyboard</Badge>}
        </div>
        {showCoach && <div className="coach">Swipe ← for the next game</div>}
      </div>

      <div className="info">
        <div className="info-h">
          <h2>{game.title}</h2>
          <button type="button" className="info-more" onClick={() => onOpen(game)} aria-label={`About ${game.title}`}><i /><i /><i /></button>
        </div>
        {/* Caption is collapsed to one line, like Instagram. Tap to expand. */}
        <button type="button" className={`caption${captionOpen ? ' open' : ''}`} aria-expanded={captionOpen} onClick={() => setCaptionOpen((o) => !o)}>
          <span className="txt">{game.description}</span>
          <span className="more">{captionOpen ? 'less' : 'more'}</span>
        </button>
        {captionOpen && game.tags.length > 0 && <div className="tags">{game.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
        <div className="who">
          <button type="button" className="who-id" onClick={() => onMaker(game)}>
            <Avatar name={c.name || c.handle} color={c.color} size={32} />
            <strong>@{c.handle}</strong>
          </button>
          <button type="button" className="join" aria-pressed={game.following} aria-label={`${game.following ? 'Leave' : 'Join'} @${c.handle}’s crew`} onClick={() => onFollow(game)}>
            <Icon name={game.following ? 'check' : 'crew'} size={16} />{game.following ? 'Joined' : 'Join'}
          </button>
          <CheerMeter stamps={game.stamps} />
        </div>
      </div>
    </>
  )
}

const COACH_KEY = 'nativity:coach-seen'
const readCoach = () => { try { return localStorage.getItem(COACH_KEY) === '1' } catch { return true } }

export default function Feed({ games, loading, error, tab, paused, autoplay = true, dataSaver = false, onActive, onPlay, onFollow, onOpen, onMaker, onView, onRetry, onFindFresh }) {
  const feedRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [coachSeen, setCoachSeen] = useState(readCoach)
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

  // Tell the app which card is centred (the Dock's Cheer / Talk / More act on it).
  useEffect(() => { onActive?.(activeId || games[0]?.id || null) }, [activeId, games]) // eslint-disable-line react-hooks/exhaustive-deps

  // New list (tab switch / refresh) -> back to the start.
  useEffect(() => { feedRef.current?.scrollTo({ left: 0 }) }, [tab])

  // A view only counts once the trailer has been on screen for 3 seconds.
  // Swiping past quickly doesn't count, so creators get honest numbers.
  useEffect(() => {
    if (!activeId || paused || seenRef.current.has(activeId)) return
    const id = activeId
    const timer = setTimeout(() => { seenRef.current.add(id); onView(id) }, 3000)
    return () => clearTimeout(timer)
  }, [activeId, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hide the "swipe" hint after the first swipe.
  useEffect(() => {
    if (!activeId) return
    if (!coachSeen && games.length && activeId !== games[0].id) {
      setCoachSeen(true)
      try { localStorage.setItem(COACH_KEY, '1') } catch { /* ignore */ }
    }
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gestures: swipe sideways = next game (native scroll). With a mouse you can
  // also drag the row, or use the wheel / arrow keys.
  const down = useRef(null)
  const dragged = useRef(false)
  const onPointerDown = (e) => {
    down.current = { x: e.clientX, mouse: e.pointerType === 'mouse', left: feedRef.current.scrollLeft }
    dragged.current = false
  }
  const onPointerMove = (e) => {
    const d = down.current
    if (!d || !d.mouse || !(e.buttons & 1)) return
    const dx = e.clientX - d.x
    if (!dragged.current && Math.abs(dx) > 6) { dragged.current = true; feedRef.current.classList.add('dragging') }
    if (dragged.current) feedRef.current.scrollLeft = d.left - dx
  }
  const endDrag = () => {
    const root = feedRef.current
    if (!root?.classList.contains('dragging')) return
    root.classList.remove('dragging')
    // Settle on the nearest card after a mouse drag.
    const cards = [...root.querySelectorAll('.card')]
    if (!cards.length) return
    const mid = root.scrollLeft + root.clientWidth / 2
    const near = cards.reduce((a, b) => (Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid) < Math.abs(a.offsetLeft + a.offsetWidth / 2 - mid) ? b : a))
    near.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
  const onPointerUp = () => { down.current = null; endDrag() }
  // A click that ends a mouse drag shouldn't press the button under the cursor.
  const onClickCapture = (e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false } }
  // Mouse wheel scrolls the row sideways; arrow keys step one card.
  const onWheel = (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) feedRef.current.scrollLeft += e.deltaY
  }
  const step = (dir) => {
    const root = feedRef.current
    const card = root?.querySelector('.card')
    if (card) root.scrollBy({ left: dir * (card.offsetWidth + 12), behavior: 'smooth' })
  }
  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea')) return
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
  }

  let body
  if (loading && !games.length) body = <div className="empty" role="status"><BrandIcon size={64} className="brand-pulse" decorative /><p>Loading games…</p></div>
  else if (error) body = <div className="empty"><BrandIcon size={48} decorative /><h3>Couldn’t load the feed</h3><p>{error}</p><button type="button" onClick={onRetry}>Try again</button></div>
  else if (!games.length && tab === 'following') body = <div className="empty"><BrandIcon size={48} decorative /><h3>Your crew is empty</h3><p>Join a maker’s crew from any game and their new games will show up here first.</p><button type="button" onClick={onFindFresh}>Find fresh creators</button></div>
  else if (!games.length) body = <div className="empty"><BrandIcon size={48} decorative /><h3>No games yet</h3><p>Be the first to upload one.</p></div>
  else body = games.map((g, i) => (
    <section key={g.id} className="card" data-id={g.id} aria-label={`${g.title} by @${g.creator.handle}`}>
      <GameCard
        game={g}
        active={autoplay && !paused && (activeId || games[0]?.id) === g.id}
        showCoach={i === 0 && !coachSeen}
        dataSaver={dataSaver}
        onPlay={onPlay} onFollow={onFollow} onOpen={onOpen} onMaker={onMaker}
      />
    </section>
  ))

  return (
    <div
      className="feed" ref={feedRef} tabIndex={-1} aria-label="Games, swipe sideways"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => { down.current = null; endDrag() }} onClickCapture={onClickCapture}
      onWheel={onWheel} onKeyDown={onKeyDown}
    >
      {body}
    </div>
  )
}
