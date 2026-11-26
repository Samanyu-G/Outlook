import { useCallback, useEffect, useState } from 'react'
import { api, timeAgo } from '../lib/api.js'
import { REASONS } from '../content/legal.js'
import Sheet from './Sheet.jsx'

const reasonLabel = Object.fromEntries(REASONS)

// Moderators only. The database refuses these actions for everyone else,
// so hiding this screen is for tidiness, not security.
export default function ModerationSheet({ onClose, onChanged, toast }) {
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    api.listReports().then(setItems).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  async function act(item, fn, msg) {
    setBusy(item.type + item.id); setError('')
    try { await fn(); toast(msg); onChanged(); load() } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  return (
    <Sheet title="Moderation" onClose={onClose}>
      <p className="muted small">Open reports, most-reported first. Anything reported by 3 different people is already hidden until you decide.</p>
      {error && <p className="err">{error}</p>}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && !items.length && <div className="note"><b>All clear.</b> There are no open reports.</div>}
      {items?.map((it) => {
        const key = it.type + it.id
        const label = it.type === 'game' ? 'game' : 'comment'
        return (
          <div className="mod" key={key}>
            <div className="mod-h">
              <span className="pill">{it.reports.length} report{it.reports.length === 1 ? '' : 's'}</span>
              <span className="pill soft">{label}</span>
              {it.hidden && <span className="pill soft">hidden</span>}
              {it.ownerSuspended && <span className="pill soft">owner suspended</span>}
            </div>
            {it.missing ? <p className="muted">This {label} has been deleted.</p>
              : it.type === 'game' ? <p><b>{it.title}</b> by @{it.owner}</p>
              : <p>“{it.body}” <span className="muted">— @{it.owner}</span></p>}
            <ul className="mod-reasons">
              {it.reports.map((r) => (
                <li key={r.id}><b>{reasonLabel[r.reason] || r.reason}</b>{r.details && <> · {r.details}</>} <span className="muted">· @{r.by} · {timeAgo(r.createdAt)}</span></li>
              ))}
            </ul>
            <div className="mod-actions">
              {!it.missing && (it.hidden
                ? <button type="button" disabled={busy === key} onClick={() => act(it, () => api.moderate(it.type, it.id, 'restore'), `Restored the ${label}`)}>Restore</button>
                : <button type="button" className="danger" disabled={busy === key} onClick={() => act(it, () => api.moderate(it.type, it.id, 'hide'), `Hid the ${label}`)}>Hide {label}</button>)}
              <button type="button" disabled={busy === key} onClick={() => act(it, () => api.moderate(it.type, it.id, 'dismiss'), 'Reports dismissed')}>Dismiss</button>
              {!it.missing && it.ownerId && (
                <button type="button" className={it.ownerSuspended ? '' : 'danger'} disabled={busy === key}
                  onClick={() => act(it, () => api.setSuspended(it.ownerId, !it.ownerSuspended), it.ownerSuspended ? `@${it.owner} can post again` : `@${it.owner} is suspended`)}>
                  {it.ownerSuspended ? `Unsuspend @${it.owner}` : `Suspend @${it.owner}`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </Sheet>
  )
}
