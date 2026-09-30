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
    version: '1.16.3',
    date: '2026-09-30',
    changes: [
      'A person\u2019s page: \u201cHow thinking of them felt\u201d goes back to counting feelings, without weighting by intensity',
    ],
  },
  {
    version: '1.16.2',
    date: '2026-09-30',
    changes: [
      'What\u2019s on your mind: a person\u2019s share now counts how strongly you felt in each moment, so a 5/5 feeling weighs more than a 1/5',
    ],
  },
  {
    version: '1.16.1',
    date: '2026-09-30',
    changes: [
      'On a person\u2019s page, \u201cHow thinking of them felt\u201d now weighs each feeling by its intensity, so strong feelings count for more',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-09-30',
    changes: [
      'Back-to-back check-ins fold into one line (\u201c3 check-ins\u201d); tap it to unfold them',
      'Check-ins are lighter and smaller than notes, which keep their full cards',
      'More space between days than between entries, so each day reads as a group',
      'Day headings stay pinned at the top while you scroll through that day',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-09-29',
    changes: [
      'Journal cards show a note\u2019s first picture large when it has no cover',
      'A note without a title now uses its first line as the heading, and previews are cut at whole lines or words instead of mid-word',
      'New Journal layout in Settings: Cards or Compact, a one-line-per-entry list that fits many days on screen',
      'Swipe a journal entry right to pin a note to the top, or left to delete it (with Undo); Pin and Unpin are also in the long-press menu',
    ],
  },
  {
    version: '1.14.1',
    date: '2026-09-29',
    changes: [
      'Removed the ASCII brain from Settings',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-09-29',
    changes: [
      'New in Settings: an ASCII brain, a detailed 3D brain drawn entirely in letters, with folds, lobes, cerebellum and brainstem',
      'Scroll to fly from lobe to lobe with a note on what each one does; the lobe you are on lights up in its own colour',
      'Drag to turn the brain, tap it to send a pulse rippling across the cortex',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-09-29',
    changes: [
      'Hold any emotion on the wheel to open a tooltip with its name, level, definition, the zones or feelings it holds and how often you have felt it',
      'Keep holding and slide across the wheel to read the next emotion; the rest of the wheel dims while you look',
      'The check-in page now sits under the same drifting cloud sky as the journal and mind page, tinted by the world you are exploring',
      'The wheel gets a frosted disc and a soft glow so it stands out clearly against the clouds',
    ],
  },
  {
    version: '1.12.1',
    date: '2026-09-29',
    changes: [
      'The + menu tiles are now straight and neutral: no slant and no colour tints',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-09-29',
    changes: [
      'The + button no longer opens a full panel: a small ribbon of slanted glass tiles unfolds from the corner instead',
      'Note, Check-in, Person and Book each get a coloured tile that fans out one after another from the button',
      'The + turns into a × as it opens; tap outside, press Escape or use Back to close',
    ],
  },
  {
    version: '1.11.1',
    date: '2026-09-29',
    changes: [
      'Faster app delivery with assets compressed ahead of time',
      'Smoother server sync with streamed transfers and safer handling of simultaneous saves',
      'More reliable Spotify connections and server restarts',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-09-29',
    changes: [
      'What’s on your mind: the coloured ring is alive — each slice slowly swells and settles, out of step with the others',
      'What’s on your mind: the person you’re looking at has a soft heartbeat',
      'What’s on your mind: a gentle light drifts around the ring, brightening each colour as it passes',
      'What’s on your mind: the motion pauses while the wheel is scrolled out of view, and it stays light on battery',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-09-29',
    changes: [
      'What’s on your mind: the page now has the journal’s drifting-letter sky, coloured by the feelings of the people you think about most',
      'What’s on your mind: the wheel glows and slowly breathes in the colour of whoever you’re looking at',
      'What’s on your mind: the ring catches the sunlight, and each person’s face glows in their own colour',
      'What’s on your mind: the percentage in the middle counts up as you switch between people',
      'What’s on your mind: the summary says how you hold the person closest to your mind, and their card shows the last thing you wrote about them',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-09-29',
    changes: [
      'Journal sky: much smoother on phones — about ten times less work per frame, so scrolling and touch stay fluid and the battery lasts longer',
      'Journal sky: redraws less often when nothing is touching it, and eases off by itself if a device struggles to keep up',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-09-29',
    changes: [
      'Journal sky: two layers of clouds — small, faint ones far away and larger, faster ones in front that lean harder toward your finger or cursor',
      'Journal sky: clouds now breathe, and slowly stretch apart and draw back together as they drift',
      'Journal sky: a low sun lights the upper-left edges of the clouds and their letters, with a quieter shaded side',
      'Journal sky: each feeling has its own letters — soft waves for calm, rain for sadness, sharp slashes for fear, and more',
      'Journal sky: smoother on large screens',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-09-27',
    changes: [
      'Notes: adjust a note’s cover — drag it to move it and pinch (or scroll) to zoom, so the part you want fills the cover',
      'Notes: the cover keeps your crop in the journal and at the top of the note',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-09-27',
    changes: [
      'Settings: “Export as text” saves your journal, feelings, people, books and picture captions as one Markdown file, without the pictures',
    ],
  },
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
