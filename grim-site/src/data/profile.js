import profileText from '../content/profile.txt?raw'
import { parseKeyValues } from '../utils/textContent.js'

const splitParts = (value) => value.split('|').map((part) => part.trim())

const raw = parseKeyValues(profileText)

export const profile = {
  ...raw,
  subtitle: splitParts(raw.subtitle),
  location: splitParts(raw.location),
}
