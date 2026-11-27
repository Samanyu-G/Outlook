import { useState } from 'react'
import { api } from '../lib/api.js'
import { GRIEVANCE_OFFICER, REASONS } from '../content/legal.js'
import Sheet from './Sheet.jsx'

// Report a game or a comment. 3 reports from different people hide it until a moderator reviews it.
export default function ReportSheet({ target, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const ref = await api.report(target.type, target.id, reason, details)
      onDone(ref, reason)
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  return (
    <Sheet title={target.type === 'game' ? `Report “${target.label}”` : 'Report comment'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">What’s wrong? Reports are private: the person you report won’t see who sent them. Not signed in, or need to reach a person? Email the Grievance Officer at {GRIEVANCE_OFFICER.email}.</p>
        <div className="reasons" role="radiogroup" aria-label="Reason">
          {REASONS.map(([key, label]) => (
            <label key={key} className={`reason${reason === key ? ' on' : ''}`}>
              <input type="radio" name="report-reason" value={key} checked={reason === key} onChange={() => setReason(key)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="field"><span>More details (optional)</span>
          <textarea id="report-details" rows={2} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything that helps us understand" />
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit" className="btn primary" disabled={!reason || busy}>{busy ? 'Sending…' : 'Send report'}</button>
      </form>
    </Sheet>
  )
}
