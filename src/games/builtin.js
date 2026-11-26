// Built-in demo games. In the database, games.builtin_key picks one of these.
// Phase 2 replaces these with creator uploads running in a sandboxed iframe.
import { rand, clamp, rr, circle } from './engine.js'

/* Kite Hop: tap to lift */
function kiteHop(api) {
  let s; const R = 13
  const g = { hint: 'Tap anywhere to lift the kite' }
  const px = () => api.W * 0.3
  const speed = () => Math.max(150, api.W * 0.42) + s.sc * 4
  const flap = () => { s.vy = -470 }
  g.reset = () => { s = { y: api.H * 0.42, vy: 0, pipes: [], spawn: 0.5, sc: 0, t: 0, trail: [] } }
  g.start = flap; g.down = flap
  g.step = (dt) => {
    const { W, H } = api; s.t += dt
    s.vy = Math.min(s.vy + 1500 * dt, 700); s.y += s.vy * dt
    s.spawn -= dt
    if (s.spawn <= 0) { s.pipes.push({ x: W + 40, c: rand(H * 0.3, H * 0.68), g: Math.max(170, H * 0.26), passed: false }); s.spawn = 270 / speed() }
    const x = px()
    for (const p of s.pipes) {
      p.x -= speed() * dt
      if (!p.passed && p.x + 28 < x) { p.passed = true; s.sc++; api.score(s.sc) }
      if (Math.abs(p.x - x) < 28 + R * 0.8 && (s.y - R * 0.8 < p.c - p.g / 2 || s.y + R * 0.8 > p.c + p.g / 2)) api.over()
    }
    s.pipes = s.pipes.filter((p) => p.x > -60)
    s.trail.push(s.y); if (s.trail.length > 16) s.trail.shift()
    if (s.y > H - 24 || s.y < -60) api.over()
  }
  g.ai = () => {
    const x = px(); const p = s.pipes.find((p) => p.x + 28 > x - R)
    const target = p ? p.c + p.g * 0.1 : api.H * 0.5
    if (s.y > target + rand(-4, 4) && s.vy > 0) flap()
  }
  g.draw = (ctx) => {
    const { W, H } = api, x = px()
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#24275f'); sky.addColorStop(0.62, '#b9557c'); sky.addColorStop(1, '#f4a76a')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,226,160,.35)'; circle(ctx, W * 0.74, H * 0.66, W * 0.2); ctx.fill()
    ctx.fillStyle = 'rgba(42,26,64,.45)'; const off = (s.t * 20) % W
    for (let k = -1; k < 3; k++) { ctx.beginPath(); ctx.ellipse(k * W * 0.6 - off, H - 10, W * 0.45, H * 0.12, 0, 0, Math.PI * 2); ctx.fill() }
    for (const p of s.pipes) {
      ctx.fillStyle = '#2a1d3f'
      rr(ctx, p.x - 28, -12, 56, p.c - p.g / 2 + 12, 10); ctx.fill()
      rr(ctx, p.x - 28, p.c + p.g / 2, 56, H, 10); ctx.fill()
      ctx.fillStyle = 'rgba(255,201,74,.55)'
      for (let wy = p.c + p.g / 2 + 18; wy < H; wy += 26) { ctx.fillRect(p.x - 14, wy, 8, 10); ctx.fillRect(p.x + 6, wy + 6, 8, 10) }
      for (let wy = p.c - p.g / 2 - 28; wy > 0; wy -= 26) { ctx.fillRect(p.x - 14, wy, 8, 10); ctx.fillRect(p.x + 6, wy - 6, 8, 10) }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.beginPath()
    const n = s.trail.length
    for (let i = 0; i < n; i++) { const tx = x - (n - i) * 7, ty = s.trail[i] + R * 1.2; i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty) }
    ctx.stroke()
    ctx.save(); ctx.translate(x, s.y); ctx.rotate(clamp(s.vy / 1300, -0.5, 0.6))
    ctx.beginPath(); ctx.moveTo(0, -R * 1.4); ctx.lineTo(R, 0); ctx.lineTo(0, R * 1.4); ctx.lineTo(-R, 0); ctx.closePath()
    ctx.fillStyle = '#ffc94a'; ctx.fill()
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 1.5; ctx.beginPath()
    ctx.moveTo(0, -R * 1.4); ctx.lineTo(0, R * 1.4); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.stroke()
    ctx.restore()
  }
  return g
}

/* Meteor Drift: drag to steer */
function meteorDrift(api) {
  let s; const g = { hint: 'Drag to steer · dodge the rocks' }
  const stars = [...Array(70)].map(() => ({ x: Math.random(), y: Math.random(), z: rand(0.3, 1) }))
  const sy = () => api.H - 130
  g.reset = () => { s = { x: api.W / 2, tx: api.W / 2, rocks: [], spawn: 0.5, t: 0, sc: 0 } }
  g.start = g.down = g.move = (x) => { s.tx = x }
  g.step = (dt) => {
    const { W, H } = api; s.t += dt; const lvl = 1 + s.t / 12
    s.spawn -= dt
    if (s.spawn <= 0) {
      s.spawn = Math.max(0.24, 0.62 / lvl); const r = rand(12, 26)
      s.rocks.push({ x: rand(r, W - r), y: -r, r, vy: rand(170, 260) * Math.min(lvl, 2.4), rot: rand(0, 6), vr: rand(-2, 2) })
    }
    s.x += (clamp(s.tx, 18, W - 18) - s.x) * Math.min(1, dt * 12)
    const y = sy()
    for (const m of s.rocks) { m.y += m.vy * dt; m.rot += m.vr * dt; if (Math.hypot(m.x - s.x, m.y - y) < m.r + 11) api.over() }
    s.rocks = s.rocks.filter((m) => m.y < H + 40)
    const sc = Math.floor(s.t * 2); if (sc !== s.sc) { s.sc = sc; api.score(sc) }
  }
  g.ai = () => {
    const W = api.W, y = sy(); let best = s.tx, bc = 1e9
    for (let i = 0; i <= 16; i++) {
      const cx = 18 + (W - 36) * i / 16; let c = Math.abs(cx - s.x) * 0.002
      for (const m of s.rocks) {
        const dy = y - m.y; if (dy < -20 || dy > 330) continue
        const t = dy / m.vy, d = Math.abs(m.x - cx)
        if (d < m.r + 34) c += (1.6 - Math.min(1.5, t)) * (1 - d / (m.r + 34)) * 3
        if ((m.x - s.x) * (m.x - cx) < 0 && dy < 140) c += 0.8
      }
      if (c < bc) { bc = c; best = cx }
    }
    s.tx = best
  }
  g.draw = (ctx) => {
    const { W, H } = api
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#090a1f'); bg.addColorStop(1, '#231446')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    for (const st of stars) { const yy = ((st.y * H) + s.t * 60 * st.z) % H; ctx.fillStyle = `rgba(255,255,255,${0.25 + st.z * 0.5})`; ctx.fillRect(st.x * W, yy, st.z * 2, st.z * 2) }
    for (const m of s.rocks) {
      ctx.fillStyle = 'rgba(255,140,80,.18)'; ctx.beginPath(); ctx.moveTo(m.x - m.r * 0.7, m.y); ctx.lineTo(m.x, m.y - m.r * 3.2); ctx.lineTo(m.x + m.r * 0.7, m.y); ctx.fill()
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot); ctx.fillStyle = '#9a7259'; circle(ctx, 0, 0, m.r); ctx.fill()
      ctx.fillStyle = '#6e4f3d'; circle(ctx, m.r * 0.35, -m.r * 0.2, m.r * 0.28); ctx.fill(); circle(ctx, -m.r * 0.3, m.r * 0.35, m.r * 0.2); ctx.fill(); ctx.restore()
    }
    const y = sy()
    ctx.fillStyle = Math.random() > 0.5 ? '#ff4d6d' : '#ffc94a'
    ctx.beginPath(); ctx.moveTo(s.x - 6, y + 12); ctx.lineTo(s.x, y + 22 + Math.random() * 8); ctx.lineTo(s.x + 6, y + 12); ctx.fill()
    ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.moveTo(s.x, y - 16); ctx.lineTo(s.x + 13, y + 13); ctx.lineTo(s.x, y + 7); ctx.lineTo(s.x - 13, y + 13); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#24275f'; circle(ctx, s.x, y, 3.5); ctx.fill()
  }
  return g
}

/* Pop Rush: tap bubbles */
function popRush(api) {
  let s; const g = { hint: 'Pop bubbles before they vanish' }
  const hues = ['#ff4d6d', '#ffc94a', '#6be3c4', '#8fa8ff', '#ff9f6e']
  g.reset = () => { s = { b: [], spawn: 0.3, t: 0, sc: 0, lives: 3, fx: [], taps: [], aiT: 0.4 } }
  function burst(b) { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; s.fx.push({ x: b.x, y: b.y, vx: Math.cos(a) * rand(90, 200), vy: Math.sin(a) * rand(90, 200), a: 1, c: b.c }) } }
  g.down = (x, y) => {
    s.taps.push({ x, y, a: 0 })
    let hit = null
    for (const b of s.b) { if (b.dead) continue; const r = b.r0 * (1 - b.age / b.life); if (Math.hypot(b.x - x, b.y - y) < r + 14) { hit = b; break } }
    if (hit) { hit.dead = true; s.sc++; api.score(s.sc); burst(hit) }
  }
  g.fx = (dt) => {
    for (const p of s.fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 1.8 }
    s.fx = s.fx.filter((p) => p.a > 0)
    for (const t of s.taps) t.a += dt * 2.5
    s.taps = s.taps.filter((t) => t.a < 1)
  }
  g.step = (dt) => {
    const { W, H } = api; s.t += dt; s.spawn -= dt
    if (s.spawn <= 0) {
      s.spawn = Math.max(0.36, 0.9 - s.sc * 0.015)
      for (let k = 0; k < 8; k++) {
        const r0 = rand(28, 42), x = rand(40, W - 40), y = rand(H * 0.24, H * 0.7)
        if (s.b.every((b) => Math.hypot(b.x - x, b.y - y) > b.r0 + r0 + 6)) { s.b.push({ x, y, r0, age: 0, life: Math.max(1.15, 2.2 - s.sc * 0.03), c: hues[(Math.random() * hues.length) | 0] }); break }
      }
    }
    for (const b of s.b) { b.age += dt; if (b.age >= b.life && !b.dead) { b.dead = true; s.lives--; s.taps.push({ x: b.x, y: b.y, a: 0, miss: true }); if (s.lives <= 0) api.over() } }
    s.b = s.b.filter((b) => !b.dead); g.fx(dt)
  }
  g.ai = (dt) => {
    s.aiT -= dt; if (s.aiT > 0) return; s.aiT = rand(0.22, 0.42)
    const live = s.b.filter((b) => !b.dead).sort((a, b) => (b.age / b.life) - (a.age / a.life))
    if (live.length && Math.random() > 0.04) g.down(live[0].x + rand(-6, 6), live[0].y + rand(-6, 6))
  }
  g.draw = (ctx) => {
    const { W, H } = api
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, H * 0.8); bg.addColorStop(0, '#3a1a4f'); bg.addColorStop(1, '#140a1e')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    for (const b of s.b) {
      const k = 1 - b.age / b.life, r = b.r0 * k
      ctx.globalAlpha = 0.25; ctx.fillStyle = b.c; circle(ctx, b.x, b.y, b.r0); ctx.fill(); ctx.globalAlpha = 1
      ctx.fillStyle = b.c; circle(ctx, b.x, b.y, r); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(ctx, b.x - r * 0.35, b.y - r * 0.35, r * 0.22); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r0 + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke()
    }
    for (const p of s.fx) { ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c; circle(ctx, p.x, p.y, 4); ctx.fill() }
    ctx.globalAlpha = 1
    for (const t of s.taps) { ctx.strokeStyle = t.miss ? `rgba(255,77,109,${1 - t.a})` : `rgba(255,255,255,${1 - t.a})`; ctx.lineWidth = 2; circle(ctx, t.x, t.y, 10 + t.a * 30); ctx.stroke() }
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < s.lives ? '#ff4d6d' : 'rgba(255,255,255,.2)'; circle(ctx, W / 2 - 18 + i * 18, H * 0.2 + 20, 5); ctx.fill() }
  }
  return g
}

/* Brick Bounce: drag the paddle */
function brickBounce(api) {
  let s; const g = { hint: 'Drag to move the paddle' }; const BR = 7
  const py = () => api.H - 120
  function bricks() {
    const { W, H } = api, cols = 6, rows = 5, pad = 14, gap = 6, bw = (W - pad * 2 - gap * (cols - 1)) / cols, bh = 18, a = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) a.push({ x: pad + c * (bw + gap), y: H * 0.24 + r * (bh + gap), w: bw, h: bh, row: r })
    return a
  }
  g.reset = () => { const { W, H } = api; s = { px: W / 2, tx: W / 2, pw: Math.max(72, W * 0.26), b: { x: W / 2, y: H * 0.62, vx: 140, vy: -300 }, bricks: bricks(), sc: 0, spd: 340, aiOff: 0 } }
  g.start = g.down = g.move = (x) => { s.tx = x }
  g.step = (dt) => {
    const { W, H } = api, b = s.b
    s.px += (clamp(s.tx, s.pw / 2, W - s.pw / 2) - s.px) * Math.min(1, dt * 14)
    const oy = b.y; b.x += b.vx * dt; b.y += b.vy * dt
    if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) }
    if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx) }
    if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy) }
    const p = py()
    if (b.vy > 0 && b.y + BR >= p && oy + BR <= p + 4 && Math.abs(b.x - s.px) < s.pw / 2 + BR) {
      const off = clamp((b.x - s.px) / (s.pw / 2), -1, 1), ang = off * 1.05
      b.vx = Math.sin(ang) * s.spd; b.vy = -Math.cos(ang) * s.spd; b.y = p - BR
      s.aiOff = rand(-0.7, 0.7) * s.pw / 2 * 0.75
    }
    for (const k of s.bricks) {
      if (k.dead) continue
      if (b.x + BR > k.x && b.x - BR < k.x + k.w && b.y + BR > k.y && b.y - BR < k.y + k.h) {
        if (oy + BR <= k.y || oy - BR >= k.y + k.h) b.vy = -b.vy; else b.vx = -b.vx
        k.dead = true; s.sc++; api.score(s.sc); s.spd = Math.min(560, s.spd * 1.01); break
      }
    }
    if (s.bricks.every((k) => k.dead)) { s.bricks = bricks(); s.spd += 20 }
    if (b.y > H + 20) api.over()
  }
  g.ai = () => { s.tx = s.b.x - s.aiOff }
  g.draw = (ctx) => {
    const { W, H } = api
    ctx.fillStyle = '#0d1626'; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(143,168,255,.08)'; ctx.lineWidth = 1
    for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    const cols = ['#ff4d6d', '#ff9f6e', '#ffc94a', '#6be3c4', '#8fa8ff']
    for (const k of s.bricks) { if (k.dead) continue; ctx.fillStyle = cols[k.row]; rr(ctx, k.x, k.y, k.w, k.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(k.x + 4, k.y + 3, k.w - 8, 3) }
    ctx.fillStyle = '#f4f0fc'; rr(ctx, s.px - s.pw / 2, py(), s.pw, 12, 6); ctx.fill()
    ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffc94a'; circle(ctx, s.b.x, s.b.y, BR); ctx.fill(); ctx.shadowBlur = 0
  }
  return g
}

/* Stack Up: tap to drop */
function stackUp(api) {
  let s; const g = { hint: 'Tap to drop the block · line it up' }; const BH = 30
  function next() {
    const top = s.stack[s.stack.length - 1], W = api.W, left = s.stack.length % 2 === 0
    s.cur = { x: left ? top.w / 2 - W * 0.12 : W - top.w / 2 + W * 0.12, w: top.w, dir: left ? 1 : -1 }
    s.aiErr = Math.random() < 0.06 ? rand(-40, 40) : rand(-5, 5)
  }
  g.reset = () => { const W = api.W; s = { stack: [{ x: W / 2, w: W * 0.55 }], speed: W * 0.6, sc: 0, cam: 0, fall: [], flash: 0 }; next() }
  g.down = () => {
    const top = s.stack[s.stack.length - 1], c = s.cur, lvl = s.stack.length
    if (!c) return
    let dx = c.x - top.x
    if (Math.abs(dx) < 4) { dx = 0; s.flash = 1 }
    const ov = c.w - Math.abs(dx)
    if (ov <= 0) { s.fall.push({ x: c.x, w: c.w, lvl, vy: 0, dy: 0 }); s.cur = null; api.over(); return }
    const nx = top.x + dx / 2; s.stack.push({ x: nx, w: ov })
    if (dx) s.fall.push({ x: dx > 0 ? nx + ov / 2 + Math.abs(dx) / 2 : nx - ov / 2 - Math.abs(dx) / 2, w: Math.abs(dx), lvl, vy: 0, dy: 0 })
    s.sc++; api.score(s.sc); s.speed += 6; next()
  }
  g.fx = (dt) => {
    for (const f of s.fall) { f.vy += 1400 * dt; f.dy += f.vy * dt }
    s.fall = s.fall.filter((f) => f.dy < api.H * 1.5)
    s.flash = Math.max(0, s.flash - dt * 2)
    const tgt = Math.max(0, s.stack.length - 7) * BH; s.cam += (tgt - s.cam) * Math.min(1, dt * 5)
  }
  g.step = (dt) => {
    const W = api.W, c = s.cur
    if (c) {
      c.x += c.dir * s.speed * dt
      const lo = c.w / 2 - W * 0.14, hi = W - c.w / 2 + W * 0.14
      if (c.x < lo) { c.x = lo; c.dir = 1 }
      if (c.x > hi) { c.x = hi; c.dir = -1 }
    }
    g.fx(dt)
  }
  g.ai = (dt) => { const top = s.stack[s.stack.length - 1]; if (s.cur && Math.abs(s.cur.x - (top.x + s.aiErr)) < s.speed * dt * 0.6 + 1) g.down() }
  g.draw = (ctx) => {
    const { W, H } = api, h = s.stack.length
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, `hsl(${250 + h * 4},45%,16%)`); bg.addColorStop(1, `hsl(${200 + h * 4},45%,26%)`)
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    const base = H * 0.8, col = (i) => `hsl(${(190 + i * 11) % 360},72%,62%)`
    const block = (x, w, lvl, dy = 0) => {
      const y = base - lvl * BH + s.cam + dy
      ctx.fillStyle = col(lvl); rr(ctx, x - w / 2, y, w, BH - 3, 4); ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - w / 2, y + BH - 9, w, 6)
    }
    s.stack.forEach((b, i) => block(b.x, b.w, i))
    for (const f of s.fall) { ctx.globalAlpha = 0.85; block(f.x, f.w, f.lvl, f.dy); ctx.globalAlpha = 1 }
    if (s.cur) block(s.cur.x, s.cur.w, h)
    if (s.flash > 0) { const t = s.stack[h - 1]; ctx.strokeStyle = `rgba(255,255,255,${s.flash})`; ctx.lineWidth = 3; rr(ctx, t.x - t.w / 2 - 4, base - (h - 1) * BH + s.cam - 4, t.w + 8, BH + 5, 6); ctx.stroke() }
  }
  return g
}

export const BUILTIN_GAMES = {
  kite: kiteHop,
  meteor: meteorDrift,
  pop: popRush,
  brick: brickBounce,
  stack: stackUp,
}
