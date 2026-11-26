import { useState } from 'react'
import { BOOST_VIEWS } from '../lib/api.js'
import { FileIcon, FilmIcon } from './Icons.jsx'
import Sheet from './Sheet.jsx'

// Phase 2 makes this real (storage, zip checks, sandboxed hosting).
// For now it shows creators what uploading will look like.
export default function UploadSheet({ onClose, toast }) {
  const [zip, setZip] = useState('')
  const [video, setVideo] = useState('')
  return (
    <Sheet title="Upload your game" onClose={onClose}>
      <div className="note"><b>Every new game gets {BOOST_VIEWS} guaranteed views</b> in the Fresh feed, no matter how many followers you have.</div>
      <label className="field"><span>Game title</span><input id="up-title" type="text" maxLength={40} placeholder="e.g. Kite Hop" /></label>
      <div className="field">
        <span>Game files</span>
        <label className="drop"><FileIcon /><div><b>{zip || 'Choose a .zip'}</b><em>index.html plus your JS, images and sounds · up to 25 MB</em></div>
          <input id="up-zip" type="file" accept=".zip,.html" onChange={(e) => setZip(e.target.files[0]?.name || '')} /></label>
      </div>
      <div className="field">
        <span>Trailer</span>
        <label className="drop"><FilmIcon /><div><b>{video || 'Choose a video'}</b><em>5 to 15 seconds, vertical, no sound needed</em></div>
          <input id="up-video" type="file" accept="video/*" onChange={(e) => setVideo(e.target.files[0]?.name || '')} /></label>
      </div>
      <label className="field"><span>Description</span><textarea id="up-desc" rows={2} maxLength={280} placeholder="What is it and how do you play?" /></label>
      <label className="toggle"><span>Works with touch controls</span><input id="up-touch" type="checkbox" defaultChecked /></label>
      <button type="button" className="btn primary" onClick={() => { onClose(); toast('Uploads arrive in Phase 2.') }}>Publish to Fresh</button>
      <p className="muted small">Coming in Phase 2: uploads aren’t stored yet.</p>
    </Sheet>
  )
}
