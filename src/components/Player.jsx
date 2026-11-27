import { useEffect, useRef, useState } from 'react'
import { createRunner } from '../games/engine.js'
import { BUILTIN_GAMES } from '../games/builtin.js'
import { api } from '../lib/api.js'
import { STAMPS, stampKey } from '../lib/activity.js'
import FrameGame from './FrameGame.jsx'
import Icon from './Icon.jsx'
import { CheerSlot } from './CheerSlot.jsx'
import { CloseButton, Dock, DockSlot, Stamp } from './ui.jsx'

const SOUND_KEY = 'nativity:muted'

// Playing (Figma 02). Night theme so the game's own colours stand out.
// Built-in demo games draw on a canvas; uploaded games run in a sandboxed frame.
export default function Player({ game, user, onClose, onCheer, onStampPicker, onFollow, onComments, onPlayed, onFeedback, onNeedSignIn }) {
  const uploaded = !game.builtinKey
  const canvasRef = useRef(null)
  const runnerRef = useRef(null)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(null) // { score: number|null, prevBest }
  const [runKey, setRunKey] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === '1' } catch { return false } })
  const [picked, setPicked] = useState([])
  const [sent, setSent] = useState(null)
  const [sending, setSending] = useState(false)
  const sessionBest = useRef(0)

  const onPlayedRef = useRef(onPlayed)
  useEffect(() => { onPlayedRef.current = onPlayed })

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

  useEffect(() => { api.recordPlayStart(game.id).catch(() => {}) }, [game.id])

  useEffect(() => {
    if (!user) return
    api.getMyFeedback(game.id).then((tags) => {
      if (tags) { const keys = tags.map(stampKey).filter(Boolean); setPicked(keys); setSent(keys) }
    }).catch(() => {})
  }, [game.id, user])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const r = runnerRef.current
    if (!r || over) return
    if (paused) r.stop(); else r.start()
  }, [paused, over])

  function toggleSound() {
    const m = !muted
    setMuted(m)
    try { localStorage.setItem(SOUND_KEY, m ? '1' : '0') } catch { /* ignore */ }
  }

  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  const unchanged = sent && picked.length === sent.length && picked.every((k) => sent.includes(k))
  async function send() {
    if (!user) { onNeedSignIn('Sign in to stamp games and help makers.'); return }
    setSending(true)
    const ok = await onFeedback(game, STAMPS.filter((s) => picked.includes(s.key)).map((s) => s.tag))
    setSending(false)
    if (ok) setSent(picked)
  }

  function again() {
    setOver(null); setScore(0); setPaused(false)
    api.recordPlayStart(game.id).catch(() => {})
    if (uploaded) setRunKey((k) => k + 1)
    else runnerRef.current?.restart()
  }

  const hasScore = over && over.score !== null
  const best = hasScore ? Math.max(over.score, over.prevBest) : 0
  const isNewBest = hasScore && over.prevBest > 0 && over.score > over.prevBest

  return (
    <section className="player night" aria-label={`${game.title} player`}>
      <div className="p-head">
        <CloseButton onClick={onClose} label="Exit game" />
        <div className="p-title"><b>{game.title}</b><small>by @{game.creator.handle}</small></div>
        {uploaded
          ? <button type="button" className="p-score rate" onClick={() => setOver((o) => o || { score: null, prevBest: 0 })}>Rate</button>
          : <span className="p-score">{score}</span>}
      </div>

      <div className="p-stage">
        {uploaded
          ? <FrameGame game={game} runKey={runKey} paused={paused} muted={muted} onGameOver={(sc) => finishRef.current(sc)} />
          : <canvas ref={canvasRef} aria-label={`${game.title} game`} />}
        {uploaded && !over && <span className="sandbox-pill"><i />Sandboxed · can’t see your account</span>}
        {paused && !over && (
          <button type="button" className="paused" onClick={() => setPaused(false)}>
            <span><Icon name="play" size={32} /></span><b>Paused</b><small>Tap to keep playing</small>
          </button>
        )}
      </div>

      {over && (
        <div className="p-over">
          {hasScore ? (
            <div className="p-res">
              <div><div className="lbl">Your score</div><div className="big">{over.score}</div></div>
              <div className="best">{isNewBest ? 'New best!' : 'Best'}<b>{best}</b></div>
            </div>
          ) : <h4 className="p-ask">How was {game.title}?</h4>}
          <div className="fb">
            <h4>Stamp it for @{game.creator.handle}</h4>
            <p>{sent ? 'Stamped. You can change it any time.' : 'Pick what fits. It helps a new maker know what worked.'}</p>
            <div className="stamp-row">
              {STAMPS.map((s) => <Stamp key={s.key} k={s.key} state={picked.includes(s.key) ? 'stamped' : 'unpicked'} pressed={picked.includes(s.key)} onClick={() => toggle(s.key)} />)}
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" disabled={!picked.length || unchanged || sending} onClick={send}>
              {sending ? 'Stamping…' : sent ? 'Update stamps' : 'Send stamps'}
            </button>
            {uploaded && !hasScore
              ? <button type="button" className="btn primary" onClick={() => setOver(null)}>Keep playing</button>
              : <button type="button" className="btn primary" onClick={again}>Play again</button>}
          </div>
          <button type="button" className="btn ghost" aria-pressed={game.following} onClick={() => onFollow(game)}>
            <Icon name={game.following ? 'check' : 'crew'} size={18} />{game.following ? `In @${game.creator.handle}’s crew` : `Join @${game.creator.handle}’s crew`}
          </button>
          {!user && hasScore && <p className="hint">Sign in to save your best score.</p>}
        </div>
      )}

      <Dock night label="Game controls">
        <DockSlot icon="back" label="Exit" onClick={onClose} />
        <DockSlot icon={paused ? 'play' : 'pause'} label={paused ? 'Resume' : 'Pause'} selected={paused} disabled={!!over} onClick={() => setPaused((p) => !p)} />
        <CheerSlot game={game} onCheer={onCheer} onHold={onStampPicker} />
        <DockSlot icon="talk" label="Talk" onClick={() => { setPaused(true); onComments(game) }} />
        <DockSlot icon="sound" label={muted ? 'Muted' : 'Sound'} selected={muted} onClick={toggleSound} />
      </Dock>
    </section>
  )
}
