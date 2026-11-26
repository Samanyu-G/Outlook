import { useEffect, useRef, useState } from 'react'
import { api, timeAgo } from '../lib/api.js'
import Sheet from './Sheet.jsx'

export default function CommentsSheet({ game, user, onClose, onAdded, onNeedSignIn }) {
  const [comments, setComments] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const listEnd = useRef(null)

  useEffect(() => {
    api.listComments(game.id).then(setComments).catch((e) => setError(e.message))
  }, [game.id])

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    if (!user) { onNeedSignIn('Sign in to comment.'); return }
    setPosting(true); setError('')
    try {
      const c = await api.addComment(game.id, body)
      setComments((list) => [...(list || []), c])
      setText('')
      onAdded(game)
      setTimeout(() => listEnd.current?.scrollIntoView({ block: 'end' }), 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  const count = comments ? comments.length : game.comments
  return (
    <Sheet
      title={`${count} comment${count === 1 ? '' : 's'} on ${game.title}`}
      onClose={onClose}
      footer={
        <form className="compose" onSubmit={submit}>
          <input
            id="comment-input" type="text" maxLength={240} autoComplete="off"
            placeholder={user ? 'Say something kind and useful…' : 'Sign in to comment'}
            aria-label="Write a comment" value={text} onChange={(e) => setText(e.target.value)}
            onFocus={() => { if (!user) onNeedSignIn('Sign in to comment.') }}
          />
          <button type="submit" disabled={!text.trim() || posting}>{posting ? '…' : 'Post'}</button>
        </form>
      }
    >
      {error && <p className="err">{error}</p>}
      {!comments && !error && <p className="muted">Loading comments…</p>}
      {comments && !comments.length && <p className="muted">No comments yet. Tell @{game.creator.handle} what you liked.</p>}
      {comments?.map((c) => (
        <div className="cm" key={c.id}>
          <span className="av" style={{ background: c.color }}>{c.handle.slice(0, 2).toUpperCase()}</span>
          <div>
            <div className="u">
              <b>@{c.handle}{c.userId === game.creator.id && <span className="creator-tag">CREATOR</span>}</b>
              {timeAgo(c.createdAt)}
            </div>
            <p>{c.body}</p>
          </div>
        </div>
      ))}
      <div ref={listEnd} />
    </Sheet>
  )
}
