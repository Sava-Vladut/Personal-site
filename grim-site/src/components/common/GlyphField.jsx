import { useEffect, useRef } from 'react'

const CELL = 14
const FONT = '12px "Courier New", "Lucida Console", monospace'
const GLYPHS = '·:.+*/\\<>'
const REST_ALPHA = 0.09
const ACTIVE_ALPHA = 0.34
const CURSOR_RADIUS = 130
const DECAY = 0.92
const SCRAMBLE_CHANCE = 0.18
const RIPPLE_SPEED = 1.1
const RIPPLE_WIDTH = 90
const EPSILON = 0.015

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

const parseColor = (value) => {
  const color = value.trim()
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex
    const n = parseInt(full, 16)
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  const channels = color.match(/rgba?\(([^)]+)\)/i)?.[1]
  if (channels) {
    const rgb = channels
      .split(',')
      .slice(0, 3)
      .map((channel) => Number.parseFloat(channel))
    if (rgb.every(Number.isFinite)) return rgb
  }

  return [245, 245, 245]
}

export function GlyphField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rest = document.createElement('canvas')
    const rctx = rest.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = 1
    let cols = 0
    let rows = 0
    let cells = new Float32Array(0)
    let glyphs = []
    let rgb = [245, 245, 245]
    let ripples = []
    let raf = 0
    let running = false
    let lastTime = 0

    const paintRestCell = (i) => {
      const x = (i % cols) * CELL
      const y = ((i / cols) | 0) * CELL
      rctx.clearRect(x, y, CELL, CELL)
      rctx.fillText(glyphs[i], x + CELL / 2, y + CELL / 2)
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(rest, 0, 0, width, height)
      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let active = false
      for (let i = 0; i < cells.length; i += 1) {
        const intensity = cells[i]
        if (intensity <= EPSILON) continue
        active = true
        const x = (i % cols) * CELL
        const y = ((i / cols) | 0) * CELL
        const alpha = REST_ALPHA + intensity * (ACTIVE_ALPHA - REST_ALPHA)
        ctx.clearRect(x, y, CELL, CELL)
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
        ctx.fillText(glyphs[i], x + CELL / 2, y + CELL / 2)
      }
      return active
    }

    const build = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      cols = Math.ceil(width / CELL)
      rows = Math.ceil(height / CELL)
      cells = new Float32Array(cols * rows)
      glyphs = Array.from({ length: cols * rows }, randomGlyph)
      rgb = parseColor(getComputedStyle(canvas).getPropertyValue('--fg') || '#f5f5f5')

      rest.width = canvas.width
      rest.height = canvas.height
      rctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      rctx.font = FONT
      rctx.textAlign = 'center'
      rctx.textBaseline = 'middle'
      rctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${REST_ALPHA})`
      for (let i = 0; i < glyphs.length; i += 1) {
        rctx.fillText(glyphs[i], (i % cols) * CELL + CELL / 2, ((i / cols) | 0) * CELL + CELL / 2)
      }
      draw()
    }

    const step = (now, dt) => {
      const maxDist = Math.hypot(width, height)
      ripples = ripples.filter((ripple) => {
        const edge = (now - ripple.start) * RIPPLE_SPEED
        if (edge - RIPPLE_WIDTH > maxDist) return false
        for (let i = 0; i < cells.length; i += 1) {
          const dx = (i % cols) * CELL + CELL / 2 - ripple.x
          const dy = ((i / cols) | 0) * CELL + CELL / 2 - ripple.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const t = (edge - dist) / RIPPLE_WIDTH
          if (t < 0 || t > 1) continue
          const strength = (1 - t) * (1 - dist / maxDist) * 0.85
          if (strength > cells[i]) cells[i] = strength
        }
        return true
      })

      const decay = DECAY ** (dt / 16.7)
      for (let i = 0; i < cells.length; i += 1) {
        const intensity = cells[i] * decay
        cells[i] = intensity <= EPSILON ? 0 : intensity
        if (intensity > 0.5 && Math.random() < SCRAMBLE_CHANCE) {
          glyphs[i] = randomGlyph()
          paintRestCell(i)
        }
      }
    }

    const tick = (now) => {
      const dt = Math.min(64, now - lastTime)
      lastTime = now
      step(now, dt)
      if (draw() || ripples.length > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
      }
    }

    const wake = () => {
      if (running) return
      running = true
      lastTime = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const stamp = (px, py) => {
      const r2 = CURSOR_RADIUS * CURSOR_RADIUS
      const minCol = Math.max(0, Math.floor((px - CURSOR_RADIUS) / CELL))
      const maxCol = Math.min(cols - 1, Math.ceil((px + CURSOR_RADIUS) / CELL))
      const minRow = Math.max(0, Math.floor((py - CURSOR_RADIUS) / CELL))
      const maxRow = Math.min(rows - 1, Math.ceil((py + CURSOR_RADIUS) / CELL))
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const dx = col * CELL + CELL / 2 - px
          const dy = row * CELL + CELL / 2 - py
          const d2 = dx * dx + dy * dy
          if (d2 >= r2) continue
          const strength = 1 - d2 / r2
          const i = row * cols + col
          if (strength > cells[i]) cells[i] = strength
        }
      }
      wake()
    }

    const onPointerMove = (event) => stamp(event.clientX, event.clientY)
    const onPointerDown = (event) => {
      ripples.push({ x: event.clientX, y: event.clientY, start: performance.now() })
      wake()
    }
    const onResize = () => build()

    build()
    window.addEventListener('resize', onResize)
    if (!reduceMotion) {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerdown', onPointerDown)
      stamp(width * 0.5, height * 0.5)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return <canvas ref={canvasRef} className="glyph-field" aria-hidden="true" />
}
