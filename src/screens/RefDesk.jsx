// Ref desk (Figma 15): moderators review reports. The database refuses these
// actions for everyone else, so hiding this screen is for tidiness, not security.
import { timeAgo } from '../lib/api.js'
import { REASONS } from '../content/legal.js'
import Icon from '../components/Icon.jsx'

const reasonLabel = Object.fromEntries(REASONS)

export default function RefDesk({ items, error, busy, onAct }) {
  return (
    <main className="screen" aria-label="Ref desk">
      <div className="title-row">
        <h1 className="h-display page-title">Ref desk</h1>
        {items && <span className="open-pill"><i />{items.length} open</span>}
      </div>
      {error && <p className="err">{error}</p>}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && !items.length && <div className="note"><b>All clear.</b> There are no open reports.</div>}
      <div className="stack">
        {items?.map((it) => {
          const key = it.type + it.id
          const label = it.type === 'game' ? 'game' : 'comment'
          const off = busy === key
          return (
            <section className="ref-card" key={key} id={`ref-${key}`}>
              {it.type === 'game' && !it.missing ? (
                <div className="ref-h">
                  <span className="ref-thumb" aria-hidden="true" />
                  <div>
                    <b className="h-3">{it.title}</b>
                    <small>@{it.owner} · game</small>
                    <Pills it={it} />
                  </div>
                </div>
              ) : (
                <>
                  <Pills it={it} label={label} />
                  {it.missing ? <p className="muted">This {label} has been deleted.</p> : <p className="quote">“{it.body}”</p>}
                  {!it.missing && <small>@{it.owner}</small>}
                </>
              )}
              <ul className="ref-reasons">
                {it.reports.map((r) => (
                  <li key={r.id}><Icon name="flag" size={14} /><span><b>{reasonLabel[r.reason] || r.reason}</b>{r.details && ` · ${r.details}`}</span><small>@{r.by} · {timeAgo(r.createdAt)}</small></li>
                ))}
              </ul>
              <div className="ref-actions">
                {!it.missing && (it.hidden
                  ? <button type="button" className="btn danger" disabled={off} onClick={() => onAct(it, 'hide')}><Icon name="check" size={18} />Keep hidden</button>
                  : <button type="button" className="btn danger" disabled={off} onClick={() => onAct(it, 'hide')}>Hide {label}</button>)}
                {!it.missing && it.hidden && <button type="button" className="btn" disabled={off} onClick={() => onAct(it, 'restore')}>Restore</button>}
                <button type="button" className="btn ghost" disabled={off} onClick={() => onAct(it, 'dismiss')}>Dismiss</button>
                {!it.missing && it.ownerId && (
                  <button type="button" className="btn danger-soft" disabled={off} onClick={() => onAct(it, it.ownerSuspended ? 'unsuspend' : 'suspend')}>
                    {it.ownerSuspended ? `Unsuspend @${it.owner}` : `Suspend @${it.owner}`}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}

function Pills({ it, label }) {
  return (
    <div className="ref-pills">
      <span className="rpill red">{it.reports.length} report{it.reports.length === 1 ? '' : 's'}</span>
      {label && <span className="rpill">{label}</span>}
      {it.hidden && <span className="rpill">{it.type === 'game' ? 'auto-hidden' : 'hidden'}</span>}
      {it.ownerSuspended && <span className="rpill">owner suspended</span>}
    </div>
  )
}
