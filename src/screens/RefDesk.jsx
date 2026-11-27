// Ref desk (Figma 15): moderators review reports. The database refuses these
// actions for everyone else, so hiding this screen is for tidiness, not security.
import { useState } from 'react'
import { timeAgo } from '../lib/api.js'
import { ageFrom, formatDob } from '../lib/age.js'
import { countryName } from './Age.jsx'
import { REASONS } from '../content/legal.js'
import Icon from '../components/Icon.jsx'

const reasonLabel = Object.fromEntries(REASONS)
const ago = (iso) => { const t = timeAgo(iso); return t === 'now' ? 'just now' : `${t} ago` }

// Deadlines from the IT Rules 2021 (as amended in 2026), counted from the first report.
const H = 3600e3
function deadline(it) {
  const reasons = it.reports.map((r) => r.reason)
  const first = Math.min(...it.reports.map((r) => new Date(r.createdAt).getTime()))
  const hours = reasons.includes('intimate') ? 2 : reasons.some((r) => r !== 'spam' && r !== 'other') ? 36 : 7 * 24
  const left = first + hours * H - Date.now()
  const fmt = (ms) => (ms >= 48 * H ? `${Math.round(ms / (24 * H))} days` : ms >= H ? `${Math.round(ms / H)} h` : `${Math.max(1, Math.round(ms / 60e3))} min`)
  return { urgent: hours === 2, overdue: left < 0, text: left < 0 ? `Overdue by ${fmt(-left)}` : `Resolve within ${fmt(left)}` }
}

function Corrections({ items, busy, onReview }) {
  const [notes, setNotes] = useState({})
  if (!items?.length) return null
  return (
    <section className="stack">
      <h2 className="h-3">Date-of-birth corrections</h2>
      <p className="muted small">Approve only if you’re satisfied the new date is right. You may email the person first. Never ask for or store ID documents in the app.</p>
      {items.map((c) => (
        <div className="ref-card" key={c.id}>
          <div className="ref-pills"><span className="rpill">@{c.handle}</span><span className="rpill">{ago(c.created_at)}</span></div>
          <p className="small">On record: <b>{c.current_status === 'adult' ? formatDob(c.current_dob) : c.current_status === 'ineligible' ? 'under 18 (date not stored)' : c.current_status}</b></p>
          <p className="small">Asks for: <b>{formatDob(c.requested_dob)}</b> (age {ageFrom(c.requested_dob)})</p>
          <p className="quote">“{c.reason}”</p>
          <input className="ref-note" type="text" maxLength={300} placeholder="Note to the person (optional)" value={notes[c.id] || ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
          <div className="ref-actions">
            <button type="button" className="btn primary" disabled={busy === c.id} onClick={() => onReview(c, true, notes[c.id] || '')}>Approve</button>
            <button type="button" className="btn" disabled={busy === c.id} onClick={() => onReview(c, false, notes[c.id] || '')}>Reject</button>
          </div>
        </div>
      ))}
    </section>
  )
}

function ResidencyQueue({ items, busy, onReview }) {
  const [notes, setNotes] = useState({})
  if (!items?.length) return null
  return (
    <section className="stack">
      <h2 className="h-3">Residency reviews</h2>
      <p className="muted small">Residency means where someone normally lives, not nationality. A foreign connection alone is not a reason to reject (people travel and use VPNs). Email the person if you need more information. Never ask for Aadhaar or other ID documents.</p>
      {items.map((v) => (
        <div className="ref-card" key={v.id}>
          <div className="ref-pills"><span className="rpill">@{v.handle}</span><span className="rpill">{ago(v.created_at)}</span><span className="rpill">{v.declared_india === false ? 'first said outside India' : 'said India'}</span></div>
          <p className="small">Connection appeared to be in: <b>{countryName(v.signal_country)}</b></p>
          {v.note ? <p className="quote">“{v.note}”</p> : <p className="muted small">No note yet.</p>}
          <input className="ref-note" type="text" maxLength={300} placeholder="Note to the person (optional)" value={notes[v.id] || ''} onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })} />
          <div className="ref-actions">
            <button type="button" className="btn primary" disabled={busy === v.id} onClick={() => onReview(v, true, notes[v.id] || '')}>Lives in India</button>
            <button type="button" className="btn" disabled={busy === v.id} onClick={() => onReview(v, false, notes[v.id] || '')}>Outside India</button>
          </div>
        </div>
      ))}
    </section>
  )
}

export default function RefDesk({ items, error, busy, onAct, corrections, onReviewCorrection, residencyReviews, onReviewResidency }) {
  return (
    <main className="screen" aria-label="Ref desk">
      <div className="title-row">
        <h1 className="h-display page-title">Ref desk</h1>
        {items && <span className="open-pill"><i />{items.length} open</span>}
      </div>
      {error && <p className="err">{error}</p>}
      {!items && !error && <p className="muted">Loading…</p>}
      <ResidencyQueue items={residencyReviews} busy={busy} onReview={onReviewResidency} />
      <Corrections items={corrections} busy={busy} onReview={onReviewCorrection} />
      {items && !items.length && <div className="note"><b>All clear.</b> There are no open reports.</div>}
      <div className="stack">
        {items?.map((it) => {
          const key = it.type + it.id
          const label = it.type === 'game' ? 'game' : 'comment'
          const off = busy === key
          const due = deadline(it)
          return (
            <section className={`ref-card${due.urgent ? ' urgent' : ''}`} key={key} id={`ref-${key}`}>
              <span className={`due${due.overdue ? ' over' : ''}`}>{due.urgent && <Icon name="warn" size={14} />}{due.text}</span>
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
