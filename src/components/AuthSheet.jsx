import { useState } from 'react'
import { api } from '../lib/api.js'
import { TERMS_PENDING_KEY, TERMS_VERSION } from '../content/legal.js'
import Sheet from './Sheet.jsx'
import { AgeCheckbox } from './TermsGate.jsx'

// Remember the box was ticked, so the terms are recorded once the email link signs you in.
function rememberAgreement() {
  try { localStorage.setItem(TERMS_PENDING_KEY, TERMS_VERSION) } catch { /* the one-time gate will ask instead */ }
}

// Sign-in. Browsing never needs an account; liking, commenting, following and feedback do.
export default function AuthSheet({ reason, onClose, onOpenDoc }) {
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    rememberAgreement()
    try {
      const res = await api.signInWithEmail(email.trim())
      if (res.sent) setSentTo(email.trim())
      else onClose() // demo mode signs in instantly
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError('')
    rememberAgreement()
    try { await api.signInWithGoogle() } catch (err) { setError(err.message) }
  }

  return (
    <Sheet title="Join Nativity" onClose={onClose}>
      {reason && <p className="muted">{reason}</p>}
      {sentTo ? (
        <div className="note">
          <b>Check your email.</b> We sent a sign-in link to {sentTo}. Open it on this phone and you’ll come straight back here, signed in.
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input id="auth-email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <AgeCheckbox checked={agreed} onChange={setAgreed} onOpenDoc={onOpenDoc} />
          <button type="submit" className="btn primary" disabled={busy || !agreed || !email.includes('@')}>
            {busy ? 'Sending…' : api.mode === 'demo' ? 'Sign in (demo)' : 'Email me a sign-in link'}
          </button>
          {api.mode === 'live' && (
            <button type="button" className="btn" disabled={!agreed} onClick={google}>Continue with Google</button>
          )}
          {api.mode === 'demo' && (
            <p className="muted small">Demo mode: no email is sent and your account only exists in this browser.</p>
          )}
        </form>
      )}
      {error && <p className="err">{error}</p>}
    </Sheet>
  )
}
