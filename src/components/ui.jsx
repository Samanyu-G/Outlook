// Small building blocks that match the Figma component library (Components page).
import { useEffect, useRef } from 'react'
import { createRunner } from '../games/engine.js'
import { BUILTIN_GAMES } from '../games/builtin.js'
import { initials } from '../lib/api.js'
import { STAMPS, stampKey, stampOf } from '../lib/activity.js'
import Icon from './Icon.jsx'

/* ---------- Dock: the floating bar at the bottom. Its buttons change per screen. ---------- */
export function Dock({ children, night = false, label = 'Actions' }) {
  return <nav className={`dock${night ? ' night' : ''}`} aria-label={label}>{children}</nav>
}

export function DockSlot({ icon, label, onClick, selected = false, disabled = false, badge = false }) {
  return (
    <button type="button" className={`slot${selected ? ' on' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}>
      <span className="slot-ico"><Icon name={icon} />{badge && <i className="dot" aria-hidden="true" />}</span>
      <span className="slot-lbl">{label}</span>
    </button>
  )
}

// The Hub opens the menu of screens. Its three dots echo the Figma "Hub Button".
export function HubButton({ open, onClick, badge = false }) {
  return (
    <button type="button" className="hub" aria-label="Menu" aria-expanded={open} onClick={onClick}>
      <Icon name="hub" />
      <span className="hub-dots" aria-hidden="true"><i /><i /><i /></span>
      {badge && <i className="dot" aria-hidden="true" />}
    </button>
  )
}

export function PlayButton({ onClick, label = 'PLAY', icon = 'play', wide = false, disabled = false, ariaLabel }) {
  return (
    <button type="button" className={`play-btn${wide ? ' wide' : ''}`} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      <Icon name={icon} size={20} /><span>{label}</span>
    </button>
  )
}

export function BackChip({ to, onClick }) {
  return (
    <button type="button" className="back-chip" onClick={onClick} aria-label={`Back to ${to}`}>
      <Icon name="back" size={20} /><span>{to}</span>
    </button>
  )
}

export function CloseButton({ onClick, label = 'Close' }) {
  return <button type="button" className="close-btn" onClick={onClick} aria-label={label}><Icon name="close" size={20} /></button>
}

/* ---------- Identity ---------- */
export function Avatar({ name, color, size = 32, marker }) {
  return (
    <span className={`avatar s${size}`} style={{ background: color }} aria-hidden="true">
      {initials(name)}
      {marker === 'fresh' && <i className="mk fresh"><Icon name="spark" size={12} /></i>}
    </span>
  )
}

export function Badge({ kind, children }) {
  const icon = { fresh: 'spark', touch: 'touch', keys: 'keys', heat: 'rise' }[kind]
  return <span className={`badge ${kind}`}>{icon && <Icon name={icon} size={14} />}{children}</span>
}

/* ---------- Stamps ---------- */
// One stamp. "stamped" is the dashed rubber-stamp look; "chip" is the soft filled pill.
export function Stamp({ k, state = 'chip', count, onClick, pressed }) {
  const s = stampOf(k)
  if (!s) return null
  const body = <>{state === 'stamped' && <Icon name="cheer" size={16} />}<span>{s.label}{count != null && ` ${count}`}</span></>
  const cls = `stamp ${k} ${state}`
  return onClick
    ? <button type="button" className={cls} aria-pressed={pressed} onClick={onClick}>{body}</button>
    : <span className={cls}>{body}</span>
}
export const StampFromTag = ({ tag }) => {
  const k = stampKey(tag)
  return k ? <Stamp k={k} state="stamped" /> : null
}

// The cheer meter: a thin bar split by how often each stamp was given.
export function CheerMeter({ stamps = {}, wide = false }) {
  const total = STAMPS.reduce((n, s) => n + (stamps[s.key] || 0), 0)
  return (
    <span className={`meter${wide ? ' wide' : ''}`} role="img" aria-label={total ? STAMPS.map((s) => `${s.label} ${stamps[s.key] || 0}`).join(', ') : 'No stamps yet'}>
      {total
        ? STAMPS.filter((s) => stamps[s.key]).map((s) => <i key={s.key} className={s.key} style={{ flexGrow: stamps[s.key] }} />)
        : STAMPS.map((s) => <i key={s.key} className={`${s.key} blank`} />)}
    </span>
  )
}

/* ---------- Form controls ---------- */
export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <i>{checked && <Icon name="check" size={14} />}</i>
    </button>
  )
}

/* ---------- Trailers ---------- */
// The trailer playing for real (built-in games draw themselves; uploads play their video).
export function LiveTrailer({ game, active, dataSaver = false }) {
  return game.builtinKey
    ? <TrailerCanvas gameKey={game.builtinKey} active={active} />
    : <VideoTrailer src={game.trailerUrl} active={active && !dataSaver} lite={dataSaver} />
}

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

function VideoTrailer({ src, active, lite }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])
  return <video ref={ref} className="trailer" src={src ? src + '#t=0.5' : undefined} muted loop playsInline preload={active ? 'auto' : lite ? 'none' : 'metadata'} aria-hidden="true" />
}

// A still frame for lists and shelves (cheap: nothing animates).
export function Thumb({ game, className = '' }) {
  return (
    <span className={`thumb ${className}`} aria-hidden="true">
      <LiveTrailer game={game} active={false} />
    </span>
  )
}
