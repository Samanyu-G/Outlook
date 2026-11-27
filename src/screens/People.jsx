// Game details (Figma 03) and Maker profile (Figma 06).
import { useEffect, useState } from 'react'
import { api, BOOST_VIEWS, fmt, timeAgo } from '../lib/api.js'
import { makerLevel, STAMPS, stampTotal, topStamp } from '../lib/activity.js'
import Icon from '../components/Icon.jsx'
import { Avatar, BackChip, Badge, CheerMeter, LiveTrailer, Stamp, Thumb } from '../components/ui.jsx'

// Everything we know about a maker comes from their games in the catalog.
export function makerStats(games) {
  const players = games.reduce((n, g) => n + (g.players || 0), 0)
  const stamps = games.reduce((n, g) => n + stampTotal(g.stamps), 0)
  return { players, stamps, games: games.length, fresh: games.some((g) => g.views < BOOST_VIEWS), ...makerLevel(players) }
}

/* ---------- 03 Game details ---------- */
export function GameDetails({ game, backLabel, makerGames, onBack, onMaker, onFollow, onPlay, autoplay }) {
  const c = game.creator
  const m = makerStats(makerGames)
  const total = stampTotal(game.stamps)
  const top = topStamp(game.stamps)
  return (
    <main className="screen" aria-label={`${game.title} details`}>
      <div className="screen-top"><BackChip to={backLabel} onClick={onBack} /></div>
      <button type="button" className="frame-trailer" onClick={() => onPlay(game)} aria-label={`Play ${game.title}`}>
        <span className="frame-in"><LiveTrailer game={game} active={autoplay} /></span>
      </button>
      <h1 className="h-display">{game.title}</h1>
      <div className="badges">
        {game.views < BOOST_VIEWS && <Badge kind="fresh">Fresh maker</Badge>}
        {game.touchFriendly === false ? <Badge kind="keys">Keyboard</Badge> : <Badge kind="touch">Touch</Badge>}
      </div>
      {game.description && <p className="lede">{game.description}</p>}

      <div className="maker-chip">
        <button type="button" className="maker-id" onClick={() => onMaker(game)}>
          <Avatar name={c.name || c.handle} color={c.color} size={32} />
          <span><b>@{c.handle}</b><small>LV {m.level} maker · {m.games} game{m.games === 1 ? '' : 's'}</small></span>
        </button>
        <button type="button" className="crew-btn" aria-pressed={game.following} onClick={() => onFollow(game)}>
          <Icon name={game.following ? 'check' : 'crew'} size={18} />{game.following ? 'In crew' : 'Join crew'}
        </button>
      </div>

      <div className="tiles">
        <div className="tile"><b>{fmt(game.players || 0)}</b><span>players</span></div>
        <div className="tile"><b>{fmt(game.likes)}</b><span>cheers</span></div>
        <div className="tile"><b>{fmt(game.comments)}</b><span>talk</span></div>
      </div>

      <section className="felt">
        <h2 className="h-title">What players felt</h2>
        <p className="felt-sum"><Icon name="cheer" size={18} /><b>{total} stamp{total === 1 ? '' : 's'}</b>{top && <span>mostly {top.label}</span>}</p>
        <CheerMeter stamps={game.stamps} wide />
        <div className="stamp-row">
          {total
            ? STAMPS.filter((s) => game.stamps[s.key]).map((s) => <Stamp key={s.key} k={s.key} count={game.stamps[s.key]} />)
            : <p className="muted small">No stamps yet. Play it and be the first to tell @{c.handle} what worked.</p>}
        </div>
      </section>
    </main>
  )
}

/* ---------- 06 Maker profile ---------- */
export function MakerProfile({ creator, games, backLabel, following, onBack, onOpen }) {
  const [tab, setTab] = useState('shelf')
  const [notes, setNotes] = useState(null)
  const m = makerStats(games)
  useEffect(() => {
    if (tab !== 'talk' || notes) return
    api.listNotesBy(creator.id).then(setNotes).catch(() => setNotes([]))
  }, [tab, notes, creator.id])
  const target = m.next || Math.max(m.players, 1)
  return (
    <main className="screen" aria-label={`@${creator.handle}`}>
      <div className="screen-top"><BackChip to={backLabel} onClick={onBack} /></div>
      <section className="hero-card peach">
        <div className="hero-id">
          <Avatar name={creator.name || creator.handle} color={creator.color} size={72} />
          <div>
            <h1 className="h-1">{creator.name || '@' + creator.handle}</h1>
            <small>@{creator.handle}{following && ' · in your crew'}</small>
            <div className="badges col">
              <Badge kind="level">LV {m.level} maker</Badge>
              {m.fresh && <Badge kind="fresh">Fresh maker</Badge>}
            </div>
          </div>
        </div>
        {creator.bio && <p className="bio">{creator.bio}</p>}
        <div className="bars">
          <span>Plays</span><i className="bar fun"><b style={{ width: `${Math.min(100, (m.players / target) * 100)}%` }} /></i><em>{m.next ? `${m.players}/${m.next}` : m.players}</em>
          <span>Stamps</span><i className="bar clever"><b style={{ width: `${Math.min(100, (m.stamps / Math.max(m.players, 1)) * 100)}%` }} /></i><em>{m.stamps}</em>
        </div>
      </section>

      <Tabs value={tab} onChange={setTab} items={[['shelf', 'Shelf'], ['talk', 'Talk'], ['about', 'About']]} />
      {tab === 'shelf' && (
        <div className="grid2">
          {games.map((g) => <Spine key={g.id} game={g} onClick={() => onOpen(g)} />)}
          <div className="spine ghost"><Icon name="make" size={28} /><span>Next game coming</span></div>
        </div>
      )}
      {tab === 'talk' && (
        <div className="stack">
          {!notes && <p className="muted">Loading…</p>}
          {notes && !notes.length && <p className="muted">@{creator.handle} hasn’t left any notes yet.</p>}
          {notes?.map((n) => (
            <div className="note-row" key={n.id}>
              <small>On {n.gameTitle} · {timeAgo(n.createdAt)}</small>
              <p>{n.body}</p>
            </div>
          ))}
        </div>
      )}
      {tab === 'about' && (
        <div className="stack about">
          <p>{creator.bio || `@${creator.handle} hasn’t written a bio yet.`}</p>
          <dl>
            <dt>Games</dt><dd>{m.games}</dd>
            <dt>Players</dt><dd>{fmt(m.players)}</dd>
            <dt>Stamps</dt><dd>{fmt(m.stamps)}</dd>
            <dt>Makes</dt><dd>{[...new Set(games.flatMap((g) => g.tags))].slice(0, 6).map((t) => '#' + t).join(' ') || '—'}</dd>
          </dl>
        </div>
      )}
    </main>
  )
}

/* ---------- shared bits ---------- */
export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs-line" role="tablist">
      {items.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  )
}

// A game on a shelf (Figma: Cartridge Spine).
export function Spine({ game, onClick, sub }) {
  return (
    <button type="button" className="spine" onClick={onClick}>
      <Thumb game={game} />
      <b>{game.title}</b>
      {sub && <small>{sub}</small>}
    </button>
  )
}
