import { useEffect, useRef } from 'react'

export function AsciiSpinner({ render, label, note, ariaLabel }) {
  const preRef = useRef(null)

  useEffect(() => {
    const pre = preRef.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pre.textContent = render(0.9, 0)
      return undefined
    }

    let raf
    const tick = (now) => {
      pre.textContent = render(now * 0.0009, now)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [render])

  return (
    <figure className="ascii-spinner" role="img" aria-label={ariaLabel}>
      <pre ref={preRef} aria-hidden="true" />
      <figcaption>
        <span className="spinner-label">/ {label}</span>
        {note ? <span className="spinner-note">{note}</span> : null}
      </figcaption>
    </figure>
  )
}
