import { useEffect, useRef, useState } from 'react'
import { createRunner } from '../games/engine.js'
import { BUILTIN_GAMES } from '../games/builtin.js'
import { api } from '../lib/api.js'
import { CloseIcon, CommentIcon, HeartIcon } from './Icons.jsx'

const FEEDBACK = ['Fun', 'Too hard', 'Too easy', 'Confusing controls', 'Great visuals', 'Want more levels']

// Full-screen play mode. While it's open the feed is covered, so swipes go to the game.
export default function Player({ game, user, onClose, onLike, onFollow, onComments, onPlayed, onFeedback, onNeedSignIn }) {
  const canvasRef = useRef(null)
  const runnerRef = useRef(null)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(null) // { score, prevBest }
  const [chips, setChips] = useState([])
  const [sentChips, setSentChips] = useState(null)
  const [sending, setSending] = useState(false)
  const sessionBest = useRef(0)

  // Keep the latest callback in a ref so the game loop never calls a stale one.
  const onPlayedRef = useRef(onPlayed)
  useEffect(() => { onPlayedRef.current = onPlayed })

  useEffect(() => {
    const factory = BUILTIN_GAMES[game.builtinKey]
    if (!factory) return
    const r = createRunner(canvasRef.current, factory, 'play', {
      onScore: setScore,
      onOver: (sc) => {
        setTimeout(async () => {
          let prevBest = await onPlayedRef.current(game, sc).catch(() => null)
          if (prevBest === null) { prevBest = sessionBest.current } // signed out: remember for this visit only
          sessionBest.current = Math.max(sessionBest.current, sc)
          setOver({ score: sc, prevBest })
        }, 450)
      },
    })
    r.start()
    runnerRef.current = r
    return () => r.destroy()
  }, [game.id, game.builtinKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load feedback you already gave this game, so chips show as selected.
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
    runnerRef.current?.restart()
  }

  const best = over ? Math.max(over.score, over.prevBest) : 0
  const isNewBest = over && over.prevBest > 0 && over.score > over.prevBest

  return (
    <section className="player" aria-label={`${game.title} player`}>
      <canvas ref={canvasRef} aria-label={`${game.title} game`} />
      <div className="p-head">
        <button type="button" className="p-close" aria-label="Back to feed" onClick={onClose}><CloseIcon /></button>
        <div className="p-title"><b>{game.title}</b><small>by @{game.creator.handle}</small></div>
        <span className="p-score">{score}</span>
      </div>

      {over && (
        <div className="p-over">
          <div className="p-res">
            <div><div className="lbl">Your score</div><div className="big">{over.score}</div></div>
            <div className="best">{isNewBest ? 'New best!' : 'Best'}<b>{best}</b></div>
          </div>
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
            <button type="button" className="btn primary" onClick={again}>Play again</button>
          </div>
          {!user && <p className="hint">Sign in to save your best score.</p>}
        </div>
      )}
    </section>
  )
}
