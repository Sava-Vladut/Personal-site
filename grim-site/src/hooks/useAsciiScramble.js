import { useEffect, useRef, useState } from 'react'

const GLYPHS = '/\\<>|+=*#%@&$:'
const RADIUS = 3
const DECAY = 0.92
const CUTOFF = 0.12
const REROLL_CHANCE = 0.4

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

export function useAsciiScramble(source) {
  const preRef = useRef(null)
  const [display, setDisplay] = useState(source)

  useEffect(() => {
    const pre = preRef.current
    if (!pre || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const lines = source.split('\n')
    const maxCols = Math.max(...lines.map((line) => line.length))
    const cells = new Map()
    let raf = 0
    let running = false

    const tick = () => {
      for (const [key, cell] of cells) {
        cell.intensity *= DECAY
        if (cell.intensity < CUTOFF) {
          cells.delete(key)
        } else if (Math.random() < REROLL_CHANCE) {
          cell.glyph = randomGlyph()
        }
      }

      if (cells.size === 0) {
        running = false
        setDisplay(source)
        return
      }

      const out = lines.slice()
      const rowChars = new Map()
      for (const [key, cell] of cells) {
        const row = key >> 12
        const col = key & 4095
        let chars = rowChars.get(row)
        if (!chars) {
          chars = out[row].split('')
          rowChars.set(row, chars)
        }
        chars[col] = cell.glyph
      }
      for (const [row, chars] of rowChars) {
        out[row] = chars.join('')
      }
      setDisplay(out.join('\n'))
      raf = requestAnimationFrame(tick)
    }

    const onPointerMove = (event) => {
      const rect = pre.getBoundingClientRect()
      const style = getComputedStyle(pre)
      const innerHeight =
        rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const row = Math.floor(
        (event.clientY - rect.top - parseFloat(style.paddingTop)) / (innerHeight / lines.length),
      )
      const col = Math.floor((event.clientX - rect.left) / (rect.width / maxCols))

      for (let r = row - RADIUS; r <= row + RADIUS; r += 1) {
        if (r < 0 || r >= lines.length) continue
        const line = lines[r]
        for (let c = col - RADIUS; c <= col + RADIUS; c += 1) {
          if (c < 0 || c >= line.length || line[c] === ' ') continue
          const d2 = (r - row) ** 2 + (c - col) ** 2
          if (d2 > RADIUS * RADIUS) continue
          const strength = 1 - d2 / (RADIUS * RADIUS + 1)
          const key = (r << 12) | c
          const cell = cells.get(key)
          if (!cell) {
            cells.set(key, { intensity: strength, glyph: randomGlyph() })
          } else if (strength > cell.intensity) {
            cell.intensity = strength
          }
        }
      }

      if (!running && cells.size > 0) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    pre.addEventListener('pointermove', onPointerMove)
    return () => {
      pre.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(raf)
    }
  }, [source])

  return { text: display, preRef }
}
