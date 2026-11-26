import { useEffect, useState } from 'react'
import { api, initials } from '../lib/api.js'
import Sheet from './Sheet.jsx'

function MyGames({ onChanged, toast }) {
  const [games, setGames] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.listMyGames().then(setGames).catch((e) => setError(e.message)) }, [])

  async function remove(g) {
    setBusy(g.id); setError('')
    try {
      await api.deleteGame(g.id)
      setGames((list) => list.filter((x) => x.id !== g.id))
      toast(`Deleted “${g.title}”`); onChanged()
    } catch (e) { setError(e.message) } finally { setBusy(null); setConfirming(null) }
  }

  if (!api.canUpload) return null
  return (
    <>
      <h4 className="sub-h">Your games</h4>
      {error && <p className="err">{error}</p>}
      {!games && !error && <p className="muted">Loading…</p>}
      {games && !games.length && <p className="muted">You haven’t uploaded a game yet. Tap + to share your first one.</p>}
      {games?.length > 0 && (
        <div className="mygames">
          {games.map((g) => (
            <div className="mygame" key={g.id}>
              <div>
                <b>{g.title}{g.status !== 'published' && <span className="pill">{g.status}</span>}</b>
                <small>{g.views} views · {g.likes} likes · {g.comments} comments</small>
              </div>
              {g.builtin ? null : confirming === g.id ? (
                <>
                  <button type="button" className="danger" disabled={busy === g.id} onClick={() => remove(g)}>{busy === g.id ? 'Deleting…' : 'Delete for good'}</button>
                  <button type="button" disabled={busy === g.id} onClick={() => setConfirming(null)}>Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirming(g.id)}>Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
      {confirming && <p className="muted small">Deleting removes the game, its files, likes and comments. It can’t be undone.</p>}
    </>
  )
}

export default function ProfileSheet({ onClose, onUnfollow, onProfileChanged, onGamesChanged, toast }) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getMyProfile(), api.getMyStats()])
      .then(([p, s]) => { setProfile(p); setStats(s); setForm({ handle: p?.handle ?? '', display_name: p?.display_name ?? '', bio: p?.bio ?? '' }) })
      .catch((e) => setError(e.message))
  }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const p = await api.updateMyProfile(form)
      setProfile(p); toast('Profile saved'); onProfileChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function unfollow(creator) {
    await onUnfollow(creator.id)
    setStats((s) => ({ ...s, following: s.following.filter((c) => c.id !== creator.id) }))
  }

  async function signOut() {
    await api.signOut(); onClose(); toast('Signed out')
  }

  const dirty = profile && form && (form.handle !== profile.handle || form.display_name !== profile.display_name || form.bio !== profile.bio)

  return (
    <Sheet title="Your profile" onClose={onClose}>
      {!profile && !error && <p className="muted">Loading…</p>}
      {profile && (
        <>
          <div className="me">
            <span className="av big" style={{ background: profile.avatar_color }}>{initials(profile.display_name || profile.handle)}</span>
            <div><b>@{profile.handle}</b><small>{profile.display_name}</small></div>
          </div>
          {stats && (
            <div className="stats">
              <div><b>{stats.plays}</b><span>Rounds played</span></div>
              <div><b>{stats.likes}</b><span>Liked</span></div>
              <div><b>{stats.feedback}</b><span>Feedback given</span></div>
            </div>
          )}
          <form className="stack" onSubmit={save}>
            <label className="field">
              <span>Handle</span>
              <input id="pf-handle" type="text" autoCapitalize="none" autoComplete="off" maxLength={24} value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })} />
              <small>3–24 characters: lowercase letters, numbers, dots and underscores.</small>
            </label>
            <label className="field">
              <span>Name</span>
              <input id="pf-name" type="text" maxLength={40} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </label>
            <label className="field">
              <span>Bio</span>
              <textarea id="pf-bio" rows={2} maxLength={160} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="What kind of games do you make or like?" />
            </label>
            <button type="submit" className="btn primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          </form>
          <MyGames onChanged={onGamesChanged} toast={toast} />
          <h4 className="sub-h">Following</h4>
          {stats?.following.length ? (
            <div className="flist">
              {stats.following.map((c) => (
                <div className="fitem" key={c.id}>
                  <span className="av" style={{ background: c.avatar_color }}>{initials(c.display_name || c.handle)}</span>
                  <div><b>@{c.handle}</b><small>{c.bio}</small></div>
                  <button type="button" onClick={() => unfollow(c)}>Unfollow</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">You aren’t following anyone yet. Tap the + on a creator’s picture to follow them.</p>
          )}
          <button type="button" className="btn" onClick={signOut}>Sign out</button>
        </>
      )}
      {error && <p className="err">{error}</p>}
    </Sheet>
  )
}
