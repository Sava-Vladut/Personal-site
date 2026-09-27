/**
 * What changed, newest first. The app's version is the first entry's.
 * Every change adds a new entry on top — see AGENTS.md.
 */
export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.6.0',
    date: '2026-09-27',
    changes: [
      'People: a new “What’s on your mind” page, a wheel showing how much of your thoughts each person takes up',
      'People: switch it between the last 30 days, 12 months and all time, and tap a slice to see who it is',
      'People: a “Share of mind” list ranks everyone, coloured by the feeling they bring',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-09-27',
    changes: ['Books: person labels now say “Thinking of”, including linked books on person pages'],
  },
  {
    version: '1.5.1',
    date: '2026-09-27',
    changes: ['People: notes, check-ins and person pages now use “Thinking of” consistently'],
  },
  {
    version: '1.5.0',
    date: '2026-09-27',
    changes: [
      'Books: a new tab for your shelf, with books found through Open Library or added by hand',
      'Books: rate them, and move them between Reading, Want to read, Read and Didn’t finish',
      'Books: start and finish dates fill themselves in, and you can track your page while reading',
      'Books: mention a book in a note with the books button (or type [[Title]]); it links to the book',
      'Books: each book shows the notes that mention it, and how those notes felt',
      'Books: note how a book made you feel and who recommended it; it shows on their page too',
      'Books you’re reading appear on the journal’s front page, a tap away from writing about them',
      'Add a book from the + button',
      'Books are included in backups and sync',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-09-27',
    changes: ['Settings moved from the tab bar to the top of the journal, next to search, calendar and stats'],
  },
  {
    version: '1.4.1',
    date: '2026-09-27',
    changes: ['The feelings on the main screen are animated, each in its own way'],
  },
  {
    version: '1.4.0',
    date: '2026-09-27',
    changes: [
      'Spotify: a new Listening tab adds the song you’re playing now, or one you played recently',
      'Spotify: your playlists show as a grid of covers again',
      'Spotify: paste a song link straight into Search (the separate Paste a link tab is gone)',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-27',
    changes: ['The + button opens a menu to add a note, a check-in or a person'],
  },
  {
    version: '1.2.1',
    date: '2026-09-27',
    changes: [
      'People saved in different tabs no longer overwrite each other',
      'Pending photo imports no longer restore deleted notes or overwrite later edits',
      'Long notes keep all their text after reopening',
      'Missing synced photos retry automatically and appear when downloaded',
      'Backup imports restore missing photos in existing notes',
      'Searching an exact name selects the correct person',
      'Large Spotify playlists load every page without repeating songs',
      'Emotion transitions respect backdated entries',
      'Mood chart tooltips select the day under your pointer',
      'Malformed requests no longer interrupt the server',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-09-27',
    changes: ['Settings shows the app’s version; tap it to see what’s new'],
  },
  {
    version: '1.1.0',
    date: '2026-09-27',
    changes: [
      'Removed the “My Mind” label from the journal’s top corner for more room',
      'Drag pictures onto each other in a note to make an album',
      'Text wraps around photos in notes; pinch, drag anywhere and a full-screen viewer',
      'The journal’s top panel has a sky of drifting clouds, tinted by today’s feeling',
      'Redesigned the check-in prompt and its confirm card',
      'Hold a note or check-in to bring up its options',
      'Notes got a header section, covers and Obsidian-style formatting, plus a Feelings page',
      'Photo controls in notes: resize, align, move, remove with undo',
      'People: write about people and tag them in notes and check-ins',
      'Encrypted sync across devices with a code',
      'Smooth, mobile-friendly animations throughout',
      'Stats moved from the tab bar to an icon in the journal header',
      'Removed the journal’s filter chips',
      'The calendar keeps the same height across months',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-26',
    changes: [
      'First release of My Mind: a journal of notes and emotion check-ins',
      'Emotion wheel picker, with a Grid/Wheel setting',
      'Photos and Openverse images placed inline in notes',
      'Works offline and installs to the home screen',
    ],
  },
];

export const VERSION = CHANGELOG[0].version;
