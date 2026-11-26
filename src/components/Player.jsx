import { useEffect, useRef, useState } from 'react'
import { createRunner } from '../games/engine.js'
import { BUILTIN_GAMES } from '../games/builtin.js'
import { api } from '../lib/api.js'
import FrameGame from './FrameGame.jsx'
import { CloseIcon, CommentIcon, HeartIcon } from './Icons.jsx'

const FEEDBACK = ['Fun', 'Too hard', 'Too easy', 'Confusing controls', 'Great visuals', 'Want more levels']

// Full-screen play mode. While it's open the feed is covered, so swipes go to the game.
// Built-in demo games draw on a canvas; uploaded games run in a sandboxed frame.
export default function Player({ game, user, onClose, onLike, onFollow, onComments, onPlayed, onFeedback, onNeedSignIn }) {
  const uploaded = !game.builtinKey
  const canvasRef = useRef(null)
  const runnerRef = useRef(null)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(null) // { score: number|null, prevBest }
  const [runKey, setRunKey] = useState(0)
  const [chips, setChips] = useState([])
  const [sentChips, setSentChips] = useState(null)
  const [sending, setSending] = useState(false)
  const sessionBest = useRef(0)

  const onPlayedRef = useRef(onPlayed)
  useEffect(() => { onPlayedRef.current = onPlayed })

  // Called when a round ends (score may be null if the game doesn't report one).
  async function finishRound(sc) {
    let prevBest = 0
    if (sc !== null) {
      prevBest = await onPlayedRef.current(game, sc).catch(() => null)
      if (prevBest === null) prevBest = sessionBest.current // signed out: this visit only
      sessionBest.current = Math.max(sessionBest.current, sc)
      setScore(sc)
    }
    setOver({ score: sc, prevBest })
  }
  const finishRef = useRef(finishRound)
  useEffect(() => { finishRef.current = finishRound })

  // Built-in canvas games.
  useEffect(() => {
    const factory = BUILTIN_GAMES[game.builtinKey]
    if (!factory) return
    const r = createRunner(canvasRef.current, factory, 'play', {
      onScore: setScore,
      onOver: (sc) => setTimeout(() => finishRef.current(sc), 450),
    })
    r.start()
    runnerRef.current = r
    return () => r.destroy()
  }, [game.id, game.builtinKey])

  // Tell the ranking that someone tapped Play (guests count too).
  useEffect(() => { api.recordPlayStart(game.id).catch(() => {}) }, [game.id])

  useEffect(() => {
    if (!user) return
    api.getMyFeedback(game.id).then((tags) => { if (tags) { setChips(tags); setSentChips(tags) } }).catch(() => {})
  }, [game.id, user])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleChip = (f) => setChips((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]))
  const unchanged = sentChips && chips.length === sentChips.length && chips.every((c) => sentChips.includes(c))

  async function send() {
    if (!user) { onNeedSignIn('Sign in to send feedback to creators.'); return }
    setSending(true)
    const ok = await onFeedback(game, chips)
    setSending(false)
    if (ok) setSentChips(chips)
  }

  function again() {
    setOver(null); setScore(0)
    api.recordPlayStart(game.id).catch(() => {})
    if (uploaded) setRunKey((k) => k + 1)
    else runnerRef.current?.restart()
  }

  const hasScore = over && over.score !== null
  const best = hasScore ? Math.max(over.score, over.prevBest) : 0
  const isNewBest = hasScore && over.prevBest > 0 && over.score > over.prevBest

  return (
    <section className={`player${uploaded ? ' framed' : ''}`} aria-label={`${game.title} player`}>
      {uploaded
        ? <FrameGame game={game} runKey={runKey} onGameOver={(sc) => finishRef.current(sc)} />
        : <canvas ref={canvasRef} aria-label={`${game.title} game`} />}

      <div className="p-head">
        <button type="button" className="p-close" aria-label="Back to feed" onClick={onClose}><CloseIcon /></button>
        <div className="p-title"><b>{game.title}</b><small>by @{game.creator.handle}</small></div>
        {uploaded
          ? <button type="button" className="p-rate" onClick={() => setOver((o) => o || { score: null, prevBest: 0 })}>Rate</button>
          : <span className="p-score">{score}</span>}
      </div>

      {over && (
        <div className="p-over">
          {hasScore ? (
            <div className="p-res">
              <div><div className="lbl">Your score</div><div className="big">{over.score}</div></div>
              <div className="best">{isNewBest ? 'New best!' : 'Best'}<b>{best}</b></div>
            </div>
          ) : (
            <h4 className="p-ask">How was {game.title}?</h4>
          )}
          <div className="row">
            <button type="button" className="p-like" aria-pressed={game.liked} onClick={() => onLike(game, !game.liked)}>
              <HeartIcon /><span>{game.liked ? 'Liked' : 'Like'}</span>
            </button>
            <button type="button" className="p-like" onClick={() => onComments(game)}><CommentIcon /><span>Comment</span></button>
            <button type="button" className="p-like" aria-pressed={game.following} onClick={() => onFollow(game)}>
              <span>{game.following ? 'Following' : `Follow @${game.creator.handle}`}</span>
            </button>
          </div>
          <div className="fb">
            <h4>Quick feedback for @{game.creator.handle}</h4>
            <p>{sentChips ? 'Sent. You can change it any time.' : 'Pick what fits. Only the creator sees it.'}</p>
            <div className="chips">
              {FEEDBACK.map((f) => (
                <button key={f} type="button" aria-pressed={chips.includes(f)} onClick={() => toggleChip(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" disabled={!chips.length || unchanged || sending} onClick={send}>
              {sending ? 'Sending…' : sentChips ? 'Update feedback' : 'Send feedback'}
            </button>
            {uploaded && !hasScore
              ? <button type="button" className="btn primary" onClick={() => setOver(null)}>Keep playing</button>
              : <button type="button" className="btn primary" onClick={again}>Play again</button>}
          </div>
          {!user && hasScore && <p className="hint">Sign in to save your best score.</p>}
        </div>
      )}
    </section>
  )
}
