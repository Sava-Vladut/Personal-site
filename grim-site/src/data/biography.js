import biographyText from '../content/biography.txt?raw'
import { parseLines } from '../utils/textContent.js'

export const biographyColumns = parseLines(biographyText).map((line) =>
  line
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean),
)
