import { useEffect, useState } from 'react'

const GLYPHS = '/\\<>|+=*#%@&$:'

export function useDecodedText(text, duration = 600) {
  const [scrambled, setScrambled] = useState(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    let frame
    const start = performance.now()

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      const settled = Math.floor(text.length * progress)
      const noise = Array.from(text.slice(settled), (char) =>
        char === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      ).join('')
      setScrambled(progress < 1 ? text.slice(0, settled) + noise : null)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, duration])

  return scrambled ?? text
}
