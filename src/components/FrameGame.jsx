import { useEffect, useRef, useState } from 'react'

// Runs a creator's uploaded game safely.
//
// The game is placed in an <iframe sandbox="allow-scripts">. Without
// "allow-same-origin", the browser gives it a blank, unique identity, so it
// CANNOT read the player's sign-in, cookies, saved data or anything else in
// Nativity. It also can't open pop-ups or redirect the page.
//
// We fetch the game's index.html ourselves and add two things at the top:
//   1. <base href> so "./game.js", images, sounds etc. load from storage.
//   2. A small helper that gives the game a working localStorage (saved per
//      game, in this browser), plus Nativity.gameOver(score).

const SAVE_PREFIX = 'nativity:save:'
const MAX_SAVE_CHARS = 200_000

function loadSave(gameId) {
  try { return JSON.parse(localStorage.getItem(SAVE_PREFIX + gameId)) || {} } catch { return {} }
}
function storeSave(gameId, json) {
  try { localStorage.setItem(SAVE_PREFIX + gameId, json) } catch { /* storage full or blocked */ }
}

function helperScript(saved) {
  const data = JSON.stringify(saved).replace(/</g, '\\u003c')
  return `<script>(function(){
var d=${data};
function sync(){try{parent.postMessage({type:'nativity:save',data:JSON.stringify(d)},'*')}catch(e){}}
var has=function(k){return Object.prototype.hasOwnProperty.call(d,k)};
var store={
  getItem:function(k){k=String(k);return has(k)?d[k]:null},
  setItem:function(k,v){d[String(k)]=String(v);sync()},
  removeItem:function(k){delete d[String(k)];sync()},
  clear:function(){d={};sync()},
  key:function(i){return Object.keys(d)[i]||null},
  get length(){return Object.keys(d).length}
};
try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return store}})}catch(e){}
window.Nativity={gameOver:function(score){parent.postMessage({type:'nativity:gameover',score:score},'*')}};
})();</script>`
}

function buildDoc(html, baseUrl, saved) {
  const head = `<base href="${baseUrl.replace(/"/g, '&quot;')}">` + helperScript(saved)
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + head)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + '<head>' + head + '</head>')
  return '<!doctype html><head>' + head + '</head>' + html
}

export default function FrameGame({ game, runKey, onGameOver }) {
  const frameRef = useRef(null)
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')

  // Keep the latest callback without re-subscribing.
  const onGameOverRef = useRef(onGameOver)
  useEffect(() => { onGameOverRef.current = onGameOver })

  useEffect(() => {
    let alive = true
    setDoc(null); setError('')
    fetch(game.bundleUrl + 'index.html', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text() })
      .then((html) => { if (alive) setDoc(buildDoc(html, game.bundleUrl, loadSave(game.id))) })
      .catch(() => { if (alive) setError('This game couldn’t be loaded. Check your connection and try again.') })
    return () => { alive = false }
  }, [game.id, game.bundleUrl, runKey])

  // Messages from the game. Only trust ones that come from THIS frame.
  useEffect(() => {
    function onMessage(e) {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const m = e.data
      if (!m || typeof m !== 'object') return
      if (m.type === 'nativity:save' && typeof m.data === 'string' && m.data.length <= MAX_SAVE_CHARS) storeSave(game.id, m.data)
      if (m.type === 'nativity:gameover') {
        const s = Number(m.score)
        onGameOverRef.current(Number.isFinite(s) && s >= 0 ? Math.min(Math.floor(s), 1e9) : null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [game.id])

  if (error) return <div className="frame-msg"><p>{error}</p></div>
  if (!doc) return <div className="frame-msg"><p>Loading game…</p></div>
  return (
    <iframe
      key={runKey}
      ref={frameRef}
      className="game-frame"
      title={game.title}
      sandbox="allow-scripts allow-pointer-lock"
      allow="autoplay; fullscreen; gamepad"
      referrerPolicy="no-referrer"
      srcDoc={doc}
    />
  )
}
