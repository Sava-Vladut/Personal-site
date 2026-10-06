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
    version: '1.47.1',
    date: '2026-10-06',
    changes: [
      'Smoother wheel: the page’s sky and the wheel button rest while the open wheel covers them',
      'The map’s heat letters take less work to draw each frame',
      'The live dot on Channel points pulses without repainting the page',
    ],
  },
  {
    version: '1.47.0',
    date: '2026-10-06',
    changes: [
      'A calmer wheel: five slices instead of eight — Journal, People, Media, Insights and Settings',
      'Insights holds Stats, the Map and Channel points; the Stats tabs and the Twitch sections are on their own pages instead',
      'Check in and Write left the wheel, since the + already has them',
      'Search and the calendar are back as buttons at the top of the journal',
    ],
  },
  {
    version: '1.46.0',
    date: '2026-10-06',
    changes: [
      'Journal, People and Media moved from the bottom bar onto the wheel, which now shows which page you’re on',
      'The wheel button is at the top of People, Media and Check in too, so you can get anywhere from there',
      'Search and Calendar on the wheel work from any page: they take you to the journal and open there',
      'The bottom bar is now just the + button, in the middle',
      'New way to add: the + opens a fan of bubbles above it. Tap one, or press the + and slide your finger onto one and let go',
      'The bubble under your finger grows in its colour and says what it adds; picking one swells it with a ring while the rest fall away',
    ],
  },
  {
    version: '1.45.1',
    date: '2026-10-06',
    changes: [
      'The wheel button is bigger and livelier: a ring of the category colours that turns, with a wave of light running round it, a small spark circling and a soft glow behind',
      'It speeds up when you point at it and turns a quarter as the wheel opens',
    ],
  },
  {
    version: '1.45.0',
    date: '2026-10-06',
    changes: [
      'New Channel points page: your Twitch points from the points miner, with the balance over 90 days, where the points came from, every channel and what happened lately',
      'The wheel has a Twitch category (Points, Channels, Lately) and shows your total points and today’s gain as you open it',
      'The wheel only shows one ring at a time: what’s inside a category stays hidden until you tap it, with a dot for each thing inside',
      'The wheel now uses the site’s own white and graphite, with each category’s colour as a thin line, its icon and its dots, so it’s lighter and no longer muddy in dark mode',
    ],
  },
  {
    version: '1.44.0',
    date: '2026-10-06',
    changes: [
      'The journal’s four top buttons are now one: a little colour wheel that opens everything else',
      'The wheel grows out of the button onto a sky of its own, with clouds and letters drifting behind it',
      'Categories sit in the middle (Look back, Insights, You, Settings) with what’s in them around those; tap one to zoom in, the middle to go back',
      'The map with its heatmap, each Stats tab, Check in, Write and Mind are all one tap away on the wheel',
      'The sky behind the wheel takes the colour of the category you open, and the wheel sways gently while it waits',
      'While search or the calendar is open, its button stays at the top so you can close it',
    ],
  },
  {
    version: '1.43.2',
    date: '2026-10-06',
    changes: [
      'The bottom tab bar no longer has Check in; start one from the + New button as before',
    ],
  },
  {
    version: '1.43.1',
    date: '2026-10-06',
    changes: [
      'Most picked: the four number cards are now plain instead of four different colours',
    ],
  },
  {
    version: '1.43.0',
    date: '2026-10-06',
    changes: [
      'Music is redesigned to be tighter and easier to scan, in the same cloud style as the main page',
      'Song of the day now sits on the page’s sky as a frosted card: the record, play button, change, shuffle and open in one line, and the last two weeks right underneath',
      'Most picked is a compact card with its own little sky: four numbers in one row, then the top 3 as slim coloured bars, with the top 10 a tap away',
      'Records and tapes are one dense grid of sleeves tinted by how each makes you feel, instead of the wooden crate; songs on repeat carry a small repeat badge',
      'On repeat and In your notes are slim swipeable strips, and “Keep” is a single plus button',
      'Smaller stat pills and filter chips, and less space between sections',
    ],
  },
  {
    version: '1.42.1',
    date: '2026-10-06',
    changes: [
      'Picking a song for a day: the list now sits above the records and the tab bar instead of being covered by them',
    ],
  },
  {
    version: '1.42.0',
    date: '2026-10-06',
    changes: [
      'Song of the day: pick one of your records for each day, or let the dice choose, and play it right there',
      'The last two weeks of songs sit under it as little records; tap any day to pick or change its song',
      'A new “Most picked” panel ranks the songs you choose most, with your streaks and colourful bars',
      'Media now always opens on Music, which comes first in its tabs',
    ],
  },
  {
    version: '1.41.0',
    date: '2026-10-06',
    changes: [
      'The app now speaks Romanian too: choose English or Română under Settings › Appearance › Language',
      'In Romanian, every screen, message, feeling and its definition, weather word, stats insight and the text export are translated',
      'Dates, times and numbers follow the language you pick, and place search answers in it',
    ],
  },
  {
    version: '1.40.1',
    date: '2026-10-05',
    changes: [
      'Writing again within ten minutes reuses where you just were, so the browser doesn’t ask for your location again',
      'On an iPhone, Settings › Places shows how to make Safari stop asking for your location every time',
    ],
  },
  {
    version: '1.40.0',
    date: '2026-10-05',
    changes: [
      'The map’s thread is now one branching arc spilling out from home: thick where you’ve been most, tapering to fine tips at the places you went',
      'No more doubled lines: trips there and back follow the same branch',
      'The thread and the glow around places stay the same size as you zoom in, instead of swelling across the screen',
      'Map pins show each feeling’s sprite, animated like the ones on the journal, with a count on gatherings',
    ],
  },
  {
    version: '1.39.0',
    date: '2026-10-05',
    changes: [
      'A thread on your map: one thick rope joins every place in the order you were there, from your first entry to your latest',
      'It’s woven from twisting strands in the colours of the feelings it joins, drawn in the same drifting letters, with a glow flowing along it toward where you are now',
      'The map no longer leaves a trail behind when you move it',
    ],
  },
  {
    version: '1.38.0',
    date: '2026-10-05',
    changes: [
      'Your map is now a heat map: where you felt things glows in the colour of each feeling, drawn in drifting letters like the journal’s clouds',
      'The more you felt somewhere, the denser and brighter it gets; recent and strong feelings burn brighter, older ones linger, fainter',
      'The heat lingers as you move the map, leaving a fading trail of colour and letters behind',
    ],
  },
  {
    version: '1.37.1',
    date: '2026-10-05',
    changes: [
      'People cards now have real clouds: a small sky of the person’s feelings drifts through each card, drawn in the letters of their main feeling',
    ],
  },
  {
    version: '1.37.0',
    date: '2026-10-05',
    changes: [
      'Each person in People wears the colour of what they make you feel most: soft clouds of it drift through their card, with a glow around their picture',
      'Their feelings’ sprites float around the card and play their little animations',
    ],
  },
  {
    version: '1.36.0',
    date: '2026-10-05',
    changes: [
      'Face ID lock: turn it on in Settings → Privacy, and My Mind asks for Face ID when you open it or come back after a couple of minutes',
      'People asks for Face ID every time you go in, including someone’s page and the mind page, and locks again when you leave',
      'It uses a passkey on your device (Touch ID or Windows Hello on computers); nothing about it is sent to the server',
      'Turning the lock off asks for Face ID first, and if the passkey ever goes missing you can set it up again from the lock screen',
    ],
  },
  {
    version: '1.35.0',
    date: '2026-10-05',
    changes: [
      'Each day in the journal wears its overall feeling: its sprite leads the date, with a line like “A calm day” or “Anger, then joy”',
      'A thin ribbon under each day holds its colours at the hours you felt them, from morning to night',
      'A soft cloud of the day’s colours drifts behind its entries, and each note carries a smaller one of its own feelings, brighter the stronger they were',
      'Check-ins get a gentle wash of their colour, and the sprites in the journal now play their little animations while they’re on screen',
      'On a date you wrote on in an earlier year, “A year ago today” appears under the check-in with how that day felt; tap it to see that day',
    ],
  },
  {
    version: '1.34.0',
    date: '2026-10-05',
    changes: [
      'Link one note to another: type [[ (or tap the new link button) and pick a note from the strip above the keyboard',
      'With nothing typed yet, [[ suggests your latest notes and the books you’re reading; type to find any note by its title or first line',
      'Reading a note, links are chips with the note’s current title, so renaming a note keeps every link to it; tap one for a card with Open',
      'At the bottom of a note, “Linked from” lists the notes that link to it, with the line each link sits on',
      'Typing [[Title]] by hand links a note with that title when no book on your shelf has it',
      'Export as text writes links as the note’s title and day',
    ],
  },
  {
    version: '1.33.0',
    date: '2026-10-05',
    changes: [
      'Voice typing: tap the microphone in a note’s toolbar, say it, tap again, and the words are written at the caret',
      'It runs on your device: your voice is never uploaded. The first tap offers a one-time download of a speech model (45–80 MB), and after that it works offline',
      'Settings → Voice typing: choose Quick, Accurate or Other languages (around 100, with a language setting), see what’s on the device, or remove it to free the space',
    ],
  },
  {
    version: '1.32.0',
    date: '2026-10-04',
    changes: [
      'A desktop layout for wide screens (1024px and up): the tab bar becomes a sidebar with Journal, Check in, People, Media, Stats, Settings and a New button',
      'Pages use the whole screen: the journal keeps your day beside the entries, check-in and “What’s on your mind” put the picker beside the details, and Stats and Settings flow into two columns',
      'Phones and small tablets look and work exactly as before',
    ],
  },
  {
    version: '1.31.1',
    date: '2026-10-04',
    changes: [
      'With more than one feeling on a note, the intensity slider now shows each one’s world: all their sprites, and bars that take turns in their colours',
    ],
  },
  {
    version: '1.31.0',
    date: '2026-10-04',
    changes: [
      'One new intensity slider replaces the two old ones: tap or drag along the meter, or use the arrow keys',
      'It takes the feeling’s colour, shows its sprite growing with the level, and says what each step means (“Hard to ignore”)',
      'At the top level the meter glows and the last bar bobs',
    ],
  },
  {
    version: '1.30.0',
    date: '2026-10-04',
    changes: [
      'The feeling wheel and picker now always open on all worlds, instead of jumping into the world of the first feeling you had already chosen',
      'The app remembers how you like things: the Books shelf and order, the Music kind and order, the People order, the Mind range, the Journal calendar being open, and the last Patterns tab',
    ],
  },
  {
    version: '1.29.0',
    date: '2026-10-04',
    changes: [
      'On desktop, right-clicking a note or check-in opens a small menu right at the pointer instead of a dialog',
      'The right-click menu works with the keyboard: arrow keys to move, Enter to pick, Escape to close',
      'Opening a sheet or dialog on desktop no longer makes the page jump sideways',
    ],
  },
  {
    version: '1.28.1',
    date: '2026-10-02',
    changes: [
      'The calendar’s day numbers (10, 15, 20…) no longer break onto two lines on narrow screens',
    ],
  },
  {
    version: '1.28.0',
    date: '2026-10-02',
    changes: [
      'Give someone a theme song: it sits at the top of their page, ready to play',
      'Pick it from the music that already brings them to mind, the rest of your music, or straight from Spotify',
      'A song’s page says whose theme song it is',
    ],
  },
  {
    version: '1.27.1',
    date: '2026-10-02',
    changes: [
      'Protect newer journal edits during sync and backup imports, even with multiple tabs open',
      'Keep deleted entries from returning when a pending sync or backup finishes',
      'Keep scrolling locked while a nested sheet is open and ignore location results after closing details',
      'Prevent duplicate people and music from repeated taps and keep your latest selections',
      'Show backdated feelings in the correct month and keep page-zero reading progress',
      'Keep text exports in journal date order and include tags consistently',
      'Reduce repeated work in stats, tag suggestions, media lookup and the icon picker',
      'Let icon loading recover after a connection failure',
      'Keep the offline journal page intact after opening an image or download',
      'Remove unused code and styles, organize shared files and improve server cleanup',
    ],
  },
  {
    version: '1.27.0',
    date: '2026-10-02',
    changes: [
      'Key dates on a person’s page: birthdays, anniversaries or any day worth remembering, with how old they’re turning or how many years it’s been',
      'A gentle note on your journal in the two weeks before one comes round; put it away and it waits until next year',
      'People count every place you tag them: notes where they’re only tagged in the words, and the pages of other people, books and songs',
      'A person’s page lists the pages that mention them, under “Mentioned on”',
      'Renaming someone now updates their tags on book, song and person pages too',
      '“Haven’t thought of in a while” on People: the people you haven’t tagged in a month or more, with a quick check-in or note',
      'How thinking of someone is changing: a month-by-month strip of feelings over the last year, and whether it feels warmer or heavier lately',
    ],
  },
  {
    version: '1.26.0',
    date: '2026-10-02',
    changes: [
      'Type @ to tag someone, a book or a song in the words on a person’s, book’s or song’s page, not just in notes',
      'Tags work in a check-in’s context too, and tagging someone there adds them to the check-in',
      'Once you’re done writing, those words show their tags as chips you can tap to open; tap the words to keep writing',
    ],
  },
  {
    version: '1.25.2',
    date: '2026-10-02',
    changes: [
      'The world sprites in the Dex, on the Stats overview and in the emotion wheel details now play the pixel animations too, in place of the old spinning and squashing',
    ],
  },
  {
    version: '1.25.1',
    date: '2026-10-02',
    changes: [
      'The eight worlds under “How are you feeling?” on the main screen now play the same pixel animations as the emotion wheel, each starting a beat after the last',
    ],
  },
  {
    version: '1.25.0',
    date: '2026-10-02',
    changes: [
      'The world sprites on the emotion wheel come alive when you open a world, hover one or hold a feeling: the heart beats, the star hops, the leaf drifts, the spark twinkles, the ghost looks around, rain falls, the flame flickers and the face looks away',
      'They stay still if your device asks for reduced motion',
      'A light haptic tick each time a held finger slides onto another emotion',
      'Inside a world, tap beside the wheel or pinch in to go back to all worlds (trackpad pinch works too)',
    ],
  },
  {
    version: '1.24.1',
    date: '2026-10-01',
    changes: [
      'Removed the Connections page, and its links from People and a person’s page',
    ],
  },
  {
    version: '1.24.0',
    date: '2026-10-01',
    changes: [
      'New Connections page, under People: the threads your notes already hold, from who to where, when, what you felt and what was playing',
      'Each thread ends in the note that holds most of it together',
      'How it changed: the feelings around someone (or a place, a song…) over time, and whether the notes are drifting apart or have gone quiet',
      'Tap any person, place, month, feeling, song or book to follow its own thread',
      'A person’s page links to their connections',
    ],
  },
  {
    version: '1.23.0',
    date: '2026-10-01',
    changes: [
      'Formatting shows while you write: bold, italics, headings, lists, quotes, highlights and code look the part, their markers faded back',
      'Music in a note steps aside while you type and comes back when you’re done; anything playing keeps playing',
      'The note toolbar is a small pill: the Aa button swaps the add buttons for the formatting tools',
      'Selecting text brings up the formatting tools by themselves',
      'Formatting buttons light up for the style the caret is in',
      'The toolbar tucks away while you scroll down a note and comes back when you scroll up',
    ],
  },
  {
    version: '1.22.0',
    date: '2026-10-01',
    changes: [
      'Media now sits under its own drifting sky: letters over your books, music notes over your records',
      'The sky takes its colours from how your books and music make you feel, and changes with the tab',
      'Titles rise out of the clouds a letter at a time, and your shelf and record numbers count up in small frosted tiles',
      'The Books / Music switch slides between tabs',
      'Search moves behind a button, and filters and sort order share one row that scrolls sideways',
      'Reading now and On repeat become rows of cards you swipe through',
      'Smaller records, tapes and book spines, so more of your collection fits on screen',
    ],
  },
  {
    version: '1.21.3',
    date: '2026-10-01',
    changes: [
      'Keep tag animations aligned with the text on iOS when the keyboard shifts the page',
      'Place tag bursts on each line when a tag wraps, instead of between the lines',
    ],
  },
  {
    version: '1.21.2',
    date: '2026-10-01',
    changes: [
      'Show tag suggestions reliably from the first letters, including accented names and names with spaces',
      'Keep the tag toolbar above the iOS keyboard without jumping the note or hiding the first matches',
      'Keep your typing and caret safe when picking or creating a tag, including during keyboard composition',
      'Make tag animations steadier and keep tag cards within the visible screen',
    ],
  },
  {
    version: '1.21.1',
    date: '2026-10-01',
    changes: [
      'More reliable saving: keep your latest edits and explain when storage is unavailable',
      'Safer backup imports and sync: newer edits win, damaged photos are skipped, and canceled syncs stop sending',
      'Prevent duplicate check-ins and keep person and book tags correct when saving or deleting',
      'Keep image, music and place searches from showing outdated results',
      'Keep weather and place details matched to the entry after its date or location changes',
      'Improve offline updates, photo viewing and formatting at the start or end of a line',
      'Clean up unused background work and interrupted uploads without removing features',
    ],
  },
  {
    version: '1.21.0',
    date: '2026-10-01',
    changes: [
      'Tag people, books and music in a note: type @ (or tap the new @ button) and pick from the strip above the keyboard',
      'With nothing typed yet, @ suggests the people you’ve tagged lately, the books you’re reading and the music on repeat',
      'Arrow keys and Enter pick a tag, Escape puts the strip away, and a name nobody has yet can be added as someone new',
      'A tagged person is added to the note’s Thinking of, so it shows on their page and in your stats',
      'Tags land with a little burst of colour, and glow while you write: people in the colour of the feeling they bring',
      'Reading a note, tags are chips with a face, a cover or a tiny record; tap one for a card about it, with Write and Open',
      'A song’s card plays it right there, and its page lists the notes that tag it',
      'Renaming someone updates the notes that tag them, and Export as text writes tags as names',
    ],
  },
  {
    version: '1.20.0',
    date: '2026-10-01',
    changes: [
      'Books is now Media, with your bookshelf on one side and a record collection on the other',
      'Add songs, albums, playlists and podcasts from Spotify: from what you’re listening to, a search, your playlists or a link',
      'Records stand in a wooden shelf and tapes in a rack; songs you mark On repeat spin slowly at the top',
      'Each one has its own page: put the record on, rate it, say how it makes you feel and who it reminds you of, and see the notes it’s in',
      'Music you’ve added to notes waits under In your notes, a tap away from your collection, and a note’s player can keep it in Media too',
      'Write about a song from its page, and the new note starts with it',
      'A person’s page lists the music that reminds you of them, and the + menu can add music',
      'Your music is synced, backed up, and included in Export as text',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-10-01',
    changes: [
      'Books stand on wooden shelves as spines, one shelf for each: in the colour of their cover, as thick as they are long, with the title down the spine',
      'Each spine has a library sticker with its author’s first letters, gold dots for its rating, and a bookmark poking out of the ones you’re reading',
      'A book’s page has a library card in its pocket: the day it joined your shelf, when you started and finished, and every note about it, stamped in ink',
      'Tap a stamp to change its date, and write in the page you’re on',
      'Songs and albums in a note are records in their sleeves, and playlists and podcasts are cassettes',
      'Tap one to put it on: the record slides out and spins, or the tape’s reels turn, and Spotify’s player opens right there',
      'Picking music shows the same records and tapes, and notes in the journal show a tiny record next to their song',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-09-30',
    changes: [
      'Weather: turn it on in Settings, and each note and check-in gets the weather, the temperature and the hours of daylight, from Open-Meteo',
      'Your older entries get their weather too, filled in for your home town',
      'Places: turn them on, and entries remember where you wrote them, with the neighbourhood’s name from OpenStreetMap',
      'Notes and check-ins show their weather in the journal, and a note’s Feelings page has a new Where section to add or remove its place',
      'Stats has a Weather tab: your mood by sky, temperature, daylight and whether it was dark out, with what stands out',
      'A map of your entries, in the colour of what you felt: pinch, drag and tap a spot to see what you wrote there',
      'Search finds entries by place name',
    ],
  },
  {
    version: '1.17.1',
    date: '2026-09-30',
    changes: [
      'Fixed a stray text highlight and Copy / Look Up bubble appearing on the note options sheet after holding a note to pin or unpin it',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-09-30',
    changes: [
      'Redesigned the Stats page with a drifting sky header in the colour of the feeling you had most, like the Journal',
      'The whole page now takes that colour: tabs slide between each other, and the calendar, heatmap and bars follow it',
      'Overview has a new summary card with a mascot for your leading feeling and a split bar showing your feelings by world',
      'Stat tiles gained icons, progress meters and streak pips, and insights are tinted with the world they are about',
      'Charts draw themselves in as you scroll to them: the mood line traces across, dots pop in in the colour of each day\u2019s world, and bars grow from their base',
      'The emotion wheel turns in over a soft breathing glow',
      'Feelings that show up together, or come next, are shown as coloured world chips',
      'The Dex has a row of world progress badges with animated feelings, and found feelings pop in',
    ],
  },
  {
    version: '1.16.4',
    date: '2026-09-30',
    changes: [
      'Fixed the Back, Delete and Done buttons disappearing on a person\u2019s page while scrolling',
    ],
  },
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
