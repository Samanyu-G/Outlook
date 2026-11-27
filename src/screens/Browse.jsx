// Find (Figma 04) and Shelves (Figma 05).
import { BOOST_VIEWS } from '../lib/api.js'
import { onShelf as isOnShelf, SHELVES, STAMPS, stampOf } from '../lib/activity.js'
import Icon from '../components/Icon.jsx'
import { CheerMeter, Stamp, Thumb } from '../components/ui.jsx'
import { Spine } from './People.jsx'

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export const matches = (g, q) => {
  q = q.trim().toLowerCase()
  if (!q) return true
  return [g.title, g.description, g.creator.handle, g.creator.name || '', ...g.tags].some((t) => t.toLowerCase().includes(q))
}

/* ---------- 04 Find ---------- */
export function Find({ games, query, setQuery, feeling, setFeeling, shelf, setShelf, showFeelings, onOpen }) {
  let list = games.filter((g) => matches(g, query) && (!shelf || isOnShelf(g, shelf)))
  if (feeling) list = list.filter((g) => g.stamps[feeling] > 0).sort((a, b) => b.stamps[feeling] - a.stamps[feeling])
  const parts = [`${list.length} result${list.length === 1 ? '' : 's'}`]
  if (feeling) parts.push(stampOf(feeling).label.replace('!', ''))
  if (shelf) parts.push(SHELVES.find((s) => s.key === shelf).label)
  return (
    <main className="screen" aria-label="Find">
      <h1 className="h-display page-title">Find</h1>
      <label className="search">
        <Icon name="find" size={20} />
        <input id="find-input" type="search" placeholder="Games, makers or #tags" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search" aria-label="Find games" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={18} /></button>}
      </label>
      {showFeelings && (
        <section>
          <h2 className="h-title">Find by feeling</h2>
          <div className="stamp-row">
            {STAMPS.map((s) => (
              <Stamp key={s.key} k={s.key} state={feeling === s.key ? 'stamped' : 'unpicked'} pressed={feeling === s.key}
                onClick={() => setFeeling(feeling === s.key ? null : s.key)} />
            ))}
          </div>
        </section>
      )}
      {shelf && (
        <button type="button" className="filter-chip" onClick={() => setShelf(null)}>
          Shelf: {SHELVES.find((s) => s.key === shelf).label}<Icon name="close" size={16} />
        </button>
      )}
      <p className="overline-mono">{parts.join(' · ')}</p>
      <div className="results">
        {list.map((g) => (
          <button type="button" className="result" key={g.id} onClick={() => onOpen(g)}>
            <Thumb game={g} />
            <span>
              <b>{g.title}</b>
              <small>@{g.creator.handle}</small>
              <CheerMeter stamps={g.stamps} />
            </span>
          </button>
        ))}
        {!list.length && <p className="muted">Nothing matches yet. Try another word or feeling.</p>}
      </div>
    </main>
  )
}

/* ---------- 05 Shelves ---------- */
const TILE = { onethumb: 'fun', arcade: 'clever', cosy: 'more', puzzle: 'pretty' }

export function Shelves({ games, moods, onOpen, onShelf, onAllFresh }) {
  // Maker of the week: the most-cheered game from the last 14 days (or ever, if none).
  const recent = games.filter((g) => Date.now() - new Date(g.createdAt).getTime() < 14 * 864e5)
  const pick = [...(recent.length ? recent : games)].sort((a, b) => b.likes - a.likes || b.players - a.players)[0]
  const fresh = games.filter((g) => g.views < BOOST_VIEWS)
  const moodPicks = moods?.length
    ? [...games].filter((g) => moods.some((m) => g.stamps[m] > 0)).sort((a, b) => moods.reduce((n, m) => n + b.stamps[m] - a.stamps[m], 0)).slice(0, 8)
    : []
  return (
    <main className="screen" aria-label="Shelves">
      <h1 className="h-display page-title">Shelves</h1>
      {pick && (
        <button type="button" className="motw" onClick={() => onOpen(pick)}>
          <Thumb game={pick} />
          <span className="motw-txt">
            <span className="overline-tag">Maker of the week</span>
            <b>{pick.title}</b>
          </span>
        </button>
      )}
      <div className="shelf-tiles">
        {SHELVES.map((s) => (
          <button type="button" key={s.key} className={`shelf-tile ${TILE[s.key]}`} onClick={() => onShelf(s.key)}>
            <b>{s.label}</b>
            <span>{plural(games.filter((g) => isOnShelf(g, s.key)).length, 'game')}</span>
          </button>
        ))}
      </div>
      {moodPicks.length > 0 && (
        <section>
          <div className="sec-h"><h2 className="h-2">For your moods</h2></div>
          <div className="row-scroll">{moodPicks.map((g) => <Spine key={g.id} game={g} onClick={() => onOpen(g)} />)}</div>
        </section>
      )}
      <section>
        <div className="sec-h">
          <h2 className="h-2">Fresh makers</h2>
          <button type="button" className="sec-link" onClick={onAllFresh}>All <Icon name="chevron" size={16} /></button>
        </div>
        <div className="row-scroll">
          {(fresh.length ? fresh : games).slice(0, 10).map((g) => <Spine key={g.id} game={g} onClick={() => onOpen(g)} />)}
        </div>
      </section>
    </main>
  )
}
