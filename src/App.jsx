import { useCallback, useEffect, useRef, useState } from 'react'
import { api, BOOST_VIEWS, isMember } from './lib/api.js'
import Feed from './components/Feed.jsx'
import Player from './components/Player.jsx'
import CommentsSheet from './components/CommentsSheet.jsx'
import AuthSheet from './components/AuthSheet.jsx'
import ProfileSheet from './components/ProfileSheet.jsx'
import UploadSheet from './components/UploadSheet.jsx'
import MoreSheet from './components/MoreSheet.jsx'
import ReportSheet from './components/ReportSheet.jsx'
import ModerationSheet from './components/ModerationSheet.jsx'
import LegalSheet from './components/LegalSheet.jsx'
import TermsGate from './components/TermsGate.jsx'
import { TERMS_PENDING_KEY } from './content/legal.js'
import { HomeIcon, PlusIcon, UserIcon } from './components/Icons.jsx'

const TABS = [['following', 'Following'], ['foryou', 'For You'], ['fresh', 'Fresh']]

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [tab, setTab] = useState('foryou')
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null) // { type: 'auth'|'comments'|'profile'|'upload'|'more'|'report'|'moderation', ... }
  const [doc, setDoc] = useState(null)       // 'terms' | 'privacy' (shown on top of any sheet)
  const [needTerms, setNeedTerms] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef(null)
  // Guests have a session (so their views count) but act as signed out everywhere else.
  const member = isMember(user) ? user : null

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200)
  }, [])

  /* ---------- auth ---------- */
  useEffect(() => {
    api.getUser().then((u) => { setUser(u); setAuthReady(true) })
    return api.onAuthChange((u) => {
      setUser(u)
      // Close the sign-in sheet once a real sign-in succeeds.
      if (isMember(u)) setSheet((s) => (s?.type === 'auth' ? null : s))
    })
  }, [])

  // After a real sign-in: record the terms agreement ticked before the email link,
  // or ask once if this account never agreed (e.g. signed up before Phase 4).
  useEffect(() => {
    if (!member) { setNeedTerms(false); return }
    let alive = true
    api.getMyProfile().then(async (p) => {
      if (!alive || !p || !('terms_accepted_at' in p) || p.terms_accepted_at) return
      let pending = null
      try { pending = localStorage.getItem(TERMS_PENDING_KEY) } catch { /* ignore */ }
      if (pending) {
        try { await api.acceptTerms(); localStorage.removeItem(TERMS_PENDING_KEY); return } catch { /* fall back to asking */ }
      }
      if (alive) setNeedTerms(true)
    }).catch(() => {})
    return () => { alive = false }
  }, [member?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Returns true if signed in; otherwise opens the sign-in sheet.
  const requireUser = useCallback((reason) => {
    if (member) return true
    setSheet({ type: 'auth', reason })
    return false
  }, [member])

  /* ---------- feed ---------- */
  const loadFeed = useCallback(async () => {
    setLoading(true); setError('')
    try { setGames(await api.listFeed(tab)) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { if (authReady) loadFeed() }, [authReady, user?.id, loadFeed])

  // Small helpers to update one game, or every game by one creator, without reloading.
  const patchGame = (id, fn) => setGames((gs) => gs.map((g) => (g.id === id ? fn(g) : g)))
  const patchCreator = (creatorId, fn) => setGames((gs) => gs.map((g) => (g.creator.id === creatorId ? fn(g) : g)))

  /* ---------- actions (optimistic: update screen first, undo if the server says no) ---------- */
  async function onLike(game, on) {
    if (!requireUser('Sign in to like games and support creators.')) return
    patchGame(game.id, (g) => ({ ...g, liked: on, likes: g.likes + (on ? 1 : -1) }))
    try { await api.setLike(game.id, on) } catch (e) {
      patchGame(game.id, (g) => ({ ...g, liked: !on, likes: g.likes + (on ? -1 : 1) }))
      toast(e.message)
    }
  }

  async function setFollow(creatorId, handle, on) {
    patchCreator(creatorId, (g) => ({ ...g, following: on, creator: { ...g.creator, followers: g.creator.followers + (on ? 1 : -1) } }))
    try {
      await api.setFollow(creatorId, on)
      toast(on ? `Following @${handle}` : `Unfollowed @${handle}`)
    } catch (e) {
      patchCreator(creatorId, (g) => ({ ...g, following: !on, creator: { ...g.creator, followers: g.creator.followers + (on ? -1 : 1) } }))
      toast(e.message)
    }
  }

  function onFollow(game) {
    if (!requireUser('Sign in to follow creators.')) return
    if (game.creator.id === member.id) { toast('This is your game.'); return }
    setFollow(game.creator.id, game.creator.handle, !game.following)
  }

  function onShare(game) {
    const text = `Play ${game.title} by @${game.creator.handle} on Nativity: ${window.location.origin}`
    if (navigator.share) { navigator.share({ title: game.title, text }).catch(() => {}); return }
    navigator.clipboard?.writeText(text).then(() => toast('Share message copied'), () => toast('Couldn’t copy. Try again.'))
  }

  function onReport(target) {
    if (!requireUser('Sign in to report something.')) return
    setSheet({ type: 'report', target })
  }

  async function onBlock(person) {
    if (!requireUser('Sign in to block someone.')) return
    if (person.id === member.id) { toast('You can’t block yourself.'); return }
    try {
      await api.block(person.id)
      setSheet(null); setPlayingId(null)
      toast(`Blocked @${person.handle}. You can unblock them in Profile.`)
      loadFeed()
    } catch (e) { toast(e.message) }
  }

  async function onFeedback(game, tags) {
    try { await api.sendFeedback(game.id, tags); toast(`Feedback sent to @${game.creator.handle}`); return true } catch (e) { toast(e.message); return false }
  }

  const playing = games.find((g) => g.id === playingId) || null
  const closePlayer = useCallback(() => setPlayingId(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  return (
    <>
      <aside className="desk-note">
        <h1>Nativity<span>.</span></h1>
        <p>Swipe through tiny games the way you swipe through reels. Every new creator gets their first {BOOST_VIEWS} views guaranteed.</p>
        <p><b>Built for phones.</b> Open this on your phone, or scroll and drag inside the frame.</p>
        {api.mode === 'demo' && <p className="demo-pill">Demo mode · data stays in this browser</p>}
      </aside>

      <div className="app">
        <div className="feed-wrap">
          <nav className="tabs" aria-label="Feed">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>
            ))}
          </nav>
          <Feed
            games={games} loading={loading} error={error} tab={tab}
            paused={!!playing}
            onPlay={(g) => setPlayingId(g.id)}
            onLike={onLike} onFollow={onFollow}
            onMore={(g) => setSheet({ type: 'more', game: g })}
            onComments={(g) => setSheet({ type: 'comments', game: g })}
            onView={(id) => api.recordView(id).catch(() => {})}
            onRetry={loadFeed}
            onFindFresh={() => setTab('fresh')}
          />
        </div>

        <nav className="nav" aria-label="Main">
          <button type="button" aria-current={!sheet && !playing ? 'page' : undefined} onClick={() => { setSheet(null); setPlayingId(null) }}>
            <HomeIcon />Home
          </button>
          <button type="button" aria-label="Upload a game" onClick={() => { if (requireUser('Sign in to upload your game.')) setSheet({ type: 'upload' }) }}>
            <span className="up"><PlusIcon /></span>
          </button>
          <button type="button" aria-current={sheet?.type === 'profile' ? 'page' : undefined} onClick={() => { if (requireUser('Sign in to see your profile.')) setSheet({ type: 'profile' }) }}>
            <UserIcon />{member ? 'Profile' : 'Sign in'}
          </button>
        </nav>

        {playing && (
          <Player
            key={playing.id}
            game={playing} user={member}
            onClose={closePlayer}
            onLike={onLike} onFollow={onFollow}
            onComments={(g) => setSheet({ type: 'comments', game: g })}
            onPlayed={(g, score) => api.recordPlay(g.id, score)}
            onFeedback={onFeedback}
            onNeedSignIn={(reason) => setSheet({ type: 'auth', reason })}
          />
        )}

        {sheet?.type === 'comments' && (
          <CommentsSheet
            game={games.find((g) => g.id === sheet.game.id) || sheet.game} user={member} onClose={closeSheet}
            onAdded={(g) => patchGame(g.id, (x) => ({ ...x, comments: x.comments + 1 }))}
            onRemoved={(g) => patchGame(g.id, (x) => ({ ...x, comments: Math.max(0, x.comments - 1) }))}
            onNeedSignIn={(reason) => setSheet({ type: 'auth', reason })}
            onReport={onReport} onBlock={onBlock} toast={toast}
          />
        )}
        {sheet?.type === 'auth' && <AuthSheet reason={sheet.reason} onClose={closeSheet} onOpenDoc={setDoc} />}
        {sheet?.type === 'more' && (
          <MoreSheet
            game={sheet.game} isOwn={member?.id === sheet.game.creator.id} onClose={closeSheet}
            onShare={(g) => { setSheet(null); onShare(g) }} onReport={onReport} onBlock={onBlock}
          />
        )}
        {sheet?.type === 'report' && (
          <ReportSheet target={sheet.target} onClose={closeSheet}
            onDone={() => { setSheet(null); toast('Thanks for reporting. A moderator will review it.') }} />
        )}
        {sheet?.type === 'moderation' && member && (
          <ModerationSheet onClose={closeSheet} onChanged={loadFeed} toast={toast} />
        )}
        {sheet?.type === 'profile' && member && (
          <ProfileSheet
            onClose={closeSheet} toast={toast}
            onProfileChanged={loadFeed}
            onGamesChanged={loadFeed}
            onOpenModeration={() => setSheet({ type: 'moderation' })}
            onOpenDoc={setDoc}
            onUnfollow={(creatorId) => {
              const g = games.find((x) => x.creator.id === creatorId)
              return setFollow(creatorId, g?.creator.handle ?? 'creator', false)
            }}
          />
        )}
        {sheet?.type === 'upload' && (
          <UploadSheet
            onClose={closeSheet} toast={toast}
            onPublished={() => { setSheet(null); if (tab === 'fresh') loadFeed(); else setTab('fresh') }}
          />
        )}

        {member && needTerms && (
          <TermsGate
            onOpenDoc={setDoc}
            onAccept={async () => { await api.acceptTerms(); setNeedTerms(false); toast('Welcome to Nativity!') }}
            onSignOut={async () => { await api.signOut(); setNeedTerms(false) }}
          />
        )}
        {doc && <LegalSheet doc={doc} onClose={() => setDoc(null)} />}

        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </>
  )
}
