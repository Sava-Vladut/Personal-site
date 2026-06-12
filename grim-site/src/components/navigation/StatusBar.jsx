import { useEffect, useState } from 'react'
import { ui } from '../../data/ui.js'

const formatTime = (date) =>
  [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

export function StatusBar({ activeView, inverted }) {
  const [time, setTime] = useState(() => formatTime(new Date()))

  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime(new Date())), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <footer className="status-bar" aria-label="Session status">
      <span className="status-cell">{ui.statusBarName}</span>
      <span className="status-cell status-path">~/{activeView}</span>
      <span className="status-cell status-hint">
        {ui.statusBarKeys} {inverted ? 'inverse' : 'normal'}
      </span>
      <span className="status-cell status-clock">
        {time} <span className="cursor" aria-hidden="true">█</span>
      </span>
    </footer>
  )
}
