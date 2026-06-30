export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export function formatPoints(value) {
  const n = Number(value) || 0
  return n.toLocaleString('en-US')
}

// Compact "time since" for a unix-ms timestamp: "now", "4m", "3h", "6d", "2w".
export function timeAgo(ms) {
  if (!ms) return '—'
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 45) return 'now'
  const steps = [
    [60, 'm'],
    [3600, 'h'],
    [86400, 'd'],
    [604800, 'w'],
  ]
  let unit = 's'
  let value = seconds
  for (let i = 0; i < steps.length; i += 1) {
    const [divisor, label] = steps[i]
    if (seconds < (steps[i + 1]?.[0] ?? Infinity)) {
      value = Math.round(seconds / divisor)
      unit = label
      break
    }
  }
  return `${value}${unit}`
}

export function filenameFromDisposition(header, fallback) {
  const value = header || ''
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(value)
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, '').trim())
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(value)
  return plain ? plain[1].trim() : fallback
}
