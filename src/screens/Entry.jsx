// Press start (Figma 13: sign in) and Onboarding (Figma 14: first visit).
import { useState } from 'react'
import { api } from '../lib/api.js'
import { STAMPS } from '../lib/activity.js'
import { MIN_AGE } from '../content/legal.js'
import Icon from '../components/Icon.jsx'
import { CloseButton, Dock, PlayButton, Stamp } from '../components/ui.jsx'


/* ---------- 13 Press start ---------- */
export function PressStart({ reason, onClose, onOpenDoc }) {
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await api.signInWithEmail(email.trim())
      if (res.sent) setSentTo(email.trim())
      else onClose() // demo mode signs in instantly
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function google() {
    setError('')
    try { await api.signInWithGoogle() } catch (err) { setError(err.message) }
  }

  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="Press start">
      <main className="screen entry">
        <div className="entry-close"><CloseButton onClick={onClose} /></div>
        <div className="shapes" aria-hidden="true"><i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /></div>
        <h1 className="h-display center">Press start</h1>
        <p className="lede center">{reason || 'Cheer, talk and join crews.'} Browsing and playing never need an account. Nativity is for adults {MIN_AGE}+: new accounts confirm their date of birth after signing in.</p>
        {sentTo ? (
          <div className="note"><b>Check your email.</b> We sent a start link to {sentTo}. Open it on this phone and you’ll come straight back here, signed in.</div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label className="field"><span>Email</span>
              <input id="auth-email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="agree">
              <input id="agree-terms" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I’m {MIN_AGE} or older and I agree to the{' '}
                <button type="button" className="link" onClick={(e) => { e.preventDefault(); onOpenDoc('terms') }}>Terms</button>{' '}and{' '}
                <button type="button" className="link" onClick={(e) => { e.preventDefault(); onOpenDoc('privacy') }}>Privacy Policy</button>.
              </span>
            </label>
            <button type="submit" className="btn primary big" disabled={busy || !agreed || !email.includes('@')}>
              {busy ? 'Sending…' : api.mode === 'demo' ? 'Start (demo)' : 'Email me a start link'}
            </button>
            {api.mode === 'live' && api.googleEnabled && (
              <>
                <div className="or"><span>or</span></div>
                <button type="button" className="btn big" disabled={!agreed} onClick={google}>Continue with Google</button>
              </>
            )}
            {api.mode === 'demo' && <p className="muted small center">Demo mode: no email is sent and your account only exists in this browser.</p>}
          </form>
        )}
        {error && <p className="err">{error}</p>}
      </main>
    </div>
  )
}

/* ---------- 14 Onboarding ---------- */
export const ONBOARD_KEY = 'nativity:onboarded'
export const MOODS_KEY = 'nativity:moods'

export function Onboarding({ onDone }) {
  const [i, setI] = useState(0)
  const [moods, setMoods] = useState([])
  const finish = () => {
    try { localStorage.setItem(ONBOARD_KEY, '1'); if (moods.length) localStorage.setItem(MOODS_KEY, JSON.stringify(moods)) } catch { /* ignore */ }
    onDone(moods)
  }
  const slides = [
    {
      art: (
        <div className="ob-art deck">
          <span className="c c1" /><span className="c c2" /><span className="c c3"><Icon name="play" size={36} /></span>
          <span className="swipe-hint"><Icon name="back" size={20} />swipe</span>
        </div>
      ),
      title: 'Tiny games, one swipe apart',
      body: 'Swipe sideways through trailers. Tap PLAY and the game opens right there, no install.',
      next: 'Next: cheer',
    },
    {
      art: (
        <div className="ob-art stamps">
          <span className="ob-game"><i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><i className="b5" /></span>
          <span className="st st1"><Stamp k="pretty" state="stamped" /></span>
          <span className="st st2"><Stamp k="clever" state="stamped" /></span>
          <span className="st st3"><Stamp k="tough" state="stamped" /></span>
          <span className="st st4"><Stamp k="fun" state="stamped" /></span>
          <span className="st st5"><Stamp k="more" state="stamped" /></span>
          <span className="ob-cheer"><Icon name="cheer" size={28} /></span>
        </div>
      ),
      title: 'Cheer to help makers',
      body: 'After you play, tap Cheer for Fun!, or hold it to pick a stamp. Every stamp tells a new maker what worked.',
      next: 'Next: pick moods',
    },
    {
      art: (
        <div className="ob-art moods">
          <div className="stamp-row center">
            {STAMPS.map((s) => (
              <Stamp key={s.key} k={s.key} state={moods.includes(s.key) ? 'stamped' : 'unpicked'} pressed={moods.includes(s.key)}
                onClick={() => setMoods((m) => (m.includes(s.key) ? m.filter((x) => x !== s.key) : [...m, s.key]))} />
            ))}
          </div>
        </div>
      ),
      title: 'What are you in the mood for?',
      body: 'Pick any. Shelves will keep a row of games players stamped the same way.',
      next: 'Start playing',
    },
  ]
  const s = slides[i]
  return (
    <div className="overlay screen-overlay" role="dialog" aria-modal="true" aria-label="Welcome to Nativity">
      <main className="screen entry onboarding">
        <div className="ob-dots" aria-hidden="true">{slides.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <div className="ob-card">{s.art}</div>
        <h1 className="h-1 center">{s.title}</h1>
        <p className="lede center">{s.body}</p>
        <Dock label="Onboarding">
          <button type="button" className="skip" onClick={finish}>Skip</button>
          <PlayButton icon="chevron" label={s.next} wide onClick={() => (i < slides.length - 1 ? setI(i + 1) : finish())} />
        </Dock>
      </main>
    </div>
  )
}
