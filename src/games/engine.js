// The game "runner": owns the canvas, the animation loop and the game's state machine.
//
//  mode 'demo' -> the trailer. The game's built-in AI plays and it restarts by itself.
//  mode 'play' -> the real thing. Waits for "Tap to start", reports score and game over.
//
// Every game is a factory function: (api) => ({ reset, step, draw, ai, hint, start?, down?, move?, fx? })
// The runner calls those functions; the game never touches the DOM itself.

export const rand = (a, b) => a + Math.random() * (b - a)
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function circle(ctx, x, y, r) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
}

export function createRunner(canvas, factory, mode, hooks = {}) {
  const ctx = canvas.getContext('2d')
  let sc = 0, state = 'ready', overT = 0, raf = 0, last = 0, running = false, sized = false

  const api = {
    W: 1, H: 1,
    score(v) { sc = v; hooks.onScore?.(v) },
    over() {
      if (state !== 'run') return
      state = 'over'; overT = 0
      hooks.onOver?.(sc)
    },
  }
  const game = factory(api)

  // Match the canvas's pixel size to its on-screen size (sharp on high-DPI phones).
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    const d = Math.min(2, window.devicePixelRatio || 1)
    if (w !== api.W || h !== api.H) {
      api.W = w; api.H = h
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d)
      ctx.setTransform(d, 0, 0, d, 0, 0)
      if (!sized) { sized = true; reset() }
    }
  }
  function reset() { sc = 0; game.reset(); hooks.onScore?.(0) }

  function tick(dt) {
    if (state === 'run') {
      if (mode === 'demo') game.ai(dt)
      game.step(dt)
    } else if (state === 'over') {
      overT += dt
      game.fx?.(dt)
      if (mode === 'demo' && overT > 1) { reset(); state = 'run' }
    }
  }

  function draw() {
    ctx.save(); game.draw(ctx); ctx.restore()
    const { W, H } = api
    if (mode === 'demo') {
      ctx.font = `700 ${Math.round(W * 0.14)}px "JetBrains Mono", monospace`
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.22)'
      ctx.fillText(sc, W / 2, H * 0.2)
      if (state === 'over') { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.4, overT * 0.6)})`; ctx.fillRect(0, 0, W, H) }
    }
    if (mode === 'play' && state === 'ready') {
      ctx.fillStyle = 'rgba(245,239,230,.8)'; ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'; ctx.fillStyle = '#c9785c'
      ctx.font = '800 30px "Bricolage Grotesque", sans-serif'
      ctx.fillText('Tap to start', W / 2, H * 0.46)
      ctx.fillStyle = '#4a3f36'; ctx.font = '500 15px "DM Sans", sans-serif'
      ctx.fillText(game.hint || '', W / 2, H * 0.46 + 32)
    }
  }

  function frame(t) {
    if (!running) return
    fit()
    const dt = Math.min(0.033, (t - last) / 1000 || 0)
    last = t
    tick(dt); draw()
    raf = requestAnimationFrame(frame)
  }

  // Touch / mouse input, only in play mode.
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const onDown = (e) => {
    e.preventDefault()
    const [x, y] = pos(e)
    if (state === 'ready') { state = 'run'; game.start?.(x, y); return }
    if (state === 'run') game.down?.(x, y)
  }
  const onMove = (e) => {
    if (state !== 'run') return
    if (e.pointerType !== 'mouse' || e.buttons) { const [x, y] = pos(e); game.move?.(x, y) }
  }
  if (mode === 'play') {
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
  }

  fit()
  if (!sized) reset()
  if (mode === 'demo') state = 'run'

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame) },
    stop() { running = false; cancelAnimationFrame(raf) },
    warm(sec) { fit(); for (let i = 0; i < sec * 60; i++) tick(1 / 60); draw() },
    restart() { reset(); state = mode === 'demo' ? 'run' : 'ready' },
    destroy() {
      running = false; cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
    },
  }
}
