import { useEffect, useRef } from 'react'

const DIGITS = '0123456789'
const FONT_STACK = '"Courier New", "Lucida Console", monospace'

const randomDigit = () => DIGITS[Math.floor(Math.random() * DIGITS.length)]

export function RadiatingNumbers() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let dpr = 1
    let particles = []
    let raf = 0

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      if (!width || !height) return

      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      const count = Math.min(112, Math.max(48, Math.round((width * height) / 6000)))
      const innerRadius = Math.min(width, height) * 0.16
      const travel = Math.hypot(width, height) * 0.55 - innerRadius

      particles = Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        digit: randomDigit(),
        fontSize: 8 + Math.random() * 5,
        innerRadius,
        offset: Math.random() * travel,
        opacity: 0.38 + Math.random() * 0.28,
        speed: 9 + Math.random() * 14,
        travel,
      }))
    }

    const draw = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowBlur = 2
      ctx.shadowColor = 'rgba(255, 104, 24, 0.5)'

      for (const particle of particles) {
        const distance = reduceMotion
          ? particle.offset
          : (particle.offset + now * 0.001 * particle.speed) % particle.travel
        const progress = distance / particle.travel
        const radius = particle.innerRadius + distance
        const x = width * 0.5 + Math.cos(particle.angle) * radius
        const y = height * 0.5 + Math.sin(particle.angle) * radius
        const fade = Math.sin(Math.PI * progress) ** 1.35

        ctx.font = `${particle.fontSize}px ${FONT_STACK}`
        ctx.fillStyle = `rgba(255, 104, 24, ${particle.opacity * fade})`
        ctx.fillText(particle.digit, x, y)
      }
    }

    const tick = (now) => {
      draw(now)
      raf = requestAnimationFrame(tick)
    }

    const resizeObserver = new ResizeObserver(() => {
      build()
      if (reduceMotion) draw(0)
    })

    resizeObserver.observe(canvas)
    build()
    if (reduceMotion) {
      draw(0)
    } else {
      raf = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="radiating-numbers" aria-hidden="true" />
}
