const GLYPHS = {
  A: [' ### ', '#   #', '#####', '#   #', '#   #'],
  D: ['#### ', '#   #', '#   #', '#   #', '#### '],
  L: ['#    ', '#    ', '#    ', '#    ', '#####'],
  S: ['#####', '#    ', '#####', '    #', '#####'],
  V: ['#   #', '#   #', '#   #', ' # # ', '  #  '],
  ' ': ['   ', '   ', '   ', '   ', '   '],
}

export function renderAsciiName(name) {
  const letters = name.toUpperCase().split('').map((letter) => GLYPHS[letter] ?? GLYPHS[' '])

  return GLYPHS.A.map((_, row) => (
    letters.map((letter) => letter[row]).join(' ')
  )).join('\n')
}
