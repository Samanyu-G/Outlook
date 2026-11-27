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
var pauseFns=[],muteFns=[],ctxs=[],muted=false;
// Track Web Audio contexts so the Sound button can silence them.
['AudioContext','webkitAudioContext'].forEach(function(n){var C=window[n];if(!C)return;var W=function(){var c=new (Function.prototype.bind.apply(C,[null].concat([].slice.call(arguments))))();ctxs.push(c);if(muted)try{c.suspend()}catch(e){}return c};W.prototype=C.prototype;window[n]=W});
function applyMute(){document.querySelectorAll('audio,video').forEach(function(m){m.muted=muted});ctxs.forEach(function(c){try{muted?c.suspend():c.resume()}catch(e){}})}
window.addEventListener('message',function(e){var m=e.data;if(!m||e.source!==parent)return;
  if(m.type==='nativity:pause'){pauseFns.forEach(function(f){try{f(!!m.paused)}catch(err){}});ctxs.forEach(function(c){try{m.paused?c.suspend():(!muted&&c.resume())}catch(err){}})}
  if(m.type==='nativity:mute'){muted=!!m.muted;applyMute();muteFns.forEach(function(f){try{f(muted)}catch(err){}})}
});
window.Nativity={
  gameOver:function(score){parent.postMessage({type:'nativity:gameover',score:score},'*')},
  onPause:function(f){if(typeof f==='function')pauseFns.push(f)},
  onMute:function(f){if(typeof f==='function')muteFns.push(f)}
};
})();</script>`
}

function buildDoc(html, baseUrl, saved) {
  const head = `<base href="${baseUrl.replace(/"/g, '&quot;')}">` + helperScript(saved)
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + head)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + '<head>' + head + '</head>')
  return '<!doctype html><head>' + head + '</head>' + html
}

export default function FrameGame({ game, runKey, onGameOver, paused = false, muted = false }) {
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

  // Pause and Sound buttons: tell the game (it can listen with Nativity.onPause / onMute).
  useEffect(() => { frameRef.current?.contentWindow?.postMessage({ type: 'nativity:pause', paused }, '*') }, [paused, doc])
  useEffect(() => { frameRef.current?.contentWindow?.postMessage({ type: 'nativity:mute', muted }, '*') }, [muted, doc])

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
      onLoad={() => { const w = frameRef.current?.contentWindow; w?.postMessage({ type: 'nativity:mute', muted }, '*'); if (paused) w?.postMessage({ type: 'nativity:pause', paused }, '*') }}
    />
  )
}
