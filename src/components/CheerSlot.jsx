import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { STAMPS, stampKey } from '../lib/activity.js'
import Icon from './Icon.jsx'
import Sheet from './Sheet.jsx'
import { Stamp } from './ui.jsx'

// The Dock's Cheer button. Tap = cheer (and stamp "Fun!" if you haven't stamped yet).
// Hold = pick stamps. It only shows once you've played the game.
export function CheerSlot({ game, onCheer, onHold }) {
  const timer = useRef(null)
  const held = useRef(false)
  const start = () => {
    held.current = false
    timer.current = setTimeout(() => { held.current = true; onHold(game) }, 450)
  }
  const cancel = () => clearTimeout(timer.current)
  return (
    <button
      type="button" className={`slot cheer${game.liked ? ' on' : ''}`} aria-pressed={game.liked}
      aria-label={game.liked ? 'Cheered. Hold to change stamps' : 'Cheer. Hold to pick a stamp'}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { if (!held.current) onCheer(game) }}
    >
      <span className="slot-ico"><Icon name="cheer" /></span>
      <span className="slot-lbl">{game.liked ? 'Cheered' : 'Cheer'}</span>
    </button>
  )
}

// Hold Cheer -> pick any stamps for this game.
export function StampPicker({ game, onClose, onSend }) {
  const [picked, setPicked] = useState([])
  const [sending, setSending] = useState(false)
  useEffect(() => {
    api.getMyFeedback(game.id).then((tags) => { if (tags) setPicked(tags.map(stampKey).filter(Boolean)) }).catch(() => {})
  }, [game.id])
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  return (
    <Sheet title={`Stamp ${game.title}`} onClose={onClose}>
      <p className="muted">What worked? Pick any. @{game.creator.handle} sees the totals.</p>
      <div className="stamp-row">
        {STAMPS.map((s) => <Stamp key={s.key} k={s.key} state={picked.includes(s.key) ? 'stamped' : 'unpicked'} pressed={picked.includes(s.key)} onClick={() => toggle(s.key)} />)}
      </div>
      <button type="button" className="btn primary" disabled={!picked.length || sending}
        onClick={async () => { setSending(true); const ok = await onSend(game, STAMPS.filter((s) => picked.includes(s.key)).map((s) => s.tag)); setSending(false); if (ok) onClose() }}>
        {sending ? 'Stamping…' : 'Cheer with these stamps'}
      </button>
    </Sheet>
  )
}

// The Hub menu: every top-level screen.
export function HubMenu({ current, items, onGo, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="hub-scrim" onClick={onClose}>
      <nav className="hub-menu" aria-label="Screens" onClick={(e) => e.stopPropagation()}>
        {items.map((it) => (
          <button key={it.key} type="button" aria-current={current === it.key ? 'page' : undefined} onClick={() => onGo(it.key)}>
            <span className={`hm-ico ${it.tint || ''}`}><Icon name={it.icon} size={20} />{it.badge && <i className="dot" />}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
