export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
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
