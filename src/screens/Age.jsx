// Adults-only screens: the 18+ check for visitors, the date-of-birth and consent step
// after sign-in, the "not for you" screens, date-of-birth corrections and the rules reminder.
// The database enforces all of this too (0008_adults_only.sql); these screens explain it.
import { useState } from 'react'
import { api } from '../lib/api.js'
import { ageFrom, formatDob, MIN_AGE, todayIST, validDob } from '../lib/age.js'
import { CONTACT_EMAIL, GRIEVANCE_OFFICER, NOT_IN_INDIA_MESSAGE, PRIVACY_VERSION, RULES, TERMS_VERSION } from '../content/legal.js'
import Icon from '../components/Icon.jsx'
import Sheet from '../components/Sheet.jsx'

export const ADULT_KEY = 'nativity:adult-declared'
export const UNDERAGE_KEY = 'nativity:underage'
export const OUTSIDE_KEY = 'nativity:outside-india'

export const countryName = (code) => { try { return code ? new Intl.DisplayNames(['en'], { type: 'region' }).of(code) : 'an unknown location' } catch { return code || 'an unknown location' } }

const maxDob = () => { const t = todayIST(); return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}` }

function DocLinks({ onOpenDoc }) {
  return (
    <>
      <button type="button" className="link" onClick={(e) => { e.preventDefault(); onOpenDoc('terms') }}>Terms of Service</button>{' '}and{' '}
      <button type="button" className="link" onClick={(e) => { e.preventDefault(); onOpenDoc('privacy') }}>Privacy Policy</button>
    </>
  )
}

/* ---------- Visitors: confirm 18+ and India before anything is tracked ---------- */
export function AgeDeclaration({ onAdult, onUnder, onOutside, onOpenDoc }) {
  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="Adults in India only">
      <main className="screen entry age-gate">
        <div className="age-badge" aria-hidden="true"><b>18+</b></div>
        <h1 className="h-display center">Adults in India</h1>
        <p className="lede center">Nativity is currently available only to people aged {MIN_AGE} and over who live in India. Please confirm both to continue.</p>
        <div className="stack">
          <button type="button" className="btn primary big" onClick={onAdult}>I’m {MIN_AGE}+ and I live in India</button>
          <button type="button" className="btn big" onClick={onUnder}>I’m under {MIN_AGE}</button>
          <button type="button" className="btn big" onClick={onOutside}>I live outside India</button>
        </div>
        <p className="muted small center">“Live in India” means India is where you normally live, whatever your nationality. Travelling abroad for now? You still live in India. By continuing you agree to our <DocLinks onOpenDoc={onOpenDoc} />. We don’t create any ID for you until you confirm.</p>
      </main>
    </div>
  )
}

export function NotForYou({ reason = 'age', onBack }) {
  const country = reason === 'country'
  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label={country ? 'Only available in India' : 'Nativity is for adults'}>
      <main className="screen entry age-gate">
        <div className="age-badge no" aria-hidden="true"><b>{country ? 'IN' : '18+'}</b></div>
        <h1 className="h-1 center">{country ? 'Only available in India' : 'Nativity is for adults'}</h1>
        <p className="lede center">{country ? NOT_IN_INDIA_MESSAGE : `Sorry, you need to be ${MIN_AGE} or older to use Nativity.`} Nothing about you was sent to us.</p>
        {country && <p className="muted small center">Think this is wrong? Contact {GRIEVANCE_OFFICER.name}, our Grievance Officer: {CONTACT_EMAIL}</p>}
        <button type="button" className="btn ghost" onClick={onBack}>I made a mistake</button>
      </main>
    </div>
  )
}

/* ---------- Members: date of birth (once) and the current Terms and Privacy Policy ---------- */
export function AccountGate({ state, onDone, onIneligible, onResidency, onSignOut, onOpenDoc, onLater }) {
  const needsDob = !state.ageStatus
  const needsResidency = !state.residencyStatus
  const [india, setIndia] = useState(false)
  const [outside, setOutside] = useState(false)
  const needsConsent = state.accepted.terms !== state.current.terms || state.accepted.privacy !== state.current.privacy
  const [dob, setDob] = useState('')
  const [agree, setAgree] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dobOk = validDob(dob)

  async function submit() {
    setBusy(true); setError('')
    try {
      if (needsConsent) {
        await api.acceptPolicies(state.current.terms || TERMS_VERSION, state.current.privacy || PRIVACY_VERSION)
        api.ackRulesNotice().catch(() => {}) // they just read the rules here
      }
      if (needsDob) {
        const result = await api.confirmBirthDate(dob)
        if (result === 'ineligible') { onIneligible(); return }
      }
      if (needsResidency) {
        const result = await api.confirmResidency(!outside)
        if (result !== 'resident') { onResidency(result); return }
      }
      onDone()
    } catch (e) { setError(e.message); setConfirming(false) } finally { setBusy(false) }
  }

  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="Finish setting up your account">
      <main className="screen entry">
        <h1 className="h-1">{needsDob || needsResidency ? 'One last step' : 'We’ve updated our terms'}</h1>
        <p className="lede">
          {needsDob || needsResidency
            ? `Nativity is currently available only to adults (${MIN_AGE}+) who live in India. We check this once, on our servers, before you can cheer, talk or upload.`
            : 'Please read and accept the new versions before you post again. You can keep browsing and playing either way.'}
        </p>

        {needsDob && !confirming && (
          <label className="field">
            <span>Date of birth</span>
            <input id="dob" type="date" required min="1900-01-01" max={maxDob()} value={dob} onChange={(e) => setDob(e.target.value)} />
            <small>Only you can see it. It can’t be edited later: corrections are reviewed by a moderator.</small>
            {dob && !dobOk && <span className="err">Enter a real date of birth.</span>}
          </label>
        )}
        {needsDob && confirming && (
          <div className="note">
            <b>Is this right?</b> {formatDob(dob)} (age {ageFrom(dob)}). You won’t be able to change it yourself.
          </div>
        )}

        {needsResidency && !outside && (
          <div className="field">
            <span>Country of residence</span>
            <select id="country" value="IN" disabled aria-describedby="country-help"><option value="IN">India</option></select>
            <label className="agree">
              <input id="live-in-india" type="checkbox" checked={india} onChange={(e) => setIndia(e.target.checked)} />
              <span>I live in India. (Where you normally live, not your nationality. Travelling abroad for now still counts.)</span>
            </label>
            <small id="country-help">We also check which country your connection appears to be in. We keep only the country code, never your IP address or location. <button type="button" className="link" onClick={() => { setOutside(true); setIndia(false) }}>I live outside India</button></small>
          </div>
        )}
        {needsResidency && outside && (
          <div className="note warn-note">
            <b>{NOT_IN_INDIA_MESSAGE}</b> If you continue, this account can’t be used.{' '}
            <button type="button" className="link" onClick={() => setOutside(false)}>Actually, I live in India</button>
          </div>
        )}

        {needsConsent && (
          <>
            <ul className="rules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
            <label className="agree">
              <input id="agree-terms" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I’m {MIN_AGE} or older and I agree to the <DocLinks onOpenDoc={onOpenDoc} /> (version {state.current.terms || TERMS_VERSION}).</span>
            </label>
          </>
        )}

        {error && <p className="err">{error}</p>}
        {needsDob && !confirming
          ? <button type="button" className="btn primary big" disabled={!dobOk || (needsConsent && !agree) || (needsResidency && !outside && !india)} onClick={() => setConfirming(true)}>Continue</button>
          : (
            <div className="row">
              {needsDob && <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(false)}>Change</button>}
              <button type="button" className="btn primary big" disabled={busy || (needsConsent && !agree) || (needsResidency && !outside && !india)} onClick={submit}>{busy ? 'Saving…' : needsDob ? 'Yes, that’s right' : needsResidency ? 'Continue' : 'Accept and continue'}</button>
            </div>
          )}
        {!needsDob && onLater
          ? <button type="button" className="btn ghost" onClick={onLater}>Not now (keep browsing)</button>
          : <button type="button" className="btn ghost" onClick={onSignOut}>Sign out instead</button>}
      </main>
    </div>
  )
}

/* ---------- Members found to be under 18 ---------- */
export function IneligibleAccount({ state, onCorrection, onDelete, onSignOut }) {
  const pending = state?.correction?.status === 'pending'
  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="This account can’t be used">
      <main className="screen entry age-gate">
        <div className="age-badge no" aria-hidden="true"><b>18+</b></div>
        <h1 className="h-1 center">Nativity is for adults</h1>
        <p className="lede center">
          The date of birth on this account shows you’re under {MIN_AGE}, so it can’t be used. We didn’t keep your date of birth, and we’ve removed your activity.
          {' '}The account will be deleted, or you can delete it now.
        </p>
        {pending && <div className="note"><b>Correction under review.</b> A moderator will look at it and may email you.</div>}
        <div className="stack">
          <button type="button" className="btn danger big" onClick={onDelete}>Delete my account now</button>
          {!pending && <button type="button" className="btn" onClick={onCorrection}>I entered the wrong date</button>}
          <button type="button" className="btn ghost" onClick={onSignOut}>Sign out</button>
        </div>
        <p className="muted small center">Questions? {GRIEVANCE_OFFICER.name}, Grievance Officer · {CONTACT_EMAIL}</p>
      </main>
    </div>
  )
}

/* ---------- Residency waiting for review (travelling, VPN, unclear location) ---------- */
function ReviewNote({ pending, onRequest }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  async function send() {
    setBusy(true); setError('')
    try { await onRequest(note); setSent(true) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  if (sent) return <div className="note"><b>Sent.</b> A moderator will review it, usually within 7 days, and may email you.</div>
  return (
    <div className="stack">
      <label className="field"><span>{pending ? 'Add a note for the reviewer' : 'Ask a person to review it'}</span>
        <textarea id="residency-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: I live in Pune and I’m on a work trip to Dubai until March." />
        <small>Don’t include ID numbers or documents. At least 10 characters.</small>
      </label>
      {error && <p className="err">{error}</p>}
      <button type="button" className="btn" disabled={busy || note.trim().length < 10} onClick={send}>{busy ? 'Sending…' : 'Send for review'}</button>
    </div>
  )
}

export function ResidencyPending({ state, onCheckAgain, onRequest, onDelete, onSignOut }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const pending = state?.residencyReview?.status === 'pending'
  async function check() {
    setBusy(true); setMsg('')
    try { const r = await onCheckAgain(); if (r !== 'resident') setMsg(`Your connection still appears to be in ${countryName(state.connectionCountry)}.`) } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="We need to confirm you live in India">
      <main className="screen entry age-gate">
        <div className="age-badge no" aria-hidden="true"><b>IN</b></div>
        <h1 className="h-1 center">Almost there</h1>
        <p className="lede center">You told us you live in India, but your connection appears to be in {countryName(state?.residencySignal)}. That happens when you’re travelling, using a VPN, or when location data is wrong. It doesn’t prove anything either way.</p>
        <div className="stack">
          <button type="button" className="btn primary big" disabled={busy} onClick={check}>{busy ? 'Checking…' : 'Check again'}</button>
          <p className="muted small center">Turn off any VPN, or try again once you’re back in India.</p>
          {msg && <p className="err center">{msg}</p>}
        </div>
        {pending && <div className="note"><b>Review requested.</b> A moderator will look at it and may email you.</div>}
        <ReviewNote pending={pending} onRequest={onRequest} />
        <div className="row">
          <button type="button" className="btn ghost" onClick={onSignOut}>Sign out</button>
          <button type="button" className="btn ghost-danger" onClick={onDelete}>Delete account</button>
        </div>
        <p className="muted small center">Help: {GRIEVANCE_OFFICER.name}, Grievance Officer · {CONTACT_EMAIL}</p>
      </main>
    </div>
  )
}

/* ---------- Recorded as living outside India ---------- */
export function NotResidentAccount({ onRequest, onDelete, onSignOut }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="Only available in India">
      <main className="screen entry age-gate">
        <div className="age-badge no" aria-hidden="true"><b>IN</b></div>
        <h1 className="h-1 center">Only available in India</h1>
        <p className="lede center">{NOT_IN_INDIA_MESSAGE}</p>
        <p className="muted center">This account can’t be used, and we’ve removed its activity. It will be deleted, or you can delete it now.</p>
        <div className="stack">
          <button type="button" className="btn danger big" onClick={onDelete}>Delete my account now</button>
          {!asking && <button type="button" className="btn" onClick={() => setAsking(true)}>I live in India: ask for a review</button>}
          {asking && <ReviewNote pending={false} onRequest={onRequest} />}
          <button type="button" className="btn ghost" onClick={onSignOut}>Sign out</button>
        </div>
        <p className="muted small center">Classified wrongly? Contact {GRIEVANCE_OFFICER.name}, Grievance Officer · {CONTACT_EMAIL}</p>
      </main>
    </div>
  )
}

/* ---------- Options: your date of birth and corrections ---------- */
export function DobSheet({ state, onClose, onChanged, toast }) {
  const [dob, setDob] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const c = state?.correction
  const pending = c?.status === 'pending'
  async function send(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await api.requestDobCorrection(dob, reason); toast('Correction sent for review'); onChanged() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <Sheet title="Date of birth" onClose={onClose}>
      <div className="group">
        <div className="orow"><span>On record</span><em>{state?.birthDate ? formatDob(state.birthDate) : state?.ageStatus === 'ineligible' ? 'Under 18 (not stored)' : state?.ageStatus === 'operator' ? 'Team account' : 'Not confirmed'}</em></div>
      </div>
      <p className="muted small">Only you can see this. To change it, a moderator reviews your request. We don’t ask for ID documents; we may email you if we need more information.</p>
      {c && (
        <div className={`note${c.status === 'rejected' ? ' warn-note' : ''}`}>
          <b>Last request: {c.status}.</b> You asked for {formatDob(c.requested_dob)}.{c.note ? ` Moderator: “${c.note}”` : ''}
        </div>
      )}
      {!pending && (state?.ageStatus === 'adult' || state?.ageStatus === 'ineligible') && (
        <form className="stack" onSubmit={send}>
          <label className="field"><span>Correct date of birth</span>
            <input id="dob-fix" type="date" required min="1900-01-01" max={maxDob()} value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <label className="field"><span>What happened?</span>
            <textarea id="dob-reason" rows={2} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: I picked the wrong year by mistake." />
            <small>At least 10 characters. Up to 2 requests a year.</small>
          </label>
          {error && <p className="err">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy || !validDob(dob) || reason.trim().length < 10}>{busy ? 'Sending…' : 'Request correction'}</button>
        </form>
      )}
    </Sheet>
  )
}

/* ---------- Every 3 months: remind members of the rules (IT Rules 3(1)(c)) ---------- */
export function RulesReminder({ onClose, onOpenDoc }) {
  return (
    <Sheet title="A quick reminder" onClose={onClose}>
      <p>Thanks for being part of Nativity. Every few months we remind everyone of our rules:</p>
      <ul className="rules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="muted small">Breaking them can mean content removal or account suspension, and serious cases may be reported to the authorities. Read the full <DocLinks onOpenDoc={onOpenDoc} />.</p>
      <button type="button" className="btn primary" onClick={onClose}><Icon name="check" size={18} />Got it</button>
    </Sheet>
  )
}
