// Parsers for the plain-text content files in src/content.
// Lines starting with # are comments and are ignored everywhere.

const contentLines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

export function parseLines(text) {
  return contentLines(text)
}

export function parseKeyValues(text) {
  const entries = {}

  for (const line of contentLines(text)) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    entries[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }

  return entries
}

export function parseBlocks(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
    .split(/\n\s*\n/)
    .map((block) => parseKeyValues(block))
    .filter((block) => Object.keys(block).length > 0)
}
