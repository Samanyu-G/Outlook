import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, BOOST_VIEWS, isMember } from './lib/api.js'
import Feed from './components/Feed.jsx'
import Player from './components/Player.jsx'
import CommentsSheet from './components/CommentsSheet.jsx'
import MoreSheet from './components/MoreSheet.jsx'
import ReportSheet from './components/ReportSheet.jsx'
import LegalSheet from './components/LegalSheet.jsx'
import Sheet from './components/Sheet.jsx'
import Icon from './components/Icon.jsx'
import { BrandIcon, BrandLockup } from './components/Logo.jsx'
import { CheerSlot, HubMenu, StampPicker } from './components/CheerSlot.jsx'
import { Dock, DockSlot, HubButton, PlayButton } from './components/ui.jsx'
import { GameDetails, MakerProfile } from './screens/People.jsx'
import { Find, Shelves } from './screens/Browse.jsx'
import { BlockedSheet, DeleteAccountSheet, EditProfileSheet, Mailbox, Options, readMailMark, Studio, writeMailMark, You } from './screens/Me.jsx'
import Make from './screens/Make.jsx'
import RefDesk from './screens/RefDesk.jsx'
import { MOODS_KEY, ONBOARD_KEY, Onboarding, PressStart } from './screens/Entry.jsx'
import { GRIEVANCE_TIMES, RULES } from './content/legal.js'
import { AccountGate, ADULT_KEY, AgeDeclaration, DobSheet, IneligibleAccount, NotForYou, NotResidentAccount, OUTSIDE_KEY, ResidencyPending, RulesReminder, UNDERAGE_KEY } from './screens/Age.jsx'

const CHANNELS = [['foryou', 'For you'], ['fresh', 'Fresh'], ['following', 'Crew']]
const PREFS_KEY = 'nativity:prefs'
const DEFAULT_PREFS = { autoplay: true, reduceMotion: false, dataSaver: 'Off', theme: 'day' }
const readJSON = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k)) } } catch { return d } }
const seenOnboarding = () => { try { return localStorage.getItem(ONBOARD_KEY) === '1' } catch { return true } }
const readMoods = () => { try { return JSON.parse(localStorage.getItem(MOODS_KEY)) || [] } catch { return [] } }

const readFlag = (k) => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const writeFlag = (k, on) => { try { if (on) localStorage.setItem(k, '1'); else localStorage.removeItem(k) } catch { /* ignore */ } }
const QUARTER = 90 * 864e5

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const member = isMember(user) ? user : null
  const isAdmin = profile?.role === 'admin'

  /* ---------- games: one catalog, plus the order of the current Discover channel ---------- */
  const [catalog, setCatalog] = useState({})
  const [feedIds, setFeedIds] = useState([])
  const [tab, setTab] = useState('foryou')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState(null)
  const catalogLoaded = useRef(false)

  /* ---------- navigation ---------- */
  const [stack, setStack] = useState([{ name: 'discover' }])
  const route = stack[stack.length - 1]
  const [hubOpen, setHubOpen] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [sheet, setSheet] = useState(null) // { type: 'talk'|'more'|'makerMore'|'report'|'stamps'|'edit'|'blocked'|'delete'|'rules', ... }
  const [auth, setAuth] = useState(null)   // { reason } while "Press start" is open
  const [doc, setDoc] = useState(null)
  const [adultDeclared, setAdultDeclared] = useState(() => readFlag(ADULT_KEY))
  const [underage, setUnderage] = useState(() => readFlag(UNDERAGE_KEY))
  const [outside, setOutside] = useState(() => readFlag(OUTSIDE_KEY))
  const [residencyQueue, setResidencyQueue] = useState(null)
  const [account, setAccount] = useState(null)   // age + consent state of the signed-in member (null = not loaded / not a member)
  const [gateLater, setGateLater] = useState(false)
  const [reminder, setReminder] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [corrections, setCorrections] = useState(null)
  const [onboarding, setOnboarding] = useState(() => !seenOnboarding())

  /* ---------- per-screen state ---------- */
  const [prefs, setPrefs] = useState(() => readJSON(PREFS_KEY, DEFAULT_PREFS))
  const [moods, setMoods] = useState(readMoods)
  const [find, setFind] = useState({ query: '', feeling: null, shelf: null, showFeelings: true })
  const [youTab, setYouTab] = useState('shelf')
  const [activity, setActivity] = useState(null)
  const [mail, setMail] = useState(null)
  const [mailError, setMailError] = useState('')
  const [mailFilter, setMailFilter] = useState('all')
  const [readMark, setReadMark] = useState(readMailMark)
  const [myGames, setMyGames] = useState(null)
  const [studioId, setStudioId] = useState(null)
  const [studio, setStudio] = useState(null)
  const [studioError, setStudioError] = useState('')
  const [reports, setReports] = useState(null)
  const [reportsError, setReportsError] = useState('')
  const [refBusy, setRefBusy] = useState(null)
  const [blockedCount, setBlockedCount] = useState(null)

  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef(null)
  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200)
  }, [])

  const setPref = (k, v) => setPrefs((p) => {
    const next = { ...p, [k]: v }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })
  const conn = typeof navigator !== 'undefined' ? navigator.connection : null
  const dataSaver = prefs.dataSaver === 'Always' || (prefs.dataSaver === 'Wi-Fi only' && (conn?.type === 'cellular' || !!conn?.saveData))

  /* ---------- auth ---------- */
  useEffect(() => {
    // No guest ID is created until the visitor has confirmed they're 18 or older.
    api.getUser(readFlag(ADULT_KEY)).then((u) => { setUser(u); setAuthReady(true) })
    return api.onAuthChange((u) => {
      setUser(u)
      if (isMember(u)) setAuth(null)
    })
  }, [])

  const loadAccount = useCallback(() => api.getAccountState().then((st) => {
    setAccount(st)
    // Quarterly reminder of the rules (IT Rules 3(1)(c)) for members who can post.
    if (st?.canParticipate && (!st.rulesNotifiedAt || Date.now() - new Date(st.rulesNotifiedAt).getTime() > QUARTER)) setReminder(true)
    return st
  }).catch(() => null), [])

  useEffect(() => {
    if (!member) { setProfile(null); setAccount(null); setActivity(null); setMail(null); setMyGames(null); setGateLater(false); return }
    api.getMyProfile().then(setProfile).catch(() => {})
    loadAccount()
  }, [member?.id, loadAccount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Signed in, 18+ confirmed and current terms accepted: otherwise show the right step.
  const requireUser = useCallback((reason) => {
    if (!member) { setAuth({ reason }); return false }
    if (account && !account.canParticipate) { setGateLater(false); return false }
    return true
  }, [member, account])

  /* ---------- loading games ---------- */
  const merge = (rows) => setCatalog((c) => { const n = { ...c }; for (const g of rows) n[g.id] = g; return n })

  const loadFeed = useCallback(async () => {
    setLoading(true); setError('')
    try { const rows = await api.listFeed(tab); merge(rows); setFeedIds(rows.map((g) => g.id)) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [tab])
  const loadCatalog = useCallback(async () => {
    catalogLoaded.current = true
    try { merge(await api.listFeed('all')) } catch { catalogLoaded.current = false }
  }, [])

  useEffect(() => { if (authReady) loadFeed() }, [authReady, user?.id, loadFeed])
  useEffect(() => { if (authReady) { catalogLoaded.current = false; setCatalog({}) } }, [authReady, user?.id])
  useEffect(() => {
    if (authReady && !catalogLoaded.current && ['find', 'shelves', 'maker', 'you', 'details'].includes(route.name)) loadCatalog()
  }, [authReady, route.name, loadCatalog, catalog])

  const games = useMemo(() => Object.values(catalog), [catalog])
  const feedGames = useMemo(() => feedIds.map((id) => catalog[id]).filter(Boolean), [feedIds, catalog])
  const refreshAll = () => { loadFeed(); loadCatalog() }

  const patchGame = (id, fn) => setCatalog((c) => (c[id] ? { ...c, [id]: fn(c[id]) } : c))
  const patchCreator = (creatorId, fn) => setCatalog((c) => {
    const n = { ...c }
    for (const id in n) if (n[id].creator.id === creatorId) n[id] = fn(n[id])
    return n
  })

  /* ---------- navigation helpers ---------- */
  const go = (r) => { setHubOpen(false); setStack((s) => [...s, r]) }
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const NEEDS_MEMBER = { you: 'Sign in to see your shelf, crews and stats.', mailbox: 'Sign in to get your Mailbox.', studio: 'Sign in to see your Studio.', make: 'Sign in to upload your game.' }
  const hubGo = (name) => {
    setHubOpen(false)
    if (NEEDS_MEMBER[name] && !requireUser(NEEDS_MEMBER[name])) return
    if (name === 'refdesk' && !isAdmin) return
    setStack(name === 'discover' ? [{ name: 'discover' }] : [{ name: 'discover' }, { name }])
  }
  const labelOf = (r) => {
    if (!r) return 'Back'
    if (r.name === 'details') return catalog[r.id]?.title || 'Game'
    if (r.name === 'maker') return '@' + (r.creator?.handle || 'maker')
    return { discover: 'Discover', find: 'Find', shelves: 'Shelves', you: 'You', mailbox: 'Mailbox', studio: 'Studio', refdesk: 'Ref desk', options: 'Options' }[r.name] || 'Back'
  }
  const backLabel = labelOf(stack[stack.length - 2])
  const openGame = (g) => go({ name: 'details', id: g.id })
  const openMaker = (g) => go({ name: 'maker', creator: g.creator })

  /* ---------- actions (optimistic: update the screen first, undo if the server says no) ---------- */
  function play(game) {
    if (!game) return
    setPlayingId(game.id)
    patchGame(game.id, (g) => ({ ...g, played: true, players: g.played ? g.players : (g.players || 0) + 1 }))
  }

  async function sendStamps(game, tags, quiet = false) {
    if (!requireUser('Sign in to stamp games and help makers.')) return false
    try {
      const before = await api.getMyFeedback(game.id).catch(() => null)
      await api.sendFeedback(game.id, tags)
      // Update the visible totals.
      const keyOf = { Fun: 'fun', Clever: 'clever', Pretty: 'pretty', Tough: 'tough', 'Want more': 'more' }
      patchGame(game.id, (g) => {
        const st = { ...g.stamps }
        for (const t of before || []) if (keyOf[t]) st[keyOf[t]] = Math.max(0, st[keyOf[t]] - 1)
        for (const t of tags) if (keyOf[t]) st[keyOf[t]]++
        return { ...g, stamps: st }
      })
      if (!game.liked) await setCheer(game, true, true)
      if (!quiet) toast(`Stamped for @${game.creator.handle}`)
      return true
    } catch (e) { toast(e.message); return false }
  }

  async function setCheer(game, on, quiet = false) {
    patchGame(game.id, (g) => ({ ...g, liked: on, likes: g.likes + (on ? 1 : -1) }))
    try { await api.setLike(game.id, on); if (!quiet) toast(on ? `Cheered ${game.title}` : 'Cheer removed') } catch (e) {
      patchGame(game.id, (g) => ({ ...g, liked: !on, likes: g.likes + (on ? -1 : 1) }))
      toast(e.message)
    }
  }

  // Tap Cheer: cheer, and stamp "Fun!" if you haven't stamped this game yet.
  async function onCheer(game) {
    if (!requireUser('Sign in to cheer games and help makers.')) return
    if (game.liked) { setCheer(game, false); return }
    await setCheer(game, true, true)
    const had = await api.getMyFeedback(game.id).catch(() => null)
    if (!had) await sendStamps({ ...game, liked: true }, ['Fun'], true)
    toast(`Cheered ${game.title}. Hold Cheer to pick other stamps.`)
  }
  const onStampPicker = (game) => { if (requireUser('Sign in to stamp games and help makers.')) setSheet({ type: 'stamps', id: game.id }) }

  async function setFollow(creatorId, handle, on) {
    patchCreator(creatorId, (g) => ({ ...g, following: on }))
    try {
      await api.setFollow(creatorId, on)
      toast(on ? `You joined @${handle}’s crew` : `You left @${handle}’s crew`)
      if (activity) setActivity(await api.getMyActivity())
    } catch (e) {
      patchCreator(creatorId, (g) => ({ ...g, following: !on }))
      toast(e.message)
    }
  }
  function onFollow(game) {
    if (!requireUser('Sign in to join a maker’s crew.')) return
    if (game.creator.id === member.id) { toast('This is your game.'); return }
    setFollow(game.creator.id, game.creator.handle, !game.following)
  }

  function share(text, title) {
    if (navigator.share) { navigator.share({ title, text }).catch(() => {}); return }
    navigator.clipboard?.writeText(text).then(() => toast('Link copied'), () => toast('Couldn’t copy. Try again.'))
  }
  const onShare = (game) => share(`Play ${game.title} by @${game.creator.handle} on Nativity: ${window.location.origin}`, game.title)

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
      toast(`Blocked @${person.handle}. You can unblock them in Options.`)
      setStack((s) => s.filter((r) => !(r.name === 'maker' && r.creator.id === person.id) && !(r.name === 'details' && catalog[r.id]?.creator.id === person.id)))
      setCatalog({}); catalogLoaded.current = false
      loadFeed()
    } catch (e) { toast(e.message) }
  }

  /* ---------- screen data ---------- */
  useEffect(() => {
    if (route.name === 'you' && member) api.getMyActivity().then(setActivity).catch((e) => toast(e.message))
  }, [route.name, member?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMail = useCallback(() => {
    setMailError('')
    api.listMailbox().then(setMail).catch((e) => setMailError(e.message))
  }, [])
  useEffect(() => { if (member) loadMail() }, [member?.id, loadMail]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (route.name === 'mailbox' && member) loadMail() }, [route.name]) // eslint-disable-line react-hooks/exhaustive-deps
  const unread = !!mail?.items.some((i) => i.at > readMark)

  useEffect(() => {
    if (route.name !== 'studio' || !member) return
    api.listMyGames().then((list) => {
      setMyGames(list)
      setStudioId((id) => (list.some((g) => g.id === id) ? id : list[0]?.id ?? null))
    }).catch((e) => setStudioError(e.message))
  }, [route.name, member?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (route.name !== 'studio' || !studioId) return
    setStudio(null); setStudioError('')
    api.getStudio(studioId).then(setStudio).catch((e) => setStudioError(e.message))
  }, [route.name, studioId])

  const loadReports = useCallback(() => {
    setReportsError('')
    api.listReports().then(setReports).catch((e) => setReportsError(e.message))
  }, [])
  useEffect(() => { if (route.name === 'refdesk' && isAdmin) loadReports() }, [route.name, isAdmin, loadReports])

  useEffect(() => {
    if (route.name === 'options' && member) api.listBlocked().then((l) => setBlockedCount(l.length)).catch(() => {})
  }, [route.name, member?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refAct(item, action) {
    const key = item.type + item.id
    setRefBusy(key)
    const label = item.type === 'game' ? 'game' : 'comment'
    try {
      if (action === 'suspend' || action === 'unsuspend') await api.setSuspended(item.ownerId, action === 'suspend')
      else await api.moderate(item.type, item.id, action)
      toast({ hide: `The ${label} stays hidden`, restore: `Restored the ${label}`, dismiss: 'Reports dismissed', suspend: `@${item.owner} is suspended`, unsuspend: `@${item.owner} can post again` }[action])
      loadReports(); refreshAll()
    } catch (e) { toast(e.message) } finally { setRefBusy(null) }
  }

  async function deleteMyGame(game) {
    try {
      await api.deleteGame(game.id)
      toast(`Deleted “${game.title}”`)
      const list = await api.listMyGames()
      setMyGames(list); setStudioId(list[0]?.id ?? null)
      setCatalog((c) => { const n = { ...c }; delete n[game.id]; return n })
      loadFeed()
    } catch (e) { toast(e.message) }
  }

  /* ---------- adults only ---------- */
  async function declareAdult() {
    writeFlag(ADULT_KEY, true); writeFlag(UNDERAGE_KEY, false); writeFlag(OUTSIDE_KEY, false)
    setAdultDeclared(true); setUnderage(false); setOutside(false)
    const u = await api.startGuest().catch(() => null)
    if (u) setUser(u)
  }
  function declareUnder() { writeFlag(UNDERAGE_KEY, true); setUnderage(true) }
  function declareOutside() { writeFlag(OUTSIDE_KEY, true); setOutside(true) }

  async function exportData() {
    setExporting(true)
    try {
      const data = await api.exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url; a.download = `nativity-my-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('Your data was downloaded')
    } catch (e) { toast(e.message) } finally { setExporting(false) }
  }

  const loadCorrections = useCallback(() => {
    api.listDobCorrections().then(setCorrections).catch(() => setCorrections([]))
    api.listResidencyReviews().then(setResidencyQueue).catch(() => setResidencyQueue([]))
  }, [])
  useEffect(() => { if (route.name === 'refdesk' && isAdmin) loadCorrections() }, [route.name, isAdmin, loadCorrections])
  async function reviewResidency(v, approve, note) {
    setRefBusy(v.id)
    try { await api.reviewResidency(v.id, approve, note); toast(approve ? `@${v.handle} confirmed as living in India` : `@${v.handle} recorded as outside India`); loadCorrections() } catch (e) { toast(e.message) } finally { setRefBusy(null) }
  }
  async function reviewCorrection(c, approve, note) {
    setRefBusy(c.id)
    try { await api.reviewDobCorrection(c.id, approve, note); toast(approve ? `Correction approved for @${c.handle}` : `Correction rejected for @${c.handle}`); loadCorrections() } catch (e) { toast(e.message) } finally { setRefBusy(null) }
  }

  // Both conditions: 18+ AND resident of India (plus the current Terms and Privacy Policy).
  const residency = account?.residencyStatus
  const blocked = account?.ageStatus === 'ineligible' ? 'age' : residency === 'not_resident' ? 'country' : residency === 'review' ? 'review' : null
  const needsGate = !!(member && account && !blocked &&
    (!account.ageStatus || !residency || account.accepted.terms !== account.current.terms || account.accepted.privacy !== account.current.privacy))
  const dobOnlyMissing = needsGate && (!account.ageStatus || !residency)

  /* ---------- derived ---------- */
  const detailGame = route.name === 'details' ? catalog[route.id] : null
  const dockGame = route.name === 'details' ? detailGame : route.name === 'discover' ? catalog[activeId] || feedGames[0] : null
  const makerGames = (creatorId) => games.filter((g) => g.creator.id === creatorId)
  const playing = playingId ? catalog[playingId] : null
  const talkGame = sheet?.type === 'talk' ? catalog[sheet.id] : null
  const stampGame = sheet?.type === 'stamps' ? catalog[sheet.id] : null
  const closeSheet = useCallback(() => setSheet(null), [])
  const closePlayer = useCallback(() => setPlayingId(null), [])

  const hubItems = [
    { key: 'discover', label: 'Discover', icon: 'play', tint: 'fun' },
    { key: 'shelves', label: 'Shelves', icon: 'shelf', tint: 'clever' },
    { key: 'find', label: 'Find', icon: 'find', tint: 'more' },
    { key: 'mailbox', label: 'Mailbox', icon: 'mail', tint: 'pretty', badge: unread },
    { key: 'you', label: member ? 'You' : 'Sign in', icon: 'you', tint: 'fun' },
    { key: 'studio', label: 'Studio', icon: 'rise', tint: 'clever' },
    { key: 'make', label: 'Make a game', icon: 'make', tint: 'tough' },
    ...(isAdmin ? [{ key: 'refdesk', label: 'Ref desk', icon: 'shield', tint: 'more' }] : []),
    { key: 'options', label: 'Options', icon: 'options' },
  ]
  const hub = <HubButton open={hubOpen} onClick={() => setHubOpen((o) => !o)} badge={unread} />

  /* ---------- the Dock for each screen ---------- */
  function renderDock() {
    switch (route.name) {
      case 'discover':
      case 'details': {
        const g = dockGame
        return (
          <Dock>
            {hub}
            {g?.played && <CheerSlot game={g} onCheer={onCheer} onHold={onStampPicker} />}
            <PlayButton onClick={() => play(g)} disabled={!g} ariaLabel={g ? `Play ${g.title}` : 'Play'} />
            <DockSlot icon="talk" label="Talk" disabled={!g} onClick={() => setSheet({ type: 'talk', id: g.id })} />
            <DockSlot icon="more" label="More" disabled={!g} onClick={() => setSheet({ type: 'more', id: g.id })} />
          </Dock>
        )
      }
      case 'find':
      case 'shelves':
        return (
          <Dock>
            {hub}
            <button type="button" className="dock-search" onClick={() => {
              if (route.name !== 'find') go({ name: 'find' })
              setTimeout(() => document.getElementById('find-input')?.focus(), 50)
            }}>
              <Icon name="find" size={20} /><span>{find.query || 'Find games…'}</span>
            </button>
            <DockSlot icon="shelf" label="Filter" selected={route.name === 'find' && find.showFeelings} onClick={() => {
              if (route.name === 'find') setFind((f) => ({ ...f, showFeelings: !f.showFeelings }))
              else { setFind((f) => ({ ...f, showFeelings: true })); go({ name: 'find' }) }
            }} />
          </Dock>
        )
      case 'maker': {
        const c = route.creator
        const inCrew = makerGames(c.id).some((g) => g.following)
        const first = makerGames(c.id)[0]
        return (
          <Dock>
            {hub}
            <PlayButton icon={inCrew ? 'check' : 'crew'} label={inCrew ? 'In crew' : 'Join crew'} wide onClick={() => {
              if (!requireUser('Sign in to join a maker’s crew.')) return
              if (c.id === member.id) { toast('This is you!'); return }
              setFollow(c.id, c.handle, !inCrew)
            }} />
            <DockSlot icon="pass" label="Pass on" onClick={() => share(`Check out @${c.handle}’s games on Nativity: ${window.location.origin}`, `@${c.handle}`)} />
            <DockSlot icon="more" label="More" onClick={() => setSheet({ type: 'makerMore', creator: c, gameId: first?.id })} />
          </Dock>
        )
      }
      case 'you':
        return (
          <Dock>
            {hub}
            <DockSlot icon="crew" label="Crew" selected={youTab === 'crew'} onClick={() => setYouTab('crew')} />
            <PlayButton icon="make" label="Make a game" wide onClick={() => go({ name: 'make' })} />
            <DockSlot icon="options" label="Options" onClick={() => go({ name: 'options' })} />
          </Dock>
        )
      case 'mailbox':
        return (
          <Dock>
            {hub}
            <DockSlot icon="options" label="Settings" onClick={() => go({ name: 'options' })} />
            <PlayButton icon="check" label="Mark all read" wide disabled={!unread} onClick={() => setReadMark(writeMailMark())} />
          </Dock>
        )
      case 'studio':
        return (
          <Dock>
            {hub}
            <DockSlot icon="rise" label="Stats" selected />
            <DockSlot icon="talk" label="Talk" disabled={!studioId || !catalog[studioId]} onClick={() => setSheet({ type: 'talk', id: studioId })} />
            <PlayButton icon="upload" label="New game" wide onClick={() => go({ name: 'make' })} />
          </Dock>
        )
      case 'refdesk':
        return (
          <Dock>
            {hub}
            <DockSlot icon="shield" label="Rules" onClick={() => setSheet({ type: 'rules' })} />
            <PlayButton icon="chevron" label="Next report" wide disabled={!reports?.length} onClick={() => {
              const cards = [...document.querySelectorAll('.ref-card')]
              const next = cards.find((el) => el.getBoundingClientRect().top > 140) || cards[0]
              next?.scrollIntoView({ behavior: prefs.reduceMotion ? 'auto' : 'smooth', block: 'start' })
            }} />
          </Dock>
        )
      default:
        return null
    }
  }

  /* ---------- screens ---------- */
  function renderScreen() {
    switch (route.name) {
      case 'details':
        if (!detailGame) return <main className="screen"><p className="muted">Loading…</p></main>
        return <GameDetails key={detailGame.id} game={detailGame} backLabel={backLabel} makerGames={makerGames(detailGame.creator.id)} autoplay={prefs.autoplay && !playing}
          onBack={back} onMaker={openMaker} onFollow={onFollow} onPlay={play} />
      case 'maker': {
        const list = makerGames(route.creator.id)
        const creator = list[0]?.creator || route.creator
        return <MakerProfile key={creator.id} creator={creator} games={list} backLabel={backLabel} following={list.some((g) => g.following)} onBack={back} onOpen={openGame} />
      }
      case 'find':
        return <Find games={games} query={find.query} setQuery={(q) => setFind((f) => ({ ...f, query: q }))}
          feeling={find.feeling} setFeeling={(v) => setFind((f) => ({ ...f, feeling: v }))}
          shelf={find.shelf} setShelf={(v) => setFind((f) => ({ ...f, shelf: v }))}
          showFeelings={find.showFeelings} onOpen={openGame} />
      case 'shelves':
        return <Shelves games={games} moods={moods} onOpen={openGame}
          onShelf={(k) => { setFind((f) => ({ ...f, shelf: k, query: '' })); go({ name: 'find' }) }}
          onAllFresh={() => { setTab('fresh'); setStack([{ name: 'discover' }]) }} />
      case 'you':
        return <You profile={profile} activity={activity} games={games} tab={youTab} setTab={setYouTab}
          theme={prefs.theme} onTheme={() => setPref('theme', prefs.theme === 'night' ? 'day' : 'night')}
          onOpen={openGame} onLeaveCrew={(c) => setFollow(c.id, c.handle, false)} />
      case 'mailbox':
        return <Mailbox data={mail} error={mailError} readMark={readMark} filter={mailFilter} setFilter={setMailFilter} />
      case 'studio':
        return <Studio myGames={myGames} gameId={studioId} setGameId={setStudioId} stats={studio} error={studioError}
          onMake={() => go({ name: 'make' })} onDelete={deleteMyGame} />
      case 'options':
        return <Options prefs={prefs} setPref={setPref} profile={profile} account={account} blockedCount={blockedCount} member={!!member} isAdmin={isAdmin}
          onDob={() => setSheet({ type: 'dob' })} onExport={exportData} exporting={exporting}
          onDone={() => (stack.length > 1 ? back() : hubGo('discover'))}
          onEditProfile={() => setSheet({ type: 'edit' })}
          onSignIn={() => setAuth({ reason: '' })}
          onSignOut={async () => { await api.signOut(); toast('Signed out'); setStack([{ name: 'discover' }]) }}
          onBlocked={() => setSheet({ type: 'blocked' })} onDoc={setDoc} onDelete={() => setSheet({ type: 'delete' })}
          onRules={() => setSheet({ type: 'rules' })} onRefDesk={() => go({ name: 'refdesk' })} />
      case 'make':
        return <Make onExit={back} toast={toast}
          onPublished={() => { setTab('fresh'); setStack([{ name: 'discover' }]); setCatalog({}); catalogLoaded.current = false; loadFeed() }} />
      case 'refdesk':
        return isAdmin ? <RefDesk items={reports} error={reportsError} busy={refBusy} onAct={refAct} corrections={corrections} onReviewCorrection={reviewCorrection} residencyReviews={residencyQueue} onReviewResidency={reviewResidency} /> : null
      default:
        return (
          <main className="discover" aria-label="Discover">
            <BrandIcon size={28} className="top-mark" />
            <nav className="tuner" aria-label="Channel">
              {CHANNELS.map(([key, label]) => (
                <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
                  {tab === key && <span className="tdots" aria-hidden="true"><i /><i /><i /></span>}{label}
                </button>
              ))}
            </nav>
            <Feed
              games={feedGames} loading={loading} error={error} tab={tab}
              paused={!!playing || !!sheet || onboarding || !!auth || (!member && !adultDeclared) || needsGate || !!blocked} autoplay={prefs.autoplay} dataSaver={dataSaver}
              onActive={setActiveId} onPlay={play} onFollow={onFollow} onOpen={openGame} onMaker={openMaker}
              onView={(id) => api.recordView(id).catch(() => {})}
              onRetry={loadFeed} onFindFresh={() => setTab('fresh')}
            />
          </main>
        )
    }
  }

  return (
    <>
      <aside className="desk-note">
        <h1><BrandLockup height={88} tone="light" /></h1>
        <p>Swipe sideways through a deck of tiny games, then tap PLAY. Every new creator gets their first {BOOST_VIEWS} views guaranteed.</p>
        <p><b>Built for phones.</b> Open this on your phone, or drag, scroll or use the arrow keys inside the frame.</p>
        {api.mode === 'demo' && <p className="demo-pill">Demo mode · data stays in this browser</p>}
      </aside>

      <div className={`app${prefs.reduceMotion ? ' calm' : ''}`} data-theme={prefs.theme}>
        {renderScreen()}
        {!playing && renderDock()}
        {hubOpen && !playing && <HubMenu current={route.name} items={hubItems} onGo={hubGo} onClose={() => setHubOpen(false)} />}

        {playing && (
          <Player
            key={playing.id} game={playing} user={member}
            onClose={closePlayer}
            onCheer={onCheer} onStampPicker={onStampPicker} onFollow={onFollow}
            onComments={(g) => setSheet({ type: 'talk', id: g.id })}
            onPlayed={(g, score) => api.recordPlay(g.id, score)}
            onFeedback={(g, tags) => sendStamps(g, tags)}
            onNeedSignIn={(reason) => setAuth({ reason })}
          />
        )}

        {talkGame && (
          <CommentsSheet
            game={talkGame} user={member} onClose={closeSheet}
            onAdded={(g) => patchGame(g.id, (x) => ({ ...x, comments: x.comments + 1 }))}
            onRemoved={(g) => patchGame(g.id, (x) => ({ ...x, comments: Math.max(0, x.comments - 1) }))}
            onNeedSignIn={(reason) => setAuth({ reason })}
            onReport={onReport} onBlock={onBlock} toast={toast}
          />
        )}
        {stampGame && <StampPicker game={stampGame} onClose={closeSheet} onSend={(g, tags) => sendStamps(g, tags)} />}
        {sheet?.type === 'more' && catalog[sheet.id] && (
          <MoreSheet
            game={catalog[sheet.id]} isOwn={member?.id === catalog[sheet.id].creator.id} onClose={closeSheet}
            onDetails={route.name === 'details' ? null : (g) => { setSheet(null); openGame(g) }}
            onShare={(g) => { setSheet(null); onShare(g) }} onReport={onReport} onBlock={onBlock}
          />
        )}
        {sheet?.type === 'makerMore' && (
          <Sheet title={`@${sheet.creator.handle}`} onClose={closeSheet}>
            <div className="menu">
              {member?.id !== sheet.creator.id && <button type="button" className="danger" onClick={() => onBlock(sheet.creator)}>Block @{sheet.creator.handle}</button>}
              {sheet.gameId && member?.id !== sheet.creator.id && <button type="button" onClick={() => onReport({ type: 'game', id: sheet.gameId, label: catalog[sheet.gameId]?.title })}>Report a game</button>}
            </div>
            <p className="muted small">Blocking hides @{sheet.creator.handle}’s games and notes from you. They won’t be told.</p>
          </Sheet>
        )}
        {sheet?.type === 'report' && (
          <ReportSheet target={sheet.target} onClose={closeSheet} onDone={(ref, reason) => {
            setSheet(null)
            const within = reason === 'intimate' ? GRIEVANCE_TIMES.intimate : reason === 'spam' || reason === 'other' ? GRIEVANCE_TIMES.resolve : GRIEVANCE_TIMES.prohibited
            toast(ref ? `Report received (ref ${ref}). We’ll act within ${within}.` : 'You already reported this. A ref will review it.')
          }} />
        )}
        {sheet?.type === 'edit' && <EditProfileSheet onClose={closeSheet} toast={toast} onSaved={(p) => { setProfile(p); setSheet(null); refreshAll() }} />}
        {sheet?.type === 'blocked' && <BlockedSheet onClose={closeSheet} toast={toast} onChanged={() => { setBlockedCount((n) => Math.max(0, (n || 1) - 1)); refreshAll() }} />}
        {sheet?.type === 'delete' && <DeleteAccountSheet onClose={closeSheet} onDeleted={() => { setSheet(null); setAccount(null); setStack([{ name: 'discover' }]); toast('Your account was deleted') }} />}
        {sheet?.type === 'dob' && <DobSheet state={account} onClose={closeSheet} toast={toast} onChanged={() => { setSheet(null); loadAccount() }} />}
        {reminder && !sheet && !needsGate && (
          <RulesReminder onOpenDoc={setDoc} onClose={() => { setReminder(false); api.ackRulesNotice().catch(() => {}) }} />
        )}
        {sheet?.type === 'rules' && (
          <Sheet title="Community rules" onClose={closeSheet}>
            <p>Nativity is a place for new game makers to be seen. To keep it safe and kind, everyone agrees to a few rules.</p>
            <ul className="rules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="muted small">Anything reported by 3 different people is hidden until a ref decides.</p>
          </Sheet>
        )}

        {auth && <PressStart reason={auth.reason} onClose={() => setAuth(null)} onOpenDoc={setDoc} />}
        {onboarding && (adultDeclared || member) && <Onboarding onDone={(m) => { setOnboarding(false); if (m.length) setMoods(m) }} />}
        {/* Adults only: visitors confirm 18+ before any guest ID is created */}
        {authReady && !member && !adultDeclared && !underage && !outside && <AgeDeclaration onAdult={declareAdult} onUnder={declareUnder} onOutside={declareOutside} onOpenDoc={setDoc} />}
        {authReady && !member && (underage || outside) && (
          <NotForYou reason={outside ? 'country' : 'age'} onBack={() => { writeFlag(UNDERAGE_KEY, false); writeFlag(OUTSIDE_KEY, false); setUnderage(false); setOutside(false) }} />
        )}
        {/* Members: date of birth once, then the current Terms and Privacy Policy */}
        {needsGate && (dobOnlyMissing || !gateLater) && !sheet && (
          <AccountGate
            key={account.ageStatus || 'new'} state={account} onOpenDoc={setDoc}
            onDone={async () => { const st = await loadAccount(); setReminder(false); api.ackRulesNotice().catch(() => {}); if (st?.canParticipate) toast('Welcome to Nativity!'); refreshAll() }}
            onIneligible={() => { loadAccount(); refreshAll() }}
            onResidency={() => { loadAccount(); refreshAll() }}
            onSignOut={async () => { await api.signOut(); setStack([{ name: 'discover' }]) }}
            onLater={() => setGateLater(true)}
          />
        )}
        {member && blocked === 'review' && !sheet && (
          <ResidencyPending
            state={account}
            onCheckAgain={async () => { const r = await api.confirmResidency(true); const st = await loadAccount(); if (r === 'resident') { toast('Thanks, you’re all set!'); refreshAll() } return r === 'resident' ? r : (st && r) }}
            onRequest={async (note) => { await api.requestResidencyReview(note); loadAccount() }}
            onDelete={() => setSheet({ type: 'delete' })}
            onSignOut={async () => { await api.signOut(); setStack([{ name: 'discover' }]) }}
          />
        )}
        {member && blocked === 'country' && !sheet && (
          <NotResidentAccount
            onRequest={async (note) => { await api.requestResidencyReview(note); loadAccount() }}
            onDelete={() => setSheet({ type: 'delete' })}
            onSignOut={async () => { await api.signOut(); setStack([{ name: 'discover' }]) }}
          />
        )}
        {member && account?.ageStatus === 'ineligible' && !sheet && (
          <IneligibleAccount
            state={account}
            onCorrection={() => setSheet({ type: 'dob' })}
            onDelete={() => setSheet({ type: 'delete' })}
            onSignOut={async () => { await api.signOut(); setStack([{ name: 'discover' }]) }}
          />
        )}
        {doc && <LegalSheet doc={doc} onClose={() => setDoc(null)} />}

        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </>
  )
}
