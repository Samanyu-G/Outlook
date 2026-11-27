// You (07), Mailbox (09), Studio (11) and Options (12).
import { useEffect, useState } from 'react'
import { api, initials, timeAgo } from '../lib/api.js'
import { isToday, playerLevel, STAMPS, topStamp } from '../lib/activity.js'
import { formatDob } from '../lib/age.js'
import { GRIEVANCE_OFFICER, PRIVACY_VERSION, TERMS_VERSION } from '../content/legal.js'
import Icon from '../components/Icon.jsx'
import Sheet from '../components/Sheet.jsx'
import { Avatar, Badge, Stamp, Toggle } from '../components/ui.jsx'
import { Spine, Tabs } from './People.jsx'

/* ---------- 07 You ---------- */
export function You({ profile, activity, games, tab, setTab, theme, onTheme, onOpen, onLeaveCrew }) {
  if (!profile || !activity) return <main className="screen"><h1 className="h-display page-title">You</h1><p className="muted">Loading…</p></main>
  const byId = Object.fromEntries(games.map((g) => [g.id, g]))
  const played = activity.playedIds.map((id) => byId[id]).filter(Boolean)
  const shelf = games.filter((g) => g.liked)
  const lv = playerLevel(activity.playedIds.length)
  return (
    <main className="screen" aria-label="You">
      <div className="title-row">
        <h1 className="h-display page-title">You</h1>
        <button type="button" className="round-btn" onClick={onTheme} aria-label={theme === 'night' ? 'Switch to day' : 'Switch to night'}>
          <Icon name="spark" size={22} />
        </button>
      </div>
      <section className="hero-card blue">
        <div className="hero-id">
          <Avatar name={profile.display_name || profile.handle} color={profile.avatar_color} size={72} />
          <div>
            <h1 className="h-1">{profile.display_name || '@' + profile.handle}</h1>
            <small>@{profile.handle}</small>
            <div className="badges col"><Badge kind="plv">Player LV {lv}</Badge></div>
          </div>
        </div>
        <div className="tiles">
          <div className="tile"><b>{activity.playedIds.length}</b><span>played</span></div>
          <div className="tile"><b>{activity.stamps}</b><span>stamps</span></div>
          <div className="tile"><b>{activity.talk}</b><span>talk</span></div>
        </div>
      </section>
      {profile.banned && <div className="note warn-note"><b>Your account is suspended.</b> You can still play games, but you can’t post, comment, cheer, join crews or upload. If you think this is a mistake, contact the Nativity team.</div>}

      <Tabs value={tab} onChange={setTab} items={[['shelf', 'Shelf'], ['played', 'Played'], ['crew', 'Crew']]} />
      {tab === 'shelf' && (shelf.length
        ? <div className="row-scroll">{shelf.map((g) => <Spine key={g.id} game={g} onClick={() => onOpen(g)} />)}</div>
        : <p className="muted">Games you cheer land on your shelf.</p>)}
      {tab === 'played' && (played.length
        ? <div className="row-scroll">{played.map((g) => <Spine key={g.id} game={g} onClick={() => onOpen(g)} />)}</div>
        : <p className="muted">Games you play show up here.</p>)}
      {tab === 'crew' && (activity.following.length ? (
        <div className="flist">
          {activity.following.map((c) => (
            <div className="fitem" key={c.id}>
              <Avatar name={c.display_name || c.handle} color={c.avatar_color} size={48} />
              <div><b>@{c.handle}</b><small>{c.bio}</small></div>
              <button type="button" onClick={() => onLeaveCrew(c)}>Leave</button>
            </div>
          ))}
        </div>
      ) : <p className="muted">You haven’t joined any crews yet. Tap Join on a maker’s game to follow their new games.</p>)}
    </main>
  )
}

/* ---------- 09 Mailbox ---------- */
const READ_KEY = 'nativity:mail-read'
export const readMailMark = () => { try { return localStorage.getItem(READ_KEY) || '' } catch { return '' } }
export const writeMailMark = () => { const t = new Date().toISOString(); try { localStorage.setItem(READ_KEY, t) } catch { /* ignore */ } return t }

export function Mailbox({ data, error, readMark, filter, setFilter }) {
  const items = data?.items.filter((i) => filter === 'all' || i.filter === filter) || []
  const today = items.filter((i) => isToday(i.at))
  const earlier = items.filter((i) => !isToday(i.at))
  const Item = ({ it }) => (
    <div className={`mail-item${it.at > readMark ? ' unread' : ''}`}>
      <span className="mail-ico"><Icon name={it.icon} size={20} /></span>
      <span className="mail-txt"><b>{it.title}</b><small>{[it.meta, timeAgo(it.at)].filter(Boolean).join(' · ')}</small></span>
      {it.at > readMark && <i className="dot" aria-label="Unread" />}
    </div>
  )
  return (
    <main className="screen" aria-label="Mailbox">
      <h1 className="h-display page-title">Mailbox</h1>
      <div className="chip-row" role="tablist">
        {[['all', 'All'], ['stamps', 'Stamps'], ['crew', 'Crew'], ['talk', 'Talk']].map(([k, l]) => (
          <button key={k} type="button" role="tab" className="seg" aria-selected={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data?.milestone && filter === 'all' && (
        <section className="milestone">
          <span className="overline-mono"><Icon name="trophy" size={16} />Milestone</span>
          <b>{data.milestone.title}</b>
          <small>{data.milestone.meta}</small>
          <i className="bar sage"><b style={{ width: `${data.milestone.progress * 100}%` }} /></i>
        </section>
      )}
      {today.length > 0 && <><p className="overline-mono">Today</p><div className="stack">{today.map((it) => <Item key={it.id} it={it} />)}</div></>}
      {earlier.length > 0 && <><p className="overline-mono">Earlier</p><div className="stack">{earlier.map((it) => <Item key={it.id} it={it} />)}</div></>}
      {data && !items.length && <p className="muted">Nothing here yet. When players stamp your games, join your crew or reply to your notes, it shows up here.</p>}
    </main>
  )
}

/* ---------- 11 Studio ---------- */
export function Studio({ myGames, gameId, setGameId, stats, error, onMake, onDelete }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setConfirm(false) }, [gameId])
  if (myGames && !myGames.length) {
    return (
      <main className="screen" aria-label="Studio">
        <h1 className="h-display page-title">Studio</h1>
        <section className="card-box center">
          <Icon name="make" size={32} />
          <b className="h-title">Your games live here</b>
          <p className="muted">Upload your first game and you’ll see who played it, what they felt and what they said.</p>
          <button type="button" className="btn primary" onClick={onMake}>Make a game</button>
        </section>
      </main>
    )
  }
  const game = myGames?.find((g) => g.id === gameId)
  const s = stats
  const max = s ? Math.max(s.views, 1) : 1
  const top = s && topStamp(s.stamps)
  const ring = s ? (s.milestone.next ? s.players / s.milestone.next : 1) : 0
  return (
    <main className="screen" aria-label="Studio">
      <div className="title-row">
        <h1 className="h-display page-title">Studio</h1>
        {myGames && (
          <label className="select">
            <span className="sr-only">Game</span>
            <select value={gameId || ''} onChange={(e) => setGameId(e.target.value)}>
              {myGames.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <Icon name="down" size={18} />
          </label>
        )}
      </div>
      {error && <p className="err">{error}</p>}
      {(!myGames || (!s && !error)) && <p className="muted">Loading…</p>}
      {game && game.status !== 'published' && <div className="note"><b>{game.status === 'hidden' ? 'Hidden by a moderator.' : 'Draft.'}</b> Players can’t see this game right now.</div>}
      {s && (
        <>
          <section className="card-box ring-card">
            <span className="ring" style={{ '--p': ring }}>
              <b>{s.players}</b><small>of {s.milestone.next || s.players}</small>
            </span>
            <div>
              <b className="h-3">Players</b>
              <p className="small">{s.milestone.next ? `${s.milestone.next - s.players} more players and ${game?.title} reaches ${s.milestone.next}.` : `${game?.title} passed every milestone.`}</p>
              <span className="badge heat"><Icon name="rise" size={14} />{s.likes} cheers</span>
            </div>
          </section>
          <section className="card-box">
            <h2 className="h-3">From trailer to play</h2>
            <div className="funnel">
              {[['Saw trailer', s.views, 'neutral'], ['Played', s.players, 'fun'], ['Stamped', s.stamped, 'clever'], ['Talked', s.comments, 'pretty']].map(([l, n, c]) => (
                <div key={l}><span>{l}</span><i className={`fbar ${c}`} style={{ width: `${Math.max(2, (n / max) * 100)}%` }} /><b>{n}</b></div>
              ))}
            </div>
            <p className="small">{s.views ? `Play rate ${s.playRate}%: ${s.playRate >= 40 ? 'great' : s.playRate >= 20 ? 'good' : 'room to grow'}. Most makers start around 30%.` : 'No one has seen the trailer yet.'}</p>
          </section>
          <section className="card-box">
            <h2 className="h-3">What players felt</h2>
            <div className="stamp-row">
              {STAMPS.map((st) => <Stamp key={st.key} k={st.key} count={s.stamps[st.key]} state={s.stamps[st.key] ? 'chip' : 'unpicked'} />)}
            </div>
            <p className="small">
              {top ? `Most stamped: ${top.label} (${s.stamps[top.key]}).` : 'No stamps yet.'}{' '}
              {s.waiting ? `${s.waiting} talk note${s.waiting === 1 ? '' : 's'} waiting for your reply.` : 'You’re all caught up on talk.'}
            </p>
          </section>
          {game && !game.builtin && (
            <div className="stack">
              {confirm ? (
                <>
                  <p className="muted small">Deleting removes {game.title}, its files, cheers, stamps and talk. It can’t be undone.</p>
                  <div className="row">
                    <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
                    <button type="button" className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await onDelete(game); setBusy(false) }}>{busy ? 'Deleting…' : 'Delete for good'}</button>
                  </div>
                </>
              ) : <button type="button" className="btn ghost-danger" onClick={() => setConfirm(true)}><Icon name="trash" size={18} />Delete this game</button>}
            </div>
          )}
        </>
      )}
    </main>
  )
}

/* ---------- 12 Options ---------- */
const SAVER = ['Off', 'Wi-Fi only', 'Always']

export function Options({ prefs, setPref, profile, account, blockedCount, member, onDone, onEditProfile, onSignIn, onSignOut, onBlocked, onDoc, onDelete, onRules, isAdmin, onRefDesk, onDob, onExport, exporting }) {
  const dobLabel = account?.birthDate ? formatDob(account.birthDate) : account?.ageStatus === 'operator' ? 'Team account' : account?.ageStatus === 'ineligible' ? 'Under 18' : 'Not confirmed'
  return (
    <main className="screen" aria-label="Options">
      <div className="title-row">
        <h1 className="h-display page-title">Options</h1>
        <button type="button" className="done-btn" onClick={onDone}>Done</button>
      </div>
      <p className="overline-mono">Play</p>
      <div className="group">
        <div className="orow"><span>Autoplay trailers</span><Toggle checked={prefs.autoplay} onChange={(v) => setPref('autoplay', v)} label="Autoplay trailers" /></div>
        <div className="orow"><span>Reduce motion</span><Toggle checked={prefs.reduceMotion} onChange={(v) => setPref('reduceMotion', v)} label="Reduce motion" /></div>
        <button type="button" className="orow" onClick={() => setPref('dataSaver', SAVER[(SAVER.indexOf(prefs.dataSaver) + 1) % SAVER.length])}>
          <span>Data saver</span><em>{prefs.dataSaver}</em><Icon name="chevron" size={18} />
        </button>
        <div className="orow"><span>Night mode</span><Toggle checked={prefs.theme === 'night'} onChange={(v) => setPref('theme', v ? 'night' : 'day')} label="Night mode" /></div>
      </div>
      <p className="overline-mono">Account</p>
      <div className="group">
        {member ? (
          <>
            <button type="button" className="orow" onClick={onEditProfile}><span>Handle &amp; bio</span><em>@{profile?.handle}</em><Icon name="chevron" size={18} /></button>
            {account && <button type="button" className="orow" onClick={onDob}><span>Date of birth</span><em>{dobLabel}</em><Icon name="chevron" size={18} /></button>}
            {account && <div className="orow"><span>Country of residence</span><em>{account.residencyStatus === 'resident' || account.residencyStatus === 'operator' ? 'India (confirmed)' : account.residencyStatus === 'review' ? 'India (in review)' : account.residencyStatus === 'not_resident' ? 'Outside India' : 'Not confirmed'}</em></div>}
            <button type="button" className="orow" onClick={onSignOut}><span>Sign out</span><Icon name="chevron" size={18} /></button>
          </>
        ) : (
          <button type="button" className="orow" onClick={onSignIn}><span>Sign in</span><Icon name="chevron" size={18} /></button>
        )}
      </div>
      <p className="overline-mono">Safety</p>
      <div className="group">
        {member && <button type="button" className="orow" onClick={onBlocked}><span>Blocked accounts</span><em>{blockedCount ?? ''}</em><Icon name="chevron" size={18} /></button>}
        <button type="button" className="orow" onClick={onRules}><span>Community rules</span><Icon name="chevron" size={18} /></button>
        {isAdmin && <button type="button" className="orow" onClick={onRefDesk}><span>Ref desk</span><Icon name="chevron" size={18} /></button>}
      </div>
      <p className="overline-mono">Privacy</p>
      <div className="group">
        {member && <button type="button" className="orow" onClick={onExport} disabled={exporting}><span>Download my data</span><em>{exporting ? 'Preparing…' : 'JSON'}</em><Icon name="down" size={18} /></button>}
        <button type="button" className="orow" onClick={() => onDoc('privacy')}><span>Privacy Policy</span><Icon name="chevron" size={18} /></button>
        {member && <button type="button" className="orow danger" onClick={onDelete}><span>Delete account</span><Icon name="chevron" size={18} /></button>}
      </div>
      <p className="overline-mono">About</p>
      <div className="group">
        <button type="button" className="orow" onClick={() => onDoc('terms')}><span>Terms of Service</span><Icon name="chevron" size={18} /></button>
        <a className="orow" href={`mailto:${GRIEVANCE_OFFICER.email}?subject=Nativity%20grievance`}><span>Grievance Officer</span><em>{GRIEVANCE_OFFICER.name}</em><Icon name="mail" size={18} /></a>
      </div>
      <p className="muted small center">Nativity is for adults 18+ who live in India. Terms {TERMS_VERSION} · Privacy {PRIVACY_VERSION}</p>
    </main>
  )
}

/* ---------- Sheets used by Options ---------- */
export function EditProfileSheet({ onClose, onSaved, toast }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    api.getMyProfile().then((p) => { setProfile(p); setForm({ handle: p?.handle ?? '', display_name: p?.display_name ?? '', bio: p?.bio ?? '' }) }).catch((e) => setError(e.message))
  }, [])
  async function save(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try { const p = await api.updateMyProfile(form); toast('Profile saved'); onSaved(p) } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  const dirty = profile && form && (form.handle !== profile.handle || form.display_name !== profile.display_name || form.bio !== profile.bio)
  return (
    <Sheet title="Handle & bio" onClose={onClose}>
      {!form && !error && <p className="muted">Loading…</p>}
      {form && (
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
          <button type="submit" className="btn primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button>
        </form>
      )}
      {error && <p className="err">{error}</p>}
    </Sheet>
  )
}

export function BlockedSheet({ onClose, onChanged, toast }) {
  const [people, setPeople] = useState(null)
  useEffect(() => { api.listBlocked().then(setPeople).catch(() => setPeople([])) }, [])
  async function unblock(p) {
    try { await api.unblock(p.id); setPeople((list) => list.filter((x) => x.id !== p.id)); toast(`Unblocked @${p.handle}`); onChanged() } catch (e) { toast(e.message) }
  }
  return (
    <Sheet title="Blocked accounts" onClose={onClose}>
      {!people && <p className="muted">Loading…</p>}
      {people && !people.length && <p className="muted">You haven’t blocked anyone.</p>}
      <div className="flist">
        {people?.map((p) => (
          <div className="fitem" key={p.id}>
            <span className="avatar s48" style={{ background: p.avatar_color }}>{initials(p.display_name || p.handle)}</span>
            <div><b>@{p.handle}</b></div>
            <button type="button" onClick={() => unblock(p)}>Unblock</button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export function DeleteAccountSheet({ onClose, onDeleted }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function go() {
    setBusy(true); setError('')
    try { await api.deleteMyAccount(); onDeleted() } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <Sheet title="Delete account" onClose={busy ? () => {} : onClose}>
      <div className="note warn-note"><b>This can’t be undone.</b> Your profile, games and their files, cheers, stamps, notes, crews, age and consent records are deleted straight away. Indian law (IT Rules 2021) requires us to keep a minimal record (your email, handle, sign-up date and age-check result) for 180 days, plus any content that was hidden after a report. Then those are deleted too.</div>
      <p className="muted small">Want a copy first? Use Download my data in Options.</p>
      <label className="field"><span>Type DELETE to confirm</span>
        <input id="del-confirm" type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      {error && <p className="err">{error}</p>}
      <button type="button" className="btn danger" disabled={typed !== 'DELETE' || busy} onClick={go}>{busy ? 'Deleting…' : 'Delete my account'}</button>
    </Sheet>
  )
}

