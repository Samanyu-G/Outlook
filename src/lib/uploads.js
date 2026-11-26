// Checks a creator's game and trailer on the phone, BEFORE anything is uploaded.
// Supabase enforces size and file-type limits too (see 0003_uploads.sql), so
// these checks are about giving creators clear, friendly errors early.
import { unzip } from 'fflate'

export const LIMITS = {
  gameBytes: 25 * 1024 * 1024,
  gameFiles: 300,
  trailerBytes: 15 * 1024 * 1024,
  trailerSeconds: 30,
}

// File type by extension. HTML is stored as plain text on purpose: the app
// reads index.html itself and runs it in a sandbox (see FrameGame in Player.jsx).
const TYPES = {
  html: 'text/plain', htm: 'text/plain', txt: 'text/plain', csv: 'text/plain', xml: 'text/plain',
  md: 'text/plain', fnt: 'text/plain', atlas: 'text/plain', tmx: 'text/plain', glsl: 'text/plain', frag: 'text/plain', vert: 'text/plain',
  js: 'text/javascript', mjs: 'text/javascript',
  css: 'text/css', json: 'application/json', map: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  mp4: 'video/mp4', webm: 'video/webm',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  wasm: 'application/wasm', glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream', data: 'application/octet-stream',
}
const TRAILER_TYPES = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }

// Files that operating systems sneak into zips. We quietly skip them.
const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|\.git\/)/i

const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '')
export const typeFor = (path) => TYPES[ext(path)]
export const trailerTypeFor = (file) => TRAILER_TYPES[ext(file.name)] || file.type
export const formatBytes = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')

class UploadError extends Error {}

function unzipAsync(data, filter) {
  return new Promise((resolve, reject) => unzip(data, { filter }, (err, out) => (err ? reject(err) : resolve(out))))
}

function cleanPath(raw) {
  const p = raw.replace(/\\/g, '/').replace(/^\.\//, '')
  if (p.startsWith('/') || p.split('/').some((seg) => seg === '..')) throw new UploadError(`“${raw}” has an unsafe path.`)
  return p
}

/**
 * Reads a .zip (or a single .html file) and returns
 * { files: [{ path, data, type, size }], totalBytes, warnings }.
 * Throws an Error with a creator-friendly message when something is wrong.
 */
export async function readGamePackage(file) {
  const kind = ext(file.name)
  if (kind !== 'zip' && kind !== 'html' && kind !== 'htm') throw new UploadError('Choose a .zip of your game folder, or a single .html file.')
  if (file.size > LIMITS.gameBytes) throw new UploadError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(LIMITS.gameBytes)}.`)

  const bytes = new Uint8Array(await file.arrayBuffer())
  let entries

  if (kind !== 'zip') {
    entries = { 'index.html': bytes }
  } else {
    let declared = 0, count = 0
    try {
      entries = await unzipAsync(bytes, (f) => {
        if (f.name.endsWith('/') || JUNK.test(f.name)) return false
        count++; declared += f.originalSize
        return count <= LIMITS.gameFiles && declared <= LIMITS.gameBytes
      })
    } catch {
      throw new UploadError('That zip file could not be opened. Try zipping your game folder again.')
    }
    if (count > LIMITS.gameFiles) throw new UploadError(`Your game has ${count} files. The limit is ${LIMITS.gameFiles}.`)
    if (declared > LIMITS.gameBytes) throw new UploadError(`Unzipped, your game is ${formatBytes(declared)}. The limit is ${formatBytes(LIMITS.gameBytes)}.`)
  }

  let files = Object.entries(entries).map(([name, data]) => ({ path: cleanPath(name), data, size: data.length }))
  if (!files.length) throw new UploadError('That zip is empty.')

  // If everything is inside one folder (zipping "MyGame/"), lift it out.
  const hasRootIndex = files.some((f) => f.path.toLowerCase() === 'index.html')
  const firstSeg = files[0].path.split('/')[0]
  if (!hasRootIndex && files.every((f) => f.path.startsWith(firstSeg + '/'))) {
    files = files.map((f) => ({ ...f, path: f.path.slice(firstSeg.length + 1) }))
  }
  const index = files.find((f) => f.path.toLowerCase() === 'index.html')
  if (!index) throw new UploadError('No index.html found. Your game’s main page must be called index.html and sit at the top of the zip.')
  index.path = 'index.html'

  const unknown = files.filter((f) => !typeFor(f.path))
  if (unknown.length) {
    const list = [...new Set(unknown.map((f) => '.' + (ext(f.path) || f.path)))].slice(0, 5).join(', ')
    throw new UploadError(`These file types aren’t allowed: ${list}. Remove them and zip again.`)
  }
  files = files.map((f) => ({ ...f, type: typeFor(f.path) }))
  const totalBytes = files.reduce((s, f) => s + f.size, 0)
  if (totalBytes > LIMITS.gameBytes) throw new UploadError(`Unzipped, your game is ${formatBytes(totalBytes)}. The limit is ${formatBytes(LIMITS.gameBytes)}.`)

  // Friendly warnings about things that commonly break games once hosted.
  const warnings = []
  const html = new TextDecoder().decode(index.data)
  if (/\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(html)) {
    warnings.push('index.html loads files with paths starting with “/”. Those break once uploaded. Use relative paths like “./game.js”. (Vite users: set base: "./" in vite.config.js.)')
  }
  if (/\b(?:src|href)\s*=\s*["']http:\/\//i.test(html)) {
    warnings.push('index.html loads something over http://. Browsers block that; use https://.')
  }
  const otherPages = files.filter((f) => /\.html?$/i.test(f.path) && f.path !== 'index.html')
  if (otherPages.length) warnings.push('Only index.html is opened. Links to other .html pages inside your game won’t work.')

  return { files, totalBytes, warnings }
}

/** Checks the trailer video: type, size, length. Returns { duration, portrait, url }. */
export function checkTrailer(file) {
  return new Promise((resolve, reject) => {
    if (!TRAILER_TYPES[ext(file.name)] && !/^video\/(mp4|webm|quicktime)$/.test(file.type)) {
      reject(new UploadError('Trailers must be .mp4, .webm or .mov videos.')); return
    }
    if (file.size > LIMITS.trailerBytes) {
      reject(new UploadError(`Your trailer is ${formatBytes(file.size)}. The limit is ${formatBytes(LIMITS.trailerBytes)}. Try a shorter clip or lower quality.`)); return
    }
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'; v.muted = true
    const timer = setTimeout(() => fail(), 10000)
    function fail() {
      clearTimeout(timer); URL.revokeObjectURL(url)
      reject(new UploadError('This video can’t be played in a browser. Export it as MP4 (H.264) and try again.'))
    }
    v.onerror = fail
    v.onloadedmetadata = () => {
      // Videos recorded in a browser often don't store their length. Jumping
      // far past the end makes the browser work it out.
      if (v.duration === Infinity) {
        v.ondurationchange = () => { if (Number.isFinite(v.duration)) { v.ondurationchange = null; done() } }
        v.currentTime = 1e7
        return
      }
      done()
    }
    function done() {
      clearTimeout(timer)
      if (!Number.isFinite(v.duration) || v.duration <= 0) { fail(); return }
      if (v.duration > LIMITS.trailerSeconds + 0.5) {
        URL.revokeObjectURL(url)
        reject(new UploadError(`Your trailer is ${Math.round(v.duration)} seconds. Keep it to ${LIMITS.trailerSeconds} seconds or less.`)); return
      }
      resolve({ duration: v.duration, portrait: v.videoHeight >= v.videoWidth, url })
    }
    v.src = url
  })
}

/** Turns "Arcade, one-tap  #Space" into ["arcade", "onetap", "space"] (max 5). */
export function parseTags(text) {
  return [...new Set(text.split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean))].slice(0, 5).map((t) => t.slice(0, 20))
}
