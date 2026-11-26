import { useEffect, useState } from 'react'
import { api, BOOST_VIEWS } from '../lib/api.js'
import { LIMITS, checkTrailer, formatBytes, parseTags, readGamePackage } from '../lib/uploads.js'
import { FileIcon, FilmIcon } from './Icons.jsx'
import Sheet from './Sheet.jsx'

export default function UploadSheet({ onClose, onPublished, toast }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagText, setTagText] = useState('')
  const [touch, setTouch] = useState(true)

  const [pkg, setPkg] = useState(null)          // checked game files
  const [pkgName, setPkgName] = useState('')
  const [pkgError, setPkgError] = useState('')
  const [checkingPkg, setCheckingPkg] = useState(false)

  const [trailer, setTrailer] = useState(null)  // { file, duration, portrait, url }
  const [trailerError, setTrailerError] = useState('')

  const [progress, setProgress] = useState(null) // 0..1 while uploading
  const [error, setError] = useState('')

  // Free the trailer preview when it changes or the sheet closes.
  useEffect(() => () => { if (trailer?.url) URL.revokeObjectURL(trailer.url) }, [trailer])

  async function pickGame(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPkg(null); setPkgError(''); setPkgName(file.name); setCheckingPkg(true)
    try { setPkg(await readGamePackage(file)) } catch (err) { setPkgError(err.message) } finally { setCheckingPkg(false) }
  }

  async function pickTrailer(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setTrailer(null); setTrailerError('')
    try { setTrailer({ file, ...(await checkTrailer(file)) }) } catch (err) { setTrailerError(err.message) }
  }

  const tags = parseTags(tagText)
  const ready = title.trim() && pkg && trailer && progress === null
  const uploading = progress !== null

  async function publish() {
    setError(''); setProgress(0)
    try {
      await api.createGame({ title, description, tags, touchFriendly: touch, pkg, trailer: trailer.file }, setProgress)
      toast(`“${title.trim()}” is live in Fresh`)
      onPublished()
    } catch (err) {
      setError(err.message)
      setProgress(null)
    }
  }

  if (!api.canUpload) {
    return (
      <Sheet title="Upload your game" onClose={onClose}>
        <div className="note"><b>Uploads need the live database.</b> Connect Supabase (see the README) and this screen will let you publish.</div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Upload your game" onClose={uploading ? () => {} : onClose}>
      <div className="note"><b>Every new game gets {BOOST_VIEWS} guaranteed views</b> in the Fresh feed, no matter how many followers you have.</div>

      <label className="field"><span>Game title</span>
        <input id="up-title" type="text" maxLength={40} placeholder="e.g. Kite Hop" value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
      </label>

      <div className="field">
        <span>Game files</span>
        <label className={`drop${pkg ? ' ok' : ''}${pkgError ? ' bad' : ''}`}>
          <FileIcon />
          <div>
            <b>{checkingPkg ? 'Checking…' : pkgName || 'Choose a .zip or .html'}</b>
            <em>{pkg ? `${pkg.files.length} file${pkg.files.length === 1 ? '' : 's'} · ${formatBytes(pkg.totalBytes)} · index.html found` : `Your game folder zipped, with index.html at the top · up to ${formatBytes(LIMITS.gameBytes)}`}</em>
          </div>
          <input id="up-zip" type="file" accept=".zip,.html,.htm,application/zip" onChange={pickGame} disabled={uploading} />
        </label>
        {pkgError && <p className="err">{pkgError}</p>}
        {pkg?.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
      </div>

      <div className="field">
        <span>Trailer</span>
        <label className={`drop${trailer ? ' ok' : ''}${trailerError ? ' bad' : ''}`}>
          {trailer ? <video className="thumb" src={trailer.url} muted playsInline autoPlay loop /> : <FilmIcon />}
          <div>
            <b>{trailer ? trailer.file.name : 'Choose a video'}</b>
            <em>{trailer ? `${Math.round(trailer.duration)}s · ${formatBytes(trailer.file.size)}${trailer.portrait ? ' · vertical' : ''}` : `A ${LIMITS.trailerSeconds}-second-or-less clip of your game · vertical works best`}</em>
          </div>
          <input id="up-video" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={pickTrailer} disabled={uploading} />
        </label>
        {trailerError && <p className="err">{trailerError}</p>}
        {trailer && !trailer.portrait && <p className="warn">This video is landscape. It will be cropped to fill a phone screen.</p>}
      </div>

      <label className="field"><span>Description</span>
        <textarea id="up-desc" rows={2} maxLength={280} placeholder="What is it and how do you play?" value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} />
      </label>

      <label className="field"><span>Tags</span>
        <input id="up-tags" type="text" placeholder="arcade, onetap, space" value={tagText} onChange={(e) => setTagText(e.target.value)} disabled={uploading} />
        {tags.length > 0 && <small>{tags.map((t) => '#' + t).join('  ')}</small>}
      </label>

      <label className="toggle"><span>Works with touch controls</span>
        <input id="up-touch" type="checkbox" checked={touch} onChange={(e) => setTouch(e.target.checked)} disabled={uploading} />
      </label>

      <details className="guide">
        <summary>How to get your game ready</summary>
        <ul>
          <li>Put <code>index.html</code> at the top of your zip. Zipping the game folder itself is fine.</li>
          <li>Load files with relative paths: <code>./sprites/hero.png</code>, not <code>/sprites/hero.png</code>.</li>
          <li>Design for a phone held upright, and use taps or swipes instead of a keyboard.</li>
          <li>Saving high scores with <code>localStorage</code> works as normal.</li>
          <li>Optional: call <code>Nativity.gameOver(score)</code> when a round ends to show the score and ask players for feedback.</li>
        </ul>
      </details>

      {error && <p className="err">{error}</p>}
      {uploading ? (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="bar"><i style={{ width: `${progress * 100}%` }} /></div>
          <span>Uploading… {Math.round(progress * 100)}%</span>
        </div>
      ) : (
        <button type="button" className="btn primary" disabled={!ready} onClick={publish}>Publish to Fresh</button>
      )}
      {!ready && !uploading && <p className="muted small">Add a title, your game files and a trailer to publish.</p>}
    </Sheet>
  )
}
