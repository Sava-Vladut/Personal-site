// Each emotion world's letters, for the skies (Sky.tsx) and the little weather clouds (AsciiCloud.tsx).

/** Letters from empty to dense. A level with several characters picks one per cell, for texture. */
export const RAMPS: Record<string, string[]> = {
  default: [' ', '.', ':', '+', '*', 'o', 'O', '#'],
  joy: [' ', '·', '.', '+', '*', 'o', 'O', '@'],
  'hope-interest': [' ', '.', ':', '^', '*', '+', 'x', 'X'],
  'love-connection': [' ', '.', ':', 'o', 'O', '0', '8', '@'],
  'calm-safety': [' ', '.', '-', '~', '=', '≈', '≡'],
  sadness: [' ', '.', ',', "'", ':', ';', '!', '|'],
  fear: [' ', '.', "'", '/\\', 'x', 'X', '%'],
  anger: [' ', '.', ':', '+', '%', '#', '@', 'M'],
  'shame-aversion': [' ', '.', ':', '-', '()', '[]', '{}'],
  // the media page: a sky of pages, and one of notes
  books: [' ', '.', ',', ';', 'ilt', 'aeo', 'bdhk', '¶§'],
  music: [' ', '.', '·', '-', '♩', '♪', '♫', '♬'],
  // repos: a sky of code
  repos: [' ', '.', ':', ';', '=', '/', '{}', '<>'],
  // channel points: a sky of coins
  twitch: [' ', '.', '·', ':', 'o', '¢', '$', '¤'],
};
