// Make (Figma 10): upload a game in three steps. 1 Load the files, 2 Label (trailer), 3 Press (publish).
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { SHELVES } from '../lib/activity.js'
import { LIMITS, checkTrailer, formatBytes, parseTags, readGamePackage } from '../lib/uploads.js'
import Icon from '../components/Icon.jsx'
import { Dock, DockSlot, PlayButton, Toggle } from '../components/ui.jsx'

const STEPS = ['Load', 'Label', 'Press']

export default function Make({ onExit, onPublished, toast }) {
  const [step, setStep] = useState(0)
  const [pkg, setPkg] = useState(null)
  const [pkgName, setPkgName] = useState('')
  const [pkgError, setPkgError] = useState('')
  const [checking, setChecking] = useState(false)
  const [trailer, setTrailer] = useState(null) // { file, duration, portrait, url }
  const [trailerError, setTrailerError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shelf, setShelf] = useState(null)
  const [tagText, setTagText] = useState('')
  const [touch, setTouch] = useState(true)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const zipRef = useRef(null)
  const videoRef = useRef(null)
  const recordRef = useRef(null)

  useEffect(() => () => { if (trailer?.url) URL.revokeObjectURL(trailer.url) }, [trailer])

  async function pickGame(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPkg(null); setPkgError(''); setPkgName(file.name); setChecking(true)
    try { setPkg(await readGamePackage(file)) } catch (err) { setPkgError(err.message) } finally { setChecking(false) }
  }
  async function pickTrailer(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setTrailer(null); setTrailerError('')
    try { setTrailer({ file, ...(await checkTrailer(file)) }) } catch (err) { setTrailerError(err.message) }
  }

  const uploading = progress !== null
  const tags = [...new Set([...(shelf ? [SHELVES.find((s) => s.key === shelf).tags[0]] : []), ...parseTags(tagText)])].slice(0, 6)
  const canNext = [!!pkg, !!trailer, !!title.trim()][step]

  async function publish() {
    setError(''); setProgress(0)
    try {
      await api.createGame({ title, description, tags, touchFriendly: touch, pkg, trailer: trailer.file }, setProgress)
      toast(`“${title.trim()}” is live in Fresh`)
      onPublished()
    } catch (err) { setError(err.message); setProgress(null) }
  }

  if (!api.canUpload) {
    return (
      <main className="screen" aria-label="Make">
        <h1 className="h-display page-title">Make</h1>
        <div className="note"><b>Uploads need the live database.</b> Connect Supabase (see the README) and this screen will let you publish.</div>
        <Dock><DockSlot icon="back" label="Back" onClick={onExit} /></Dock>
      </main>
    )
  }

  return (
    <main className="screen" aria-label="Make">
      <div className="title-row">
        <h1 className="h-display page-title">Make</h1>
        <span className="step-pill">Step {step + 1} of 3</span>
      </div>
      <div className="steps" aria-hidden="true">
        {STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''}><i /><b>{i + 1} {s}</b></span>)}
      </div>

      {/* The game files: shown as a "done" card once checked */}
      {pkg && step > 0 && (
        <button type="button" className="done-card" onClick={() => setStep(0)}>
          <span className="check"><Icon name="check" size={18} /></span>
          <span><b>{pkgName}</b><small>{pkg.files.length} file{pkg.files.length === 1 ? '' : 's'} · {formatBytes(pkg.totalBytes)} · boot checks passed</small></span>
        </button>
      )}

      {step === 0 && (
        <section className="stack">
          <h2 className="h-2">Load your game</h2>
          <p className="lede">Your game folder zipped, with index.html at the top. Up to {formatBytes(LIMITS.gameBytes)}.</p>
          <button type="button" className={`drop${pkg ? ' ok' : ''}${pkgError ? ' bad' : ''}`} onClick={() => zipRef.current.click()}>
            <Icon name="zip" size={28} />
            <span><b>{checking ? 'Checking…' : pkgName || 'Choose a .zip or .html'}</b>
              <em>{pkg ? `${pkg.files.length} files · ${formatBytes(pkg.totalBytes)} · index.html found` : 'Tap to pick a file'}</em></span>
          </button>
          <input ref={zipRef} id="up-zip" type="file" hidden accept=".zip,.html,.htm,application/zip" onChange={pickGame} />
          {pkgError && <p className="err">{pkgError}</p>}
          {pkg?.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
          <details className="guide">
            <summary>How to get your game ready</summary>
            <ul>
              <li>Put <code>index.html</code> at the top of your zip. Zipping the game folder itself is fine.</li>
              <li>Load files with relative paths: <code>./sprites/hero.png</code>, not <code>/sprites/hero.png</code>.</li>
              <li>Design for a phone held upright, and use taps or swipes instead of a keyboard.</li>
              <li>Saving high scores with <code>localStorage</code> works as normal.</li>
              <li>Optional: call <code>Nativity.gameOver(score)</code> when a round ends, and <code>Nativity.onPause(fn)</code> / <code>Nativity.onMute(fn)</code> to react to the Pause and Sound buttons.</li>
            </ul>
          </details>
        </section>
      )}

      {step === 1 && (
        <section className="stack">
          <h2 className="h-2">Record the label</h2>
          <p className="lede">A 5 to {LIMITS.trailerSeconds} second clip of someone playing. Vertical works best.</p>
          <div className="label-card">
            <span className="label-prev">{trailer ? <video src={trailer.url} muted playsInline autoPlay loop /> : <Icon name="film" size={32} />}</span>
            <div>
              <b>{trailer ? trailer.file.name : 'No trailer yet'}</b>
              <small className="mono">{trailer ? `${Math.round(trailer.duration)} s · ${formatBytes(trailer.file.size)}${trailer.portrait ? ' · vertical' : ' · landscape'}` : 'mp4, webm or mov'}</small>
              <div className="row">
                <button type="button" className="btn" onClick={() => videoRef.current.click()}>{trailer ? 'Replace' : 'Choose'}</button>
                <button type="button" className="btn" onClick={() => recordRef.current.click()}>Record</button>
              </div>
            </div>
          </div>
          <input ref={videoRef} id="up-video" type="file" hidden accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={pickTrailer} />
          <input ref={recordRef} type="file" hidden accept="video/*" capture="environment" onChange={pickTrailer} />
          {trailerError && <p className="err">{trailerError}</p>}
          {trailer && !trailer.portrait && <p className="warn">This video is landscape. It will be cropped to fill the card.</p>}
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <h2 className="h-2">Press it</h2>
          <label className="field"><span>Game title</span>
            <input id="up-title" type="text" maxLength={40} placeholder="e.g. Kite Hop" value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
          </label>
          <label className="field"><span>Description</span>
            <textarea id="up-desc" rows={2} maxLength={280} placeholder="What is it and how do you play?" value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} />
          </label>
          <div className="field"><span>Shelf</span>
            <div className="chip-row">
              {SHELVES.map((s) => <button key={s.key} type="button" className="seg" aria-selected={shelf === s.key} onClick={() => setShelf(shelf === s.key ? null : s.key)} disabled={uploading}>{s.label}</button>)}
            </div>
          </div>
          <label className="field"><span>Tags</span>
            <input id="up-tags" type="text" placeholder="space, survival" value={tagText} onChange={(e) => setTagText(e.target.value)} disabled={uploading} />
            {tags.length > 0 && <small>{tags.map((t) => '#' + t).join('  ')}</small>}
          </label>
          <div className="group">
            <div className="orow"><span>Works with touch controls</span><Toggle checked={touch} onChange={setTouch} label="Works with touch controls" /></div>
          </div>
          {error && <p className="err">{error}</p>}
          {uploading && (
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div className="bar"><i style={{ width: `${progress * 100}%` }} /></div>
              <span>Uploading… {Math.round(progress * 100)}%</span>
            </div>
          )}
        </section>
      )}

      <Dock label="Make steps">
        <DockSlot icon="back" label="Back" disabled={uploading} onClick={() => (step ? setStep(step - 1) : onExit())} />
        <span className="step-dots" aria-hidden="true">{STEPS.map((s, i) => <i key={s} className={i === step ? 'on' : ''} />)}</span>
        {step < 2
          ? <PlayButton icon="chevron" label={`Next: ${STEPS[step + 1].toLowerCase()}`} wide disabled={!canNext} onClick={() => setStep(step + 1)} />
          : <PlayButton icon="upload" label={uploading ? 'Pressing…' : 'Publish'} wide disabled={!canNext || uploading} onClick={publish} />}
      </Dock>
    </main>
  )
}
