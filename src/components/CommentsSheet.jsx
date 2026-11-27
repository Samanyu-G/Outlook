import { useEffect, useRef, useState } from 'react'
import { api, initials, timeAgo } from '../lib/api.js'
import Icon from './Icon.jsx'
import { CloseButton, StampFromTag } from './ui.jsx'

// Talk (Figma 08): notes on a game. "Helpful" keeps each player's note together
// with the maker's replies to it, threads with a reply first; "New" is newest first.
function helpfulOrder(list, makerId) {
  const threads = []
  for (const c of list) {
    if (c.userId === makerId && threads.length) threads[threads.length - 1].push(c)
    else threads.push([c])
  }
  const score = (t) => (t.some((c) => c.userId === makerId) && t[0].userId !== makerId ? 1000 : 0) + (t[0].stamp ? 300 : 0) + t[0].body.length
  return threads.sort((a, b) => score(b) - score(a)).flat()
}

export default function CommentsSheet({ game, user, onClose, onAdded, onRemoved, onNeedSignIn, onReport, onBlock, toast }) {
  const [menuFor, setMenuFor] = useState(null)
  const [comments, setComments] = useState(null)
  const [order, setOrder] = useState('helpful')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    api.listComments(game.id).then(setComments).catch((e) => setError(e.message))
  }, [game.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    if (!user) { onNeedSignIn('Sign in to talk with makers.'); return }
    setPosting(true); setError('')
    try {
      const c = await api.addComment(game.id, body)
      setComments((list) => [...(list || []), c])
      setText(''); setOrder('new')
      onAdded(game)
      setTimeout(() => listRef.current?.scrollTo({ top: 0 }), 0)
    } catch (err) { setError(err.message) } finally { setPosting(false) }
  }

  async function remove(c) {
    try {
      await api.deleteComment(c.id)
      setComments((list) => list.filter((x) => x.id !== c.id))
      setMenuFor(null); onRemoved(game); toast('Note deleted')
    } catch (err) { setError(err.message) }
  }

  const makerId = game.creator.id
  const count = comments ? comments.length : game.comments
  const shown = !comments ? [] : order === 'new' ? [...comments].reverse() : helpfulOrder(comments, makerId)

  return (
    <div className="backdrop talk-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet talk" role="dialog" aria-modal="true" aria-label={`Talk on ${game.title}`}>
        <span className="grab" aria-hidden="true" />
        <div className="talk-h">
          <div><h3 className="h-2">Talk</h3><small>{game.title} · {count} note{count === 1 ? '' : 's'}</small></div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="chip-row">
          {[['helpful', 'Helpful'], ['new', 'New']].map(([k, l]) => <button key={k} type="button" className="seg" aria-selected={order === k} onClick={() => setOrder(k)}>{l}</button>)}
        </div>
        <div className="sheet-b" ref={listRef}>
          {error && <p className="err">{error}</p>}
          {!comments && !error && <p className="muted">Loading notes…</p>}
          {comments && !comments.length && <p className="muted">No notes yet. Tell @{game.creator.handle} what you liked.</p>}
          {shown.map((c) => {
            const maker = c.userId === makerId
            return (
              <div className={`tnote${maker ? ' maker' : ''}`} key={c.id}>
                <div className="tnote-h">
                  <span className="avatar s24" style={{ background: c.color }} aria-hidden="true">{initials(c.handle)}</span>
                  <b>@{c.handle}</b>
                  {maker && <span className="maker-tag">Maker</span>}
                  <small>{timeAgo(c.createdAt)}</small>
                  {c.hidden && <span className="pill soft">hidden</span>}
                  {c.stamp && !maker && <StampFromTag tag={c.stamp} />}
                  <button type="button" className="cm-more" aria-label="Note options" aria-expanded={menuFor === c.id}
                    onClick={() => { if (!user) { onNeedSignIn('Sign in to report or manage notes.'); return } setMenuFor((m) => (m === c.id ? null : c.id)) }}>
                    <Icon name="more" size={18} />
                  </button>
                </div>
                <p>{c.body}</p>
                {menuFor === c.id && (
                  <div className="cm-menu">
                    {(c.userId === user?.id || makerId === user?.id) && <button type="button" onClick={() => remove(c)}>Delete</button>}
                    {c.userId !== user?.id && <button type="button" onClick={() => onReport({ type: 'comment', id: c.id, label: c.body.slice(0, 40) })}>Report</button>}
                    {c.userId !== user?.id && <button type="button" className="danger" onClick={() => onBlock({ id: c.userId, handle: c.handle })}>Block @{c.handle}</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="talk-foot">
          <p className="small muted">Be kind and specific. What worked? What would you change?</p>
          <form className="compose" onSubmit={submit}>
            <input
              id="comment-input" type="text" maxLength={240} autoComplete="off"
              placeholder={user ? 'Add a note…' : 'Sign in to add a note'}
              aria-label="Write a note" value={text} onChange={(e) => setText(e.target.value)}
              onFocus={() => { if (!user) onNeedSignIn('Sign in to talk with makers.') }}
            />
            <button type="submit" disabled={!text.trim() || posting}>{posting ? '…' : 'Post'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
