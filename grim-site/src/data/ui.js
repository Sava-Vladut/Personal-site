import uiText from '../content/ui.txt?raw'
import { parseKeyValues } from '../utils/textContent.js'

export const ui = parseKeyValues(uiText)
