import { useState } from 'react'
import { MIN_AGE } from '../content/legal.js'

// Shown once to signed-in members who haven't accepted the terms yet
// (everyone who signed up before Phase 4, or anyone who skipped the checkbox).
// It can't be dismissed: it's a short, one-time step.
export default function TermsGate({ onAccept, onOpenDoc, onSignOut }) {
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    setBusy(true); setError('')
    try { await onAccept() } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Community rules">
        <div className="sheet-h"><h3>Before you continue</h3></div>
        <div className="sheet-b">
          <p>Nativity is a place for new game makers to be seen. To keep it safe and kind, everyone agrees to a few rules.</p>
          <ul className="rules">
            <li>Only upload games you made or have the right to share.</li>
            <li>Nothing sexual, hateful, violent or harmful.</li>
            <li>Criticise the game, never the person.</li>
            <li>Report anything that breaks the rules.</li>
          </ul>
          <AgeCheckbox checked={ok} onChange={setOk} onOpenDoc={onOpenDoc} />
          {error && <p className="err">{error}</p>}
          <button type="button" className="btn primary" disabled={!ok || busy} onClick={accept}>{busy ? 'Saving…' : 'Agree and continue'}</button>
          <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  )
}

export function AgeCheckbox({ checked, onChange, onOpenDoc }) {
  return (
    <label className="agree">
      <input id="agree-terms" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        I’m {MIN_AGE} or older and agree to the{' '}
        <button type="button" className="link" onClick={(e) => { e.preventDefault(); onOpenDoc('terms') }}>Terms</button>{' '}and{' '}
        <button type="button" className="link" onClick={(e) => { e.preventDefault(); onOpenDoc('privacy') }}>Privacy Policy</button>.
      </span>
    </label>
  )
}
