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
    version: '1.146.4',
    date: '2026-10-28',
    changes: [
      'Insights: a time range with nothing in it offers Show all time, instead of only saying to try a longer one',
    ],
  },
  {
    version: '1.146.3',
    date: '2026-10-27',
    changes: [
      'Download as Word says “Making the Word file…” when it takes a moment (a note with pictures), instead of seeming to do nothing',
    ],
  },
  {
    version: '1.146.2',
    date: '2026-10-27',
    changes: [
      'Insert › Table on a touch screen: the first tap on the grid shows the size, a second tap puts the table in, so a slip doesn’t add the wrong one',
      'The table grid’s squares are bigger on touch screens',
    ],
  },
  {
    version: '1.146.1',
    date: '2026-10-27',
    changes: [
      'Remove and Delete are red at the bottom of the countdown, date, link and comment sheets, so they don’t look like the Save or Done beside them',
    ],
  },
  {
    version: '1.146.0',
    date: '2026-10-27',
    changes: [
      'Download a note as a Word file (.docx): Download as Word in More, or Export › Word on the ribbon’s View tab; it’s named after the note',
      'The file is made on your device, nothing is uploaded, and it opens in Word, LibreOffice and Google Docs',
      'The title and date go at the top; headings, alignment, lists (bullets, 1. a. i. numbering, tasks as ☐ and ☑), quotes, callouts, code, dividers and page breaks come out as Word’s own',
      'Bold, italic, underline, strikethrough, superscript, subscript, font colours, highlights and links keep their look; tags show as their names',
      'Footnotes become Word footnotes, and tables Word tables with the header row repeated on each page and each column aligned as in the note',
      'Pictures and albums go in at the size they have in the note, with their caption under them and their alt text; a picture that can’t be read leaves its words instead',
      'Comments stay out unless you turn on Include comments when you download; then they go in as Word comments on their words',
    ],
  },
  {
    version: '1.145.0',
    date: '2026-10-27',
    changes: [
      'Comments in notes, as in Word: a new Review tab with New comment (Ctrl+Alt+M), Delete, Previous, Next and Show comments',
      'A comment goes on the selected words, or the word at the caret; its box opens beside them for you to write in, and a comment left empty goes',
      'On a computer your comments sit in the margin right of the page, each level with its words; click one to go to its words, edit it in place, Esc or Enter saves it',
      'On a phone the commented words are lit softly: tap them to read, edit or delete the comment',
      'Comments work on any words: in lists, quotes, tables and over several lines, and with bold, colours, links and tags',
      'Comments are private: a public note, its link preview, your status page, card previews, word counts, exports and printing leave them out (the words they’re on stay)',
      'Searching the journal finds what your comments say too',
      'Notes keep a comment as an HTML comment beside its words, which Obsidian and GitHub hide, so the note reads the same there',
    ],
  },
  {
    version: '1.144.0',
    date: '2026-10-27',
    changes: [
      'Tables in notes, as in Word: Insert › Table and pick a size on the grid (up to 8 × 8); the first row is the header',
      'Tab and Shift+Tab go from cell to cell (Tab in the last cell adds a row), Enter goes to the cell below, and the arrows move between cells',
      'A Table tab comes up while you’re in a table (in the phone’s bar too): insert rows above or below and columns left or right, delete a row, a column or the table, and align a column left, centre or right',
      'Bold, colours, tags, links, Find & Replace, AutoCorrect and the Format Painter all work in cells; lists, headings, quotes and page breaks stay out of them',
      'Tables pasted from Word, Google Docs or a web page stay tables (merged cells come in split, the extra cells empty); pasting into a cell puts the words in that cell, and a table pasted there fills the cells from it',
      'Typing a table’s Markdown (| a | b | then | --- | --- | and Enter) makes it a table',
      'Notes keep tables as Markdown pipe tables, which Obsidian and GitHub show too; tables already written that way in your notes now show as tables',
      'Tables show in the reading view and on public notes, scroll sideways when they’re wider than a phone, and print with ruled cells, no row split between pages',
      'Card previews, search, exports and link previews read a table’s cells as plain words',
    ],
  },
  {
    version: '1.143.0',
    date: '2026-10-27',
    changes: [
      'Laws of power, Mind traps and Win friends use the whole width of a wide screen instead of a phone’s page in the middle: the page now runs from edge to edge',
      'The list of laws, traps and principles is cards in as many columns as fit, each with room for three lines of its description',
      'An opened law, trap or principle is a large reading panel: the title, the scores and the controls stay in a column at the left while the chapters read in two columns beside them, with a hairline between',
      'The shadow side, the honest version, the question to sit with and the related entries run across the whole panel; a trap’s “Try it on yourself” quiz does too, so a verdict appearing can’t move the text beside it',
      'Mind traps: the “How power is scored” and closing notes sit under the quiz in the side column, so the list isn’t followed by an empty stretch',
      'Labels that were cut off on a desktop now wrap: the figures at the top, a row’s “Law 12 · Arena” line, and the game’s score line',
      'Phones and narrow windows look as they did',
    ],
  },
  {
    version: '1.142.1',
    date: '2026-10-27',
    changes: [
      'On a phone, the find bar gives the search field its own line, so you can see what you type; the count and buttons sit under it, with Close at the end',
      'Tapping a find or replace field on a phone no longer zooms the page in',
    ],
  },
  {
    version: '1.142.0',
    date: '2026-10-27',
    changes: [
      'Find in a note, as in Word: Ctrl+F (or Home › Find) opens a small find bar; every match is highlighted, the current one stronger, with “3 of 12”',
      'Enter or F3 goes to the next match, Shift+Enter or Shift+F3 to the previous; Match case and Whole words only; Esc closes it and leaves the match selected',
      'Replace and Replace All: Ctrl+H (or Home › Replace); Replace All is one step to undo and says how many it replaced. Reading, you can find but not replace',
      'Ctrl+F still opens the browser’s own find outside the note’s text',
      'Navigation pane (View › Navigation pane): the note’s headings in a list at the left, indented by level, the one you’re in highlighted; click one to go there. On a phone it opens as a sheet',
      'Pictures can have a caption, shown under them (in the note, the reading view, public notes and when printed), and alt text for screen readers: Picture › Alt text and Caption',
      'Captions and alt text are searchable in the journal and included in exports; link previews leave them out',
      'Notes keep them in the picture’s line, e.g. [[photo:… 50 left|caption=Our trip|alt=A boat at dusk]]; pictures from before are unchanged',
    ],
  },
  {
    version: '1.141.0',
    date: '2026-10-27',
    changes: [
      'Align text left, centre, right or justified: four buttons in the ribbon’s Paragraph group, or Ctrl+L, Ctrl+E, Ctrl+R and Ctrl+J as in Word (press it again to go back to the left), for lines and headings',
      'Inline code moved to Ctrl+Shift+E, so Ctrl+E centres as in Word',
      'Ctrl+R in a note no longer reloads the page, nor do Ctrl+L and Ctrl+J go to the address bar or downloads',
      'Page breaks: Insert › Page break or Ctrl+Enter (Shift+Enter is still a new line); a dashed line in the note, a new page when printed or saved as a PDF',
      'Footnotes: Insert › Footnote or Ctrl+Alt+F puts a small number at the caret and its text at the end of the note; numbers follow the order they appear in, and a click goes from the number to its footnote and back',
      'A footnote nothing refers to any more shows faded, and a number whose footnote is gone is struck through',
      'Public notes show alignment, page breaks and footnotes too (footnotes at the end); previews, search and word counts leave the markers out',
      'Notes keep these as Obsidian does: a hidden <!-- align:center --> at the line’s end, <div style="page-break-after: always"></div> and [^1] footnotes',
    ],
  },
  {
    version: '1.140.0',
    date: '2026-10-27',
    changes: [
      'Underline in notes: Ctrl+U or the ribbon’s Underline button',
      'Superscript (Ctrl++) and Subscript (Ctrl+=) on the ribbon, for x² and H₂O',
      'Font colour: red, orange, green, blue, purple or grey, from the ribbon’s Font colour button (its arrow picks the colour, or Automatic)',
      'Highlight in green, blue, pink, purple, orange or grey too: the arrow beside Highlight picks the colour, or No colour',
      'Format Painter on the ribbon: copy the style of some words onto the next ones you select (double-click it to keep painting, Esc to stop)',
      'Clear formatting also takes off underline, superscript, subscript and colours',
      'Pasting from Word, Google Docs or a web page keeps underline, superscript, subscript and colours (as the nearest of the note’s colours)',
      'Notes keep these as Obsidian does (<u>, <sup>, <sub>, coloured <span> and <mark>), so they show in the reading view, on public pages and in Obsidian, and leave previews, search and word counts alone',
    ],
  },
  {
    version: '1.139.0',
    date: '2026-10-27',
    changes: [
      'Ctrl+S saves the note at once, and the status bar ticks to say so',
      'Print a note, or save it as a PDF: Print on the ribbon’s View tab, Print / Save as PDF in More, or Ctrl+P — only the title, date and words go on the page',
      'AutoCorrect as in Word: curly quotes and apostrophes, -- becomes —, ... becomes …, (c) ©, (r) ®, (tm) ™, -> → and <- ← (Backspace straight after puts it back)',
      'With words selected, the status bar counts them: “12 of 340 words”',
      'Heading 4, 5 and 6 are in the Styles gallery, and light up when the caret is in one',
      'A newer copy of the note arriving from another device is no longer something Undo takes back',
      '“Not saved” in the status bar is a button that tries again, and saving tries again by itself when you’re back online',
      'The ribbon works from the keyboard: arrow keys move between its buttons, F6 goes round the ribbon, the text and the status bar, Esc goes back to the text',
      'Alt+Shift+Up and Down move the line or list item (or the selected lines) up and down, as in Word',
      'Restart numbering and Continue numbering, from the arrow beside Numbered list or a right-click on it',
      'Numbered lists a level in count a., b., c., and the next level i., ii., iii.',
    ],
  },
  {
    version: '1.138.19',
    date: '2026-10-27',
    changes: [
      'The Global Ops port page is gone from Extras',
    ],
  },
  {
    version: '1.138.18',
    date: '2026-10-27',
    changes: [
      'Opening the app starts loading the page while the offline helper is still waking, instead of after it',
      'Updates download only the files that changed, instead of the whole app again',
      'Starting up no longer reads every stored photo just to tidy away unused ones',
      'The journal and Settings no longer load the full list of changes just to show the newest version',
    ],
  },
  {
    version: '1.138.17',
    date: '2026-10-27',
    changes: [
      'In the date picker, Today, Yesterday, This week and the other shortcuts turn the calendar to the month they pick, so you see what was chosen',
    ],
  },
  {
    version: '1.138.16',
    date: '2026-10-27',
    changes: [
      'Rating a book, a song or a repo is easier to hit: each star takes a finger-sized tap, with no gaps between them',
    ],
  },
  {
    version: '1.138.15',
    date: '2026-10-27',
    changes: [
      'Removing a birthday or another date from someone’s page offers Undo',
      'Removing someone’s theme song offers Undo, so you don’t have to find it again',
    ],
  },
  {
    version: '1.138.14',
    date: '2026-10-27',
    changes: [
      'Clearing a day’s song says so, with Undo to put the song back',
    ],
  },
  {
    version: '1.138.13',
    date: '2026-10-27',
    changes: [
      'Stop sharing is red wherever it appears (a note, your status, the shared list in Settings), so it no longer looks like Copy or Open',
      'In Settings’ shared list, Stop sits a little further from Copy link',
    ],
  },
  {
    version: '1.138.12',
    date: '2026-10-27',
    changes: [
      'A key date with a year that can’t be right now says why Add is greyed out, and the year field turns red',
      'Any field that stops you saving turns red, such as a countdown that ends before it starts',
    ],
  },
  {
    version: '1.138.11',
    date: '2026-10-27',
    changes: [
      'The map’s buttons say what they do when you point at them, including the one that shows every place',
    ],
  },
  {
    version: '1.138.10',
    date: '2026-10-27',
    changes: [
      'When a repo search or filter finds nothing, a Clear filters button shows them all again',
    ],
  },
  {
    version: '1.138.9',
    date: '2026-10-27',
    changes: [
      'In Mind traps, Laws of power and Win friends, a search or filter that finds nothing offers Clear filters',
    ],
  },
  {
    version: '1.138.8',
    date: '2026-10-27',
    changes: [
      'When your shelf or records find nothing for a search or a filter, a Clear filters button shows everything again',
    ],
  },
  {
    version: '1.138.7',
    date: '2026-10-27',
    changes: [
      'When a People search finds no one, a Clear search button brings everyone back',
    ],
  },
  {
    version: '1.138.6',
    date: '2026-10-27',
    changes: [
      'In Mind traps, Laws of power and Win friends, a count you tapped by mistake can be taken back with Undo',
    ],
  },
  {
    version: '1.138.5',
    date: '2026-10-27',
    changes: [
      'Adding a book or music opens with the search ready to type, so it’s one tap less',
    ],
  },
  {
    version: '1.138.4',
    date: '2026-10-26',
    changes: [
      'In Settings, tapping anywhere on a setting’s row turns it on or off, not only the small switch',
    ],
  },
  {
    version: '1.138.3',
    date: '2026-10-26',
    changes: [
      'On a tablet or a wide screen, the note’s Share and Done buttons are easier to hit and sit further apart',
    ],
  },
  {
    version: '1.138.2',
    date: '2026-10-26',
    changes: [
      'Removing a countdown happens at once with Undo, like removing a book or a person, instead of asking first',
    ],
  },
  {
    version: '1.138.1',
    date: '2026-10-26',
    changes: [
      'Typing a person’s name on a phone capitalises every word, and the keyboard’s Enter says Next, since it moves on to the notes',
    ],
  },
  {
    version: '1.138.0',
    date: '2026-10-26',
    changes: [
      'Skies are drawn in the background, off the page itself, so scrolling, taps and page changes never wait on a cloud',
      'Every sky on screen moves from one shared timer, and skies fade in softly once drawn instead of popping in',
      'Skies, Stats clouds, the map heat and the journal\'s little weather clouds hold still while a sheet or the wheel is open',
      'The open wheel\'s ring of letters turns without redrawing the wheel, and its slices swing into place as it opens',
      'The journal\'s drifting lights, the song card, People cards and the Mind wheel play a couple of times, then rest',
      'Buttons and cards over a moving sky (page headers, the public status page, the sign-in page) no longer re-blur it every frame',
      'The New button\'s sky in the sidebar only drifts while you point at it',
      'Sunny days glow without repainting their text, and the Stats brain draws its letters much faster',
      'Photos on journal cards use a lighter copy made once on this device, so scrolling a journal full of photos stays smooth',
      'Searching the journal and People no longer re-reads every note on every key',
      'The opening animation keeps its frames: syncing and loading wait until the journal has opened',
      'Charts, tooltips, tagged-name cards, sheets and long text boxes do less work while you drag, scroll or type',
      'Syncing doesn\'t send the whole journal in the middle of a sentence',
      'The + button\'s glass rests its lens while the page scrolls, so scrolling stays smooth on Android and desktop Chrome',
      'No decoration loops forever any more: the wheel button, the top feeling level and the rest play a few times, then rest',
      'A sheet you drag down drops its blur until it settles, and the map pans without repainting its tiles',
      'The app starts lighter in English: the Romanian dictionary only loads on a device set to Romanian',
      'Writing a note no longer redraws the whole page after every autosave',
      'In a long journal, days further down aren\'t drawn until you scroll near them',
    ],
  },
  {
    version: '1.137.4',
    date: '2026-10-26',
    changes: [
      'The open wheel no longer keeps the processor busy: its slow sway plays once and then rests',
      'Lists, widgets and cloud titles fade in without a blur, so they land smoothly on phones',
      'Skies hold still while a page slides in, so page changes are smoother',
      'The live dot on Status and the ring around the + button animate without repainting',
    ],
  },
  {
    version: '1.137.3',
    date: '2026-10-26',
    changes: [
      'When a journal search or day finds nothing, a Clear filters button takes you straight back to everything',
      'The journal’s day filter says “Show all days” (and no longer “Senin” in Romanian)',
    ],
  },
  {
    version: '1.137.2',
    date: '2026-10-26',
    changes: [
      'The little ✕ that takes a person, a feeling or a song off a check-in or a note is much easier to hit',
    ],
  },
  {
    version: '1.137.1',
    date: '2026-10-25',
    changes: [
      'Stat tile numbers use the same letter spacing as the other big numbers',
    ],
  },
  {
    version: '1.137.0',
    date: '2026-10-25',
    changes: [
      'You can have several countdowns going at once: start a new one with the + on the Countdowns page',
      'Each running countdown gets its own card with its ring and clock, and its own pencil to change or remove it',
      'Countdowns that are over move to a list below, where you can give them new dates or remove them',
      'The button next to the wheel shows the countdown ending soonest, and the public status can show all the running ones',
    ],
  },
  {
    version: '1.136.3',
    date: '2026-10-25',
    changes: [
      'On the notes page the buttons sit on their own row above the date, so the date fits on one line instead of three',
    ],
  },
  {
    version: '1.136.2',
    date: '2026-10-25',
    changes: [
      'The Global Ops page uses the app’s standard sizes: its tiles widen with the other grids, and its icons and code match the rest of the app',
    ],
  },
  {
    version: '1.136.1',
    date: '2026-10-25',
    changes: [
      'The Global Ops page and a repo’s commit list no longer borrow each other’s styles after you’ve opened both',
    ],
  },
  {
    version: '1.136.0',
    date: '2026-10-25',
    changes: [
      'New Global Ops port page under Extras: how the browser port of Global Operations is coming along, live',
      'It shows the milestones reached, the latest status, what’s next and the whole progress log',
      'Live activity lists each command and edit made to the port as it happens, with the files not committed yet',
      'Commits with their messages, the newest build and deploy times, the last lines of the newest logs and the latest screenshots',
      'It refreshes by itself every 5 seconds while the port is being worked on, every 30 seconds otherwise',
    ],
  },
  {
    version: '1.135.2',
    date: '2026-10-25',
    changes: [
      'Learn no longer names the books’ authors: the page subtitles, headings, laws and principles now speak of the law, the principle or the book',
      'Stories that starred the author now tell it about an unnamed person, in English and Romanian',
      'Wording pass on Learn: two principle titles use British spelling and a few sentences read more cleanly',
    ],
  },
  {
    version: '1.135.1',
    date: '2026-10-25',
    changes: [
      'A shared trap, law or principle opens as a full page of its own, with nothing else from Learn around it',
      'A shared Learn page shows just that page: no back arrow and no links on to the other Learn pages',
    ],
  },
  {
    version: '1.135.0',
    date: '2026-10-25',
    changes: [
      'Mind traps, Laws of power and Win friends have a Share button: anyone with the link can read the page without signing in',
      'Every opened trap, law and principle can be shared on its own, and the link opens straight to it',
      'Pick whether a shared link opens in English or Romanian',
      'Shared Learn links preview with the page’s name in chats, not as the private journal',
    ],
  },
  {
    version: '1.134.2',
    date: '2026-10-24',
    changes: [
      'The styles left over from the removed Your brain page are gone, so the app loads a little less',
      'The Insights description in the menu is translated into Romanian again',
    ],
  },
  {
    version: '1.134.1',
    date: '2026-10-24',
    changes: [
      'Removed the Your brain page: it’s gone from the wheel under Insights (the brain on Stats stays)',
    ],
  },
  {
    version: '1.134.0',
    date: '2026-10-24',
    changes: [
      'Learn: each hand-drawn mark is made in front of you the first time you see it: the tile settles, the paper is laid down piece by piece, the ink lines draw themselves on and the solid ink lands last',
      'Learn: hovering or pressing a row, link or today’s card lifts its mark’s cut paper a hair off the tile',
      'Learn: the icons move with meaning: arrows step forward, the eye blinks, the crown hops, sparkles twinkle, the dice tumbles when you draw at random, the search glass tilts as you type',
      'Learn: counting pops the icon, Practise draws its check on, and a quiz answer’s tick or cross draws itself (a wrong one gives a small shake)',
      'Learn: the icons on an opened entry’s boxes draw themselves on once the sheet has landed: the heart beats, the moon swings, the book opens',
      'Books and Music: the empty-shelf drawings are made in front of you too',
      'All of it plays once or when you act, never loops, and is off when your device asks for reduced motion',
    ],
  },
  {
    version: '1.133.0',
    date: '2026-10-24',
    changes: [
      'Learn: Mind traps, Laws of power and Win friends share one calmer layout: three figures and the search on the sky, today’s entry, a map and a game in a side column, and the whole list grouped by family, arena or part in compact rows',
      'Learn: on a wide screen the list sits on the left and the side column on the right, and cards no longer jump between columns when one changes height',
      'Learn: no more stuttering entrances, colour wash on arrival, spinning spiral or marks that wobble on hover',
      'Learn: the caption under each map keeps its height, so the page doesn’t bounce as you move across it, and the map labels are bigger',
      'Learn: in the games and quizzes nothing moves under your finger: the score line is always there and the answer shows below the options',
      'Learn: opening a related entry in a sheet jumps straight to its top and fades it in, instead of swapping the text mid-scroll',
      'Learn: an opened entry has clearer chapters, one box style for stories and experiments, and the player/target and why/how tabs now live inside it',
      'Laws of power: the 8×6 board is gone; Win friends: the ladder of 30 is gone (both are in the grouped list and the map)',
      'Mind traps: each trap now links to the laws of power that spring it',
    ],
  },
  {
    version: '1.132.0',
    date: '2026-10-24',
    changes: [
      'Check-ins: the song you’re playing on Spotify is added to the check-in by itself, shown as a chip you can take off before logging',
      'Check-ins: the song shows in the check-in’s line as “listening to …”',
    ],
  },
  {
    version: '1.131.1',
    date: '2026-10-24',
    changes: [
      'Notes: the Now playing and Mood buttons are gone from the Insert tab again',
    ],
  },
  {
    version: '1.131.0',
    date: '2026-10-24',
    changes: [
      'Notes: Insert › Now playing adds the song you’re listening to on Spotify in one tap',
      'Notes: Insert › Mood opens the feelings picker straight from the ribbon',
    ],
  },
  {
    version: '1.130.0',
    date: '2026-10-24',
    changes: [
      'Notes: numbered lists count again whatever changes them: deleting or moving lines, pasting, joining lines, or turning items into headings or bullets',
      'Notes: the phone keyboard’s own Return in a to-do keeps every word and starts a new to-do; a numbered line split on Android stays numbered',
      'Notes: while you write without stopping, the note saves at least every two seconds, so closing the app can’t lose what you just typed',
      'Notes: if saving fails, it keeps trying after you leave the note, and the app reconnects to its storage after sitting in the background on iPhone',
      'Notes: an edit made on another device shows up in a note you have open, instead of being written over by your next key',
      'Notes: your last words are synced as you leave the app, not the next time you open it',
      'Notes: a new note you emptied before tapping Done isn’t left behind as a blank note',
      'Notes: adding a link to selected words puts it on those words, not at the start of the note',
      'Notes: no stray empty line under a line that ends with a tag',
      'Notes: text pasted from Notes, Mail or Google Docs keeps its empty lines as they were instead of doubling them',
      'Notes: iPhone’s double-space full stop after a tag keeps its space',
      'Notes: Delete at the end of a quote, Quote on lines that are partly quoted, and Enter across list items behave as expected',
      'Notes: a list copied from a public note pastes back as the same list',
      'Public notes: spaces, tags, long code lines and pictures look as they do in the app',
      'Notes: a callout’s title zooms with the page on a computer',
    ],
  },
  {
    version: '1.129.1',
    date: '2026-10-24',
    changes: [
      'Notes: a numbered or bulleted line uses the full width of the page on a phone instead of wrapping in a narrow column',
      'Notes: a callout’s title with bold words or a tag in it wraps as one line of text',
    ],
  },
  {
    version: '1.129.0',
    date: '2026-10-24',
    changes: [
      'Notes: selecting text that has a tag in it works on a phone: the handles move past the tag instead of jumping, and the tag lights up as part of the selection',
      'Notes: a tag opens its card on a tap only, not at the end of a long press or a drag to select, and a double tap no longer opens and shuts it',
      'Notes: tapping a tag puts the caret on the side you tapped, so you can write before a tag at the start of a line',
      'Notes: the @ suggestions have a close button, “dinner @ home” no longer brings them up, and Return no longer adds a new person by itself',
      'Notes: on Android, the line you’re typing stays just above the keyboard instead of jumping a keyboard’s height up',
      'Notes: a tap to clear a selection, or to put a tag’s card away, does only that: it doesn’t start writing or open what’s underneath',
      'Notes: a tag’s card follows its tag as the page scrolls instead of closing',
      'Journal: back from a note, the feed is where you left it, with the same search and day',
      'Journal: Search on the keyboard puts the keyboard away',
      'Journal: holding a card and then sliding no longer pins or deletes it behind its menu',
      'Copy text and Share give a note’s words without Markdown or tag codes',
      'Sheets with a search field sit above the keyboard, so every result can be reached',
      'Bigger touch targets for a note’s details line and its music, and for the buttons on a tag’s card',
    ],
  },
  {
    version: '1.128.21',
    date: '2026-10-24',
    changes: [
      'The home page no longer shows a “GitHub isn’t connected” notice',
    ],
  },
  {
    version: '1.128.20',
    date: '2026-10-24',
    changes: [
      'The song of the day’s label, stat tile labels and Twitch’s bar labels space their icon like the app’s other small labels',
    ],
  },
  {
    version: '1.128.19',
    date: '2026-10-24',
    changes: [
      'Small labels with an icon (journal day labels, Stats’ mood labels, the status page’s time and the share note) space it like the app’s other small labels',
    ],
  },
  {
    version: '1.128.18',
    date: '2026-10-24',
    changes: [
      'Section headings with an icon space it the same as buttons do, here and in Laws of power and Win friends',
    ],
  },
  {
    version: '1.128.17',
    date: '2026-10-24',
    changes: [
      'The brain’s zones and the emotion worlds in Stats widen to more columns at the same screen width as the app’s other grids',
    ],
  },
  {
    version: '1.128.16',
    date: '2026-10-24',
    changes: [
      'Removing a person says “Remove person” and “removed”, like removing a book, a song or a repo',
    ],
  },
  {
    version: '1.128.15',
    date: '2026-10-24',
    changes: [
      'The public status page’s card titles and the small badges use the same uppercase label style as the rest of the app',
    ],
  },
  {
    version: '1.128.14',
    date: '2026-10-23',
    changes: [
      'The song of the day’s Change, Shuffle and Open buttons and the status preview’s people, place and weather marks use the standard icon sizes',
    ],
  },
  {
    version: '1.128.13',
    date: '2026-10-23',
    changes: [
      'An empty shelf or record collection offers “Add” as the main button, like an empty People or Journal does',
    ],
  },
  {
    version: '1.128.12',
    date: '2026-10-23',
    changes: [
      'In Mind traps, Laws of power and Win friends, the icons beside section labels and links match the size of their text',
    ],
  },
  {
    version: '1.128.11',
    date: '2026-10-23',
    changes: [
      'A picture’s toolbar in a note and the hide-keyboard button use the same icon size as the rest of the note’s toolbar',
    ],
  },
  {
    version: '1.128.10',
    date: '2026-10-23',
    changes: [
      'GitHub no longer drops you when it ends a login: opening Repos or Settings logs you in again by itself, a quick hop to GitHub and back with nothing to click',
      'A GitHub login that GitHub refused is kept, so it works again by itself if GitHub was wrong, or as soon as you log in on another device',
      'Logging in to GitHub from Repos brings you back to Repos',
    ],
  },
  {
    version: '1.128.9',
    date: '2026-10-23',
    changes: [
      'Chips, status pills and the note’s focus button have the same inner spacing as small buttons',
    ],
  },
  {
    version: '1.128.8',
    date: '2026-10-23',
    changes: [
      '“Try again” looks the same everywhere: a shared note or status page that fails to load, and the app’s start-up error, now show a proper button with the refresh icon',
    ],
  },
  {
    version: '1.128.7',
    date: '2026-10-23',
    changes: [
      'The Twitch live dot and the photo viewer’s icons take their colours from the app’s shared palette (they look the same)',
    ],
  },
  {
    version: '1.128.6',
    date: '2026-10-23',
    changes: [
      'Icons in chips are one size everywhere, including the sort, filter and export ticks',
    ],
  },
  {
    version: '1.128.5',
    date: '2026-10-23',
    changes: [
      'The move, hide and remove buttons in the wheel, widget and Twitch channel editors use the same icon size as other small buttons',
    ],
  },
  {
    version: '1.128.4',
    date: '2026-10-23',
    changes: [
      'On a tablet, Mind traps, Laws of power and Win friends show their lists in two columns, like their quiz options',
    ],
  },
  {
    version: '1.128.3',
    date: '2026-10-23',
    changes: [
      'Big numbers and titles share one display size: stat tiles, book and person titles, and the countdown, which now matches its public page',
    ],
  },
  {
    version: '1.128.2',
    date: '2026-10-23',
    changes: [
      'The sliding tab pill in Stats, Media, Streamer stats, Win friends and Laws of power has the same shadow as other selected tabs, and reads better in dark mode',
    ],
  },
  {
    version: '1.128.1',
    date: '2026-10-23',
    changes: [
      'GitHub repos, READMEs and commits load with a quiet line instead of a spinner, and quick loads don’t flash it',
    ],
  },
  {
    version: '1.128.0',
    date: '2026-10-23',
    changes: [
      'Media is redesigned: what’s on now comes first, then your whole collection as a list instead of one big grid',
      'Music: today’s song, then rows you swipe through for On repeat, Most picked (with each one’s place) and music waiting in your notes',
      'Tap a record in “In your notes” to keep it; Ranking opens the full Most picked numbers',
      'Books: what you’re reading with how far in you are, Want to read as a row of covers, and the books you’ve read as spines on one shelf you swipe along',
      'All music and All books are lists grouped by the month you added them (or where each book is), by letter for A–Z, or by stars for Top rated',
      '“See all” on a row filters the list to just those',
      'On a computer, what’s on now sits in a column at the right of the list',
      'Empty Music and Books show a small drawing, and the list shows quiet placeholder rows while it loads',
    ],
  },
  {
    version: '1.127.2',
    date: '2026-10-23',
    changes: [
      'Icons in small buttons are one size everywhere, including Open, Write and Play in the mention cards',
    ],
  },
  {
    version: '1.127.1',
    date: '2026-10-23',
    changes: [
      '“Loading…” in Twitch, Streamer stats and Public notes only shows when loading takes a moment, so quick loads don’t flash it',
    ],
  },
  {
    version: '1.127.0',
    date: '2026-10-23',
    changes: [
      'The reminders bar knows a lot more: a birthday or anniversary today or tomorrow, how you slept in the morning, a check-in run to keep in the evening, and days without writing',
      'It notices a heavy few hours, a day lighter than yesterday, and sums up your week on Sunday evening',
      'It mentions someone you haven’t written about in weeks, or things that have felt heavier with someone lately',
      'Music: your song on this day years ago, and a song on repeat that has no feelings yet',
      'Books: one you haven’t touched in a while, one with fewer than 50 pages left, and one finished without a rating',
      'The countdown’s last day, and a nudge to write about it once it’s over',
      'Twitch: each live channel on its own line, a points milestone, your best day of the month, and a warning when the miner goes quiet',
      'Setup: Spotify or GitHub not connected, no home set for the weather, sync failing, and no backup in two months',
      'A law, principle or mind trap to read each day',
      'Put any line away with ×: until tomorrow, or longer for ones that would only come back the same',
      'The bar shows four lines at first, with the rest a tap away',
    ],
  },
  {
    version: '1.126.1',
    date: '2026-10-23',
    changes: [
      'The reminders bar no longer counts the hours to your next check-in: it only says you haven’t checked in in a while, once it’s been six hours',
    ],
  },
  {
    version: '1.126.0',
    date: '2026-10-23',
    changes: [
      'The reminders bar only lists what’s still to do: once today’s song is picked, its line goes away',
      'The “How are you feeling?” card under the date is gone; the bar’s check-in line takes you to check in',
    ],
  },
  {
    version: '1.125.0',
    date: '2026-10-23',
    changes: [
      'The reminders bar tells you when the app has updated, and a tap opens what’s new',
      'Picking today’s song reminds you of the run of days you’d keep going',
      'In the evening, the bar nudges you to write about the day if you haven’t yet',
      'When a Twitch channel the miner watches is live, the bar says so, with today’s channel points',
      'Lines that need you come first in the bar; its breathing dot is lighter on the battery',
    ],
  },
  {
    version: '1.124.1',
    date: '2026-10-23',
    changes: [
      'The line under a note’s title ends in a small arrow, so it’s clear a tap opens its feelings, people, date and cover',
    ],
  },
  {
    version: '1.124.0',
    date: '2026-10-23',
    changes: [
      'A reminders bar under the date: today’s song (or a nudge to pick one) and your next check-in, every couple of hours while you’re up',
      'A ring round your last feeling fills as the next check-in nears; once it’s due, the line glows with a breathing dot until you check in',
      'Hide or move the bar like any other card, from Edit the feed',
    ],
  },
  {
    version: '1.123.0',
    date: '2026-10-23',
    changes: [
      'On a computer, the sidebar now lists every place on the wheel, grouped and ordered the way you arranged it: Map, Your brain, Mind traps, Laws of power, Win friends, Channel points, Streamer stats, Public status and Countdown are one click away',
      'The sidebar lights up the page you’re on, instead of Stats for everything under Insights, Learn and Extras',
      'A person, a book, a song or a repo no longer opens with a big empty gap at the top on a computer',
      'Laws of power, Win friends, Channel points and Streamer stats lay their cards out in two columns on a computer, like Stats, so the board and maps aren’t screen-tall',
      'Stats on a computer: the mood and check-in skies, Pleasant vs unpleasant and Emotion mix run across both columns, also when shown as a table, and tiles fill their row',
      'The brain stays a comfortable size on a wide screen; Countdown, Public status and Your brain don’t stretch across it',
      'A shared note or public status no longer sits off to the right on a computer',
    ],
  },
  {
    version: '1.122.2',
    date: '2026-10-23',
    changes: [
      'Mood over time: every sprite sits in the middle of its own cloud; on longer ranges a few days share one cloud and sprite instead of leaving clouds without one',
    ],
  },
  {
    version: '1.122.1',
    date: '2026-10-23',
    changes: [
      'Each cloud in Mood over time and When you check in shows the sprite of the world you felt most',
      'Mood over time has its old proportions again: even-sized clouds, the same height as before, and the first and last day no longer cut off at the edges',
    ],
  },
  {
    version: '1.122.0',
    date: '2026-10-23',
    changes: [
      'New in Extras: Streamer stats. Pick one of your mined channels or type any Twitch channel',
      'See every game they played and for how long, with covers, share of the time and number of streams',
      'Hours streamed each day, coloured by game, and when they’re usually live, hour by hour in your time',
      'Average and longest stream, days live, and the time they usually go live',
      'Audience from TwitchTracker: average and peak viewers, hours watched and rank over 30 days',
      'Every stream listed with its games as a strip; tap one for its games hour by hour and a link to the VOD',
      'The server checks your mined channels every 5 minutes, so viewer numbers, followers and old streams build up past Twitch’s 60 days',
    ],
  },
  {
    version: '1.121.0',
    date: '2026-10-23',
    changes: [
      'Stats is redesigned again, closer to the journal and your records',
      'Mood over time is drawn as a sky: each day is a cloud at the height of your mood, in the colour and letters of the world you felt most, with the 7-day average as a line through them',
      'When you check in is a sky too: clouds bank up at the times you tend to write, in the colour of what you felt then',
      'Your average mood, entries and active days sit on the sky as tiles, like on your records',
      'Emotions opens with your brain, lit by the range you picked; tap a part to read about it',
      'Worlds and top feelings are ranked rows with coloured bars',
      'The letters inside bars, the small clouds by every title and the strip of days are gone, so the charts are clean again',
      'Intensity bars stay inside their card',
    ],
  },
  {
    version: '1.120.1',
    date: '2026-10-23',
    changes: [
      'Icons in buttons are one size everywhere: Copy, Share, Download, Remove and the rest now match',
    ],
  },
  {
    version: '1.120.0',
    date: '2026-10-23',
    changes: [
      'Stats has a new look, closer to the journal: a weather report of your mind',
      'Your average mood sits on the sky in large type, with a little cloud of the world you felt most',
      'A forecast strip under it shows each day of the range as a column of weather in its world’s letters',
      'Every part of Stats is laid out like a journal day, with its world’s sprite, a small cloud, a coloured ribbon and a soft glow behind',
      'Figures scramble into place and meters are written in letters',
      'Charts, bars, the calendar and the check-in heatmap are drawn in each world’s letters',
      'Emotions opens with your brain, lit by the range you picked; tap a part to read about it',
      'The Weather tab shows each kind of sky as real ASCII weather: sun, rain, storms and drifting clouds',
      'In the Dex, missing feelings are faint letters and found ones scramble in',
      '“What stands out” reads like a note',
      'The glows on Stats and Channel points no longer pulse forever',
    ],
  },
  {
    version: '1.119.4',
    date: '2026-10-23',
    changes: [
      'The tab icons in Media, Friends and Laws of power are the same size as other icons next to text',
    ],
  },
  {
    version: '1.119.3',
    date: '2026-10-23',
    changes: [
      'Book, person, repo and song pages no longer gain extra space at the bottom on a phone after you’ve opened a note',
      'The countdown’s share error shows in red even before you’ve visited Settings',
      'The Public status chip on Tracker looks right even before you’ve visited Settings',
      'Charts and the emotion bar on Stats no longer borrow styles meant for other parts of the app',
    ],
  },
  {
    version: '1.119.2',
    date: '2026-10-23',
    changes: [
      'Fixed the menu wheel opening as a dark box stuck in the top corner',
    ],
  },
  {
    version: '1.119.1',
    date: '2026-10-23',
    changes: [
      'The opening is faster: about 1.8 seconds from the first letters to your journal, down from 2.7',
    ],
  },
  {
    version: '1.119.0',
    date: '2026-10-23',
    changes: [
      'A new opening when you open the app: just the brain, on a dark screen',
      'A ring of letters closes in and pulls together into the brain, which spins into place as a wave of colour runs through it',
      'Then you fly straight into it, the letters streaking past, and your journal opens from the middle',
      'Tap or press any key to hurry it along',
      'The sign-in page with the brain hasn’t changed',
    ],
  },
  {
    version: '1.118.2',
    date: '2026-10-23',
    changes: [
      'On a phone, squares in Friends and Laws of power and rows in the wheel editor no longer stay highlighted after you tap them',
    ],
  },
  {
    version: '1.118.1',
    date: '2026-10-23',
    changes: [
      'A fuller design guide and an hourly consistency check, so screens keep looking like they belong together',
    ],
  },
  {
    version: '1.118.0',
    date: '2026-10-22',
    changes: [
      'The intro now plays when you open the app, then goes into your journal by itself',
      'Touch the brain while it plays and it stays, so you can spin it and go in with Enter',
      'The intro is quicker: the brain flies together faster and the dive into the app is shorter',
    ],
  },
  {
    version: '1.117.1',
    date: '2026-10-22',
    changes: [
      'The Global Ops port page is gone from Insights, now that the port has been deleted',
    ],
  },
  {
    version: '1.117.0',
    date: '2026-10-22',
    changes: [
      'Export as text now opens a sheet where you choose what goes in before you export',
      'Pick the days: all time, the last 7, 30 or 90 days, a year, or your own from–to dates',
      'Turn notes, check-ins, people, books, music and repos on or off, and choose what each entry shows: feelings, people, place, weather, music, picture captions',
      'With a range picked, people, books and music can be limited to the ones tied to those days',
      'A new overview adds up your feelings, mood, people and places, with a line per day, week or month',
      'Optionally opens with a request for the AI to look for patterns and changes',
      'Copy it straight into an AI chat, or download it; the sheet shows how long it is and remembers your choices',
    ],
  },
  {
    version: '1.116.1',
    date: '2026-10-22',
    changes: [
      'The original pixel emotion icons are back, replacing the sticker characters with faces',
    ],
  },
  {
    version: '1.116.0',
    date: '2026-10-21',
    changes: [
      'The Global Ops port page is back under Insights, with the plan to bring the game to the browser',
      'Each phase lists its steps and its go/no-go checkpoint',
      'New cards: the testing rules, how others port games to the browser, what we know so far and the sources',
      'Open the full plan shows the whole plan as text',
    ],
  },
  {
    version: '1.115.2',
    date: '2026-10-21',
    changes: [
      'The Global Ops port page is gone from Insights, now that the port has stopped',
    ],
  },
  {
    version: '1.115.1',
    date: '2026-10-21',
    changes: [
      'Emotion characters are bigger everywhere: the wheel, the world picker, chips, the journal and stats',
      'Their faces are bolder and simpler, so each expression reads at a glance',
      'The white outline around the characters is gone',
    ],
  },
  {
    version: '1.115.0',
    date: '2026-10-21',
    changes: [
      'New emotion characters: each world is now a little sticker with a face instead of a pixel sprite',
      'The heart smiles, the star grins, the leaf dozes, the spark looks on, the ghost frets, the cloud cries, the flame glowers and the face blushes and looks away',
      'Their idle loops are smoother: the heart beats, the star hops, the leaf sways, rain falls and the flame flickers',
    ],
  },
  {
    version: '1.114.0',
    date: '2026-10-21',
    changes: [
      'Public status: a new Recent trail switch, off by default, shows your recent check-ins as coloured dots',
      'The trail reads as the last 7 days (each day’s strongest feeling) or your last 5 check-ins, your choice',
      'Only the feeling, how strong it was and when go into the trail: no notes, people or places',
    ],
  },
  {
    version: '1.113.1',
    date: '2026-10-21',
    changes: [
      'Global Ops port: a Shortcuts tile counts the known limits left in the port’s code to revisit',
    ],
  },
  {
    version: '1.113.0',
    date: '2026-10-21',
    changes: [
      'New page: Global Ops port, on the wheel under Insights, with the game port’s phase, checkpoints, builds, screenshots and log',
    ],
  },
  {
    version: '1.112.23',
    date: '2026-10-20',
    changes: [
      'Mind traps: answers and related-trap chips that wrap to two lines are spaced like the ones in Laws of power and Friends',
      'The journal prompt card presses in by the same amount as other cards',
    ],
  },
  {
    version: '1.112.22',
    date: '2026-10-20',
    changes: [
      'The emotion wheel’s level label and a note’s date line are spaced like the app’s other small capital labels',
    ],
  },
  {
    version: '1.112.21',
    date: '2026-10-20',
    changes: [
      'Segmented controls, status pills, the note icon picker, the ribbon tabs, the wheel editor’s buttons and the desktop New button take their height from the app’s shared button sizes',
    ],
  },
  {
    version: '1.112.20',
    date: '2026-10-20',
    changes: [
      'Map labels, the countdown badge and the status bars take their sizes, corners and colours from the app’s shared styles, so they stay in step with the rest of the app',
    ],
  },
  {
    version: '1.112.19',
    date: '2026-10-20',
    changes: [
      'A journal day’s mood line shines or sways twice when it appears, then rests, and plays again when you hover it',
    ],
  },
  {
    version: '1.112.18',
    date: '2026-10-20',
    changes: [
      'The app’s two typefaces start downloading with the page, so text shows in them sooner, with less of a jump as they swap in',
      'The welcome screen says your journal stays in your browser unless you share it, rather than “everything”',
    ],
  },
  {
    version: '1.112.17',
    date: '2026-10-20',
    changes: [
      'Laws of power: the Princeton drinking study is described as it measured, by averages, not as what “most” or “each” student said',
    ],
  },
  {
    version: '1.112.16',
    date: '2026-10-20',
    changes: [
      'Mind traps: the base-rate answer says almost half the Harvard doctors said 95%, not most; fewer than one in five got it right',
      'Mind traps: E and 4 is the most common pick in the card puzzle, not a majority one',
      'Mind traps: the ski-trip answer no longer puts pounds into a study that used dollars',
    ],
  },
  {
    version: '1.112.15',
    date: '2026-10-20',
    changes: [
      'If the synced copy is ever damaged, Settings says so plainly and that your journal on this device is unchanged, instead of a cryptic or blank error',
      'The channel list’s server error is in Romanian when the app is',
    ],
  },
  {
    version: '1.112.14',
    date: '2026-10-20',
    changes: [
      'Sharing, your public status, the countdown and signing in give up after 15 seconds on a stalled connection and say so, instead of spinning',
      'A shared note or status page shows its error after 15 seconds on a stalled connection, instead of loading forever for whoever opened it',
    ],
  },
  {
    version: '1.112.13',
    date: '2026-10-20',
    changes: [
      'Channel points stop waiting after 15 seconds on a stalled connection and offer Try again, instead of freezing until you reload',
      'Channel points’ error messages are in Romanian when the app is',
    ],
  },
  {
    version: '1.112.12',
    date: '2026-10-20',
    changes: [
      'Spotify and GitHub give up after 20 seconds on a stalled connection and say so, instead of loading forever',
    ],
  },
  {
    version: '1.112.11',
    date: '2026-10-20',
    changes: [
      'Brain: the nucleus accumbens is described as the research has it: dopamine drives wanting more than enjoying',
      'Brain: the amygdala errs on the side of caution because a false alarm costs less than a missed threat, not “on purpose”',
    ],
  },
  {
    version: '1.112.10',
    date: '2026-10-19',
    changes: [
      'If Undo can’t bring something back, it tells you, instead of quietly closing as if it had worked',
    ],
  },
  {
    version: '1.112.9',
    date: '2026-10-19',
    changes: [
      'Mind traps: the closing note no longer says knowing about biases never helps; practice with feedback has reduced some for months',
    ],
  },
  {
    version: '1.112.8',
    date: '2026-10-19',
    changes: [
      'Brain: the late-night insight says what the sleep study measured, a night without sleep, not just a late hour',
      'Brain: the habit insight gives the 66 days as a median, with the real range of 18 to 254',
    ],
  },
  {
    version: '1.112.7',
    date: '2026-10-19',
    changes: [
      'In dark mode the phone’s status bar is dark from the first moment, instead of flashing light while the app loads',
    ],
  },
  {
    version: '1.112.6',
    date: '2026-10-19',
    changes: [
      'Laws of power: “Make other people come to you” has its own study, on how forceful bans provoke the thing they forbid',
      'Laws of power: “Never reform too much at once” has its own study, on why a pay cut feels unfair but a below-inflation raise doesn’t',
    ],
  },
  {
    version: '1.112.5',
    date: '2026-10-19',
    changes: [
      'Laws of power: “Pose as a friend, work as a spy” has its own study, on how confiding in someone makes you like them',
      'Laws of power: “Never appear too perfect” has its own study, on groups wanting to expel members who are too generous',
    ],
  },
  {
    version: '1.112.4',
    date: '2026-10-19',
    changes: [
      'Mind traps: the V-1 bombs fell on London in 1944, not during the Blitz',
      'Mind traps: Svenson’s 93% is drivers rating their skill above the median; for safety it was 88%',
    ],
  },
  {
    version: '1.112.3',
    date: '2026-10-19',
    changes: [
      'Win friends: “Talk in terms of the other person’s interests” has its own study, on similarity and liking, instead of repeating the questions study from principle 15',
    ],
  },
  {
    version: '1.112.2',
    date: '2026-10-19',
    changes: [
      'Win friends: “Arouse an eager want” has its own study, on arguing from the other side’s values, instead of repeating the negotiation study from principle 17',
    ],
  },
  {
    version: '1.112.1',
    date: '2026-10-19',
    changes: [
      'Win friends: the stock-price study under “If you are wrong, admit it” now says what the researchers actually found',
    ],
  },
  {
    version: '1.112.0',
    date: '2026-10-19',
    changes: [
      'Mind traps, Laws of power and Win friends now read fully in Romanian: every title, story, study, psychology note, practice tip and quiz question',
      'The Romanian text only loads when the app is set to Română, so English stays as light as before',
    ],
  },
  {
    version: '1.111.0',
    date: '2026-10-19',
    changes: [
      'New in Learn: Win friends, Dale Carnegie’s 30 principles from How to Win Friends and Influence People',
      'Each principle opens to the story behind it, the psychology, a real study, the mind traps it disarms and the laws of power it answers',
      'Every principle has its own hand-drawn mark, plus a ladder of all 30, a where-to-start map, a principle of the day and a name-the-principle game',
      'Mark principles you’re practising and count each time you try one',
      'Mind traps and Laws of power show the principles that answer them',
      'Link a principle in a note with [[, or from Insert › Win friends',
    ],
  },
  {
    version: '1.110.0',
    date: '2026-10-19',
    changes: [
      'The app fades in gently when it opens, with the sidebar and + button settling in alongside the page',
      'Pictures, covers and album art fade in smoothly as they load instead of popping in',
      'Cards and rows drift softly into place as you scroll down to them',
      'Search results, Spotify, GitHub and channel points fade in as they arrive instead of popping in',
      'A note’s place and weather fade in when they’re found after you save',
    ],
  },
  {
    version: '1.109.0',
    date: '2026-10-19',
    changes: [
      'Every mind trap and law of power has its own drawing: black brush lines and ivory paper on a tile in its colour',
      'The drawings replace the inkblots on Mind traps and the wax seals on Laws of power',
    ],
  },
  {
    version: '1.108.0',
    date: '2026-10-19',
    changes: [
      'A note opens with its words and pictures already in place: nothing jumps down a moment later',
      'Closing ** or * around words that hold a link or code keeps them, and an escaped \\* never turns into a style',
      'Backspace and Delete next to a code block no longer run lines into it, and a second Backspace after a quote joins the line above',
      'Enter at the start of a code block or callout that opens the note makes a line above it',
      'Bold and the other styles carry on to the next line after Enter, and the ribbon lights a style exactly when pressing it would take it off',
      'Ctrl+B, I, E and K work on Cyrillic, Greek and other keyboards',
      'Writing at the end of a note that ends with a divider starts a new line instead of selecting the divider',
      'Tapping a tag while writing opens its card and keeps the caret after it, so the next key can’t replace it',
      'A swipe that starts on a task’s circle scrolls the note instead of ticking the task',
      'Pasting from Word or Excel pastes the text, not a picture of it',
      'Typing a #tag no longer makes the line jump, highlighting no longer moves the words, and tags sit level with the text',
      'On a phone, the toolbar waits for the keyboard and rises once, and the line you’re writing stays above it',
      'The @ suggestions narrow as you type on Android instead of disappearing until the word ends',
      'Switching between reading and writing moves nothing, and Edit puts the caret where you’re reading, not at the end',
      'Closing a sheet no longer takes the caret out of the note, and the Link sheet opens on its address',
      'The status bar only says “Saving…” when saving takes a moment, and never gets stuck on it',
      'The picture size slider resizes the picture as you drag, and dragging pictures is smoother',
      'Ribbon buttons press and spring back, the style gallery shows the note’s own heading styles, and Word blue is one colour everywhere',
      'Pictures dropped on the ribbon or status bar go into the note instead of opening in the browser',
    ],
  },
  {
    version: '1.107.1',
    date: '2026-10-19',
    changes: [
      'The note’s Insert tab has a new Learn group: Mind trap and Law of power, each opening the full list to search and pick from',
    ],
  },
  {
    version: '1.107.0',
    date: '2026-10-19',
    changes: [
      'Link a mind trap or a law of power in a note: type [[ and its name (or “law 12”)',
      'They show as chips in the note: tap one for its one-line summary and a way to open it',
    ],
  },
  {
    version: '1.106.1',
    date: '2026-10-18',
    changes: [
      'Mind traps and Laws of power move to Learn on wheels you arranged yourself too, and Repos, Channel points, Public status and Countdown to Extras',
      'Anything you moved somewhere else yourself stays where you put it',
    ],
  },
  {
    version: '1.106.0',
    date: '2026-10-18',
    changes: [
      'The wheel is reorganized: Insights now holds only Stats, Map and Your brain',
      'New Learn slice on the wheel: Mind traps and Laws of power',
      'New Extras slice on the wheel: Repos, Channel points, Public status and Countdown',
      'A wheel you arranged yourself stays as you left it',
    ],
  },
  {
    version: '1.105.0',
    date: '2026-10-18',
    changes: [
      'Mind traps: redesigned to match the other Insights pages, with the sky header, cards and tiles',
      'Mind traps: tiles for the traps, biases named so far and how often you’ve caught yourself',
      'Mind traps: filter by family and read what it covers, right above the list',
      'Mind traps: a calmer opened trap, in the app’s usual type and cards',
    ],
  },
  {
    version: '1.104.0',
    date: '2026-10-18',
    changes: [
      'Laws of power: redesigned to match the other Insights pages, with the sky header, cards and tiles',
      'Laws of power: read as the player or the target from the tabs at the top',
      'Laws of power: tiles for the laws, levers, mind traps and how often you’ve seen them played on you',
      'Laws of power: filter by arena and read what it covers, right above the list',
      'Laws of power: a calmer opened law, in the app’s usual type and cards',
    ],
  },
  {
    version: '1.103.0',
    date: '2026-10-18',
    changes: [
      'New page: the 48 Laws of Power, on the wheel under Insights',
      'Every law in depth: the history it came from, the psychology behind it, the levers it pulls and a real experiment',
      'Each law links to the Mind traps it springs, and shows the signs it’s being played on you and how to answer',
      'A chessboard of all 48, a shadow map of how dark and how common each one is, and a law of the day',
      'Name the move: a game where you spot which law is being played',
      'Read as the player or as the target, and keep count of laws played on you or by you',
      'Mind traps: a link can now open a trap straight away',
    ],
  },
  {
    version: '1.102.0',
    date: '2026-10-18',
    changes: [
      'Countdown: change its name, start and end on its page, or remove it',
      'Countdown: add a new one when there isn’t one',
      'Countdown: now under Insights on the wheel',
      'Countdown: its button next to the wheel goes away as soon as it ends',
      'Countdown: the same dates on every device, and on the public status page',
    ],
  },
  {
    version: '1.101.3',
    date: '2026-10-18',
    changes: [
      'Public status settings: the + button no longer covers Open the page and Stop sharing at the bottom',
    ],
  },
  {
    version: '1.101.2',
    date: '2026-10-18',
    changes: [
      'Public status: the ASCII sky behind the page actually shows now (the page’s background was covering it)',
    ],
  },
  {
    version: '1.101.1',
    date: '2026-10-18',
    changes: [
      'Public status: the journal’s drifting ASCII sky now fills the whole page behind your check-in, in your feeling’s colour and letters',
      'Public status: the small weather cloud over the feeling is gone again',
    ],
  },
  {
    version: '1.101.0',
    date: '2026-10-18',
    changes: [
      'Public status: a page of its own, on the wheel under Insights',
      'Public status: its switches (note, people, place, weather, countdown), your name, the language and the link all live there now, instead of in a pop-up',
      'Settings: the Public status section moved to that page',
      'Check-in: the Share status chip opens the new page',
    ],
  },
  {
    version: '1.100.0',
    date: '2026-10-18',
    changes: [
      'Public status: the journal’s little ASCII cloud now floats over your feeling, in its colour and letters',
      'Public status: it rains for sadness, storms for anger (the feeling’s name flashes with the lightning), shines for joy, and drifts for the rest',
      'Public status: tap the cloud for a downpour, a strike or a burst of sun',
    ],
  },
  {
    version: '1.99.0',
    date: '2026-10-18',
    changes: [
      'Public status: choose the page’s language (English or Română) when you share your check-in',
      'Public status: the page opens in that language for everyone who has the link, whatever their phone uses',
      'Public status: its link preview’s title and description follow the language too',
    ],
  },
  {
    version: '1.98.0',
    date: '2026-10-18',
    changes: [
      'Public status: a new “Countdown” switch shows the timer to 30 October, 07:00 on your public page, ticking live',
      'Public status: it’s off until you turn it on, and like the timer itself it goes away by itself on 1 November',
    ],
  },
  {
    version: '1.97.0',
    date: '2026-10-18',
    changes: [
      'Countdown: a new button next to the wheel opens a timer from 17 October, 07:00 to 30 October, 07:00',
      'Countdown: the days, hours, minutes and seconds left, ticking live, with a ring and a bar that fill as the time goes',
      'Countdown: when it started, how much has gone by and when it ends, in the same cards as Stats',
      'Countdown: the button shows the days left, and the button and the page go away by themselves on 1 November',
    ],
  },
  {
    version: '1.96.0',
    date: '2026-10-17',
    changes: [
      'Public status: a new look made for phones: the feeling big in its own colour, how strong it is, what the word means, and how long ago it was',
      'Public status: also show the people you were thinking of, the place and the weather, each with its own switch (all off until you turn them on)',
      'Public status: add your name, so family and friends see whose status it is (“Ana is feeling…”)',
      'Public status: “Open the page” to see it as others do',
    ],
  },
  {
    version: '1.95.0',
    date: '2026-10-17',
    changes: [
      'Public status: share a link that always shows your latest check-in (the feeling, how strong it is and when), for anyone, no sign-in needed',
      'Public status: it updates by itself each time you check in, and the page refreshes every minute while it’s open',
      'Public status: choose whether the check-in’s note shows, and stop sharing at any time (sharing again makes a new link)',
      'Turn it on from Check in (the globe next to Today) or Settings → Public status',
    ],
  },
  {
    version: '1.94.2',
    date: '2026-10-17',
    changes: [
      'GitHub: a login is only ended once GitHub confirms its token is really gone, so a stray refusal no longer logs you out',
      'GitHub: a login in use is kept fresh, so it never runs out on a device you keep using',
      'Spotify & GitHub: a moment the server can’t be reached (an update, a phone waking up) shows as “still logged in”, not as logged out',
      'Spotify & GitHub: with no connection, the app waits a few seconds for it to come back before giving up, then checks your logins again once it’s back',
      'Repos: GitHub being slow to list your repos shows “Try again” instead of asking you to log in',
    ],
  },
  {
    version: '1.94.1',
    date: '2026-10-17',
    changes: [
      'Notes: long notes stay quick while you type: only the lines you change are checked and saved again, not the whole note',
      'Notes: typing no longer redraws the whole page on every key',
      'Notes: a note that couldn’t be saved is tried again by itself a few times, a little later each time',
      'Notes: your last words are saved when the tab is closed or the page goes away, on Safari too',
      'Notes: photos added while you switch between reading and writing land in the right place',
      'Notes: Undo after deleting a note or removing a picture says so when it can’t be saved',
    ],
  },
  {
    version: '1.94.0',
    date: '2026-10-16',
    changes: ['The Docs page (PDFs and help files, searchable page by page) is gone, from the sidebar, the wheel and the server'],
  },
  {
    version: '1.93.1',
    date: '2026-10-16',
    changes: ['Books and picture search: a search that gets no answer stops after 15 seconds with a message, instead of spinning forever'],
  },
  {
    version: '1.93.0',
    date: '2026-10-16',
    changes: [
      'Notes: a new editor underneath, the one many professional editors are built on: bold, headings and lists are real formatting while you write, never hidden marks',
      'Notes: tags for people, books, songs and other notes show as chips while writing too, not just when reading',
      'Notes: reading and writing are the same page: tap a word while reading and the cursor lands right there',
      'Notes: undo and redo cover everything you do in the note, including the ribbon’s commands and pictures',
      'Notes: pasting from Word, Google Docs or a web page keeps headings, bold, lists and checklists',
      'Notes: Insert → Link (or Ctrl+K) opens a small sheet for the words and the address, and can remove a link',
      'Notes: a photo cut from a note comes back with it when you undo or paste it back',
      'Notes: typing **bold**, *italic*, `code`, a web address or an @[name] turns into what it writes as you finish it',
    ],
  },
  {
    version: '1.92.0',
    date: '2026-10-16',
    changes: [
      'Notes: formatting marks (**, #, >, links’ addresses…) never show while writing, not even on the line you’re on — bold just looks bold, as in Word',
      'Notes: the cursor skips over the hidden marks, and clicking at the start of a heading puts it before the heading’s words',
      'Notes: Backspace and Delete remove the letter you see, never a hidden mark',
      'Notes: dividers always show as a line',
    ],
  },
  {
    version: '1.91.1',
    date: '2026-10-16',
    changes: [
      'One code font everywhere: code, branch names, stamps and the library card now share the same monospace face',
      'Dropdowns (day and month pickers) use the app’s font instead of the system one',
      'Bold text in notes and the style picker uses the same bold weight as the rest of the app',
    ],
  },
  {
    version: '1.91.0',
    date: '2026-10-15',
    changes: [
      'Faster, calmer pages: moving between screens takes about a fifth of a second, and sections appear almost at once instead of one by one',
      'The wheel button at the top of each page plays its animation when a page opens, then rests; it comes alive again when you point at it',
      'Smoother scrolling on phones: cards on the sky (search, stats, song of the day, media) are solid instead of blurred',
      'The Traps map’s spiral, the docs loading shimmer and other decorations no longer move forever',
      'One consistent look across the app: the same text sizes, weights, corners, shadows and timing everywhere',
      'A little less to download before the first screen appears',
    ],
  },
  {
    version: '1.90.1',
    date: '2026-10-15',
    changes: [
      'Sync: a request that stalls on a bad connection now gives up after a while, so syncing carries on instead of staying stuck until the app is reopened',
    ],
  },
  {
    version: '1.90.0',
    date: '2026-10-15',
    changes: [
      'Notes: a full redesign after Microsoft Word: a ribbon with Home, Insert and View tabs replaces the little toolbar',
      'Notes: Home has Undo and Redo, the font styles (bold, italic, strike, highlight, code, clear formatting), lists, indents and quote, and a styles gallery: Normal, Heading 1–3 and Quote',
      'Notes: Insert has pictures, online pictures, music, a book, a mention, a note link, a link, a divider, a callout and a code block',
      'Notes: View switches between Edit and Read mode, opens Focus, zooms the page, and changes the note’s icon or details',
      'Notes: selecting a picture brings up a Picture tab with its wrapping, size, arrangement and remove tools',
      'Notes: on a computer the note is a page on a grey desk, with the title bar and ribbon above it; Ctrl+F1 folds the ribbon to its tabs',
      'Notes: a status bar along the bottom shows words, characters, reading time and whether the note is saved, with view buttons and a zoom slider',
      'Notes: Focus hides everything but the page; Esc or Exit Focus brings it all back',
      'Notes: Word’s shortcuts work in the text: Ctrl/⌘+B, I, K, Ctrl+Alt+1/2/3 for headings, Ctrl+Alt+0 for Normal, Ctrl+Shift+L, 7 and 9 for lists, and more (shown in each button’s tooltip)',
      'Notes: a new Title style, a tidier details line under it, Word-blue headings, a yellow highlighter, and quotes behind a blue rule, the same while writing and reading',
      'Notes: on a phone the ribbon docks above the keyboard, with a tab button to switch between Home, Insert and View',
    ],
  },
  {
    version: '1.89.0',
    date: '2026-10-15',
    changes: [
      'Records and Books: a cleaner page — the title carries one line of numbers (records, tapes, average rating) instead of number boxes, and the tabs and search sit side by side on a wide screen',
      'Records: the song of the day comes right under the search with its last two weeks, and nothing else gets between it and your records',
      'Records: Most picked is now a small tile that opens the full ranking in a sheet, with its four numbers and the top ten',
      'Records: music from your notes that isn’t kept yet is a tile too: tap it for a list with a Keep button, instead of a strip at the very bottom',
      'Records: On repeat is a filter beside Songs, Albums and the rest, instead of its own strip above the records',
      'Records and Books: filters only show when there is something to choose between (no more “All” beside “Songs” with the same count), and the order sits at the right of the row',
      'The streak flame on the song of the day shows your best run when you hover it',
    ],
  },
  {
    version: '1.88.0',
    date: '2026-10-15',
    changes: [
      'Notes: the line you’re writing on shows its formatting marks (#, **, > …) softly, the way Obsidian does, and the other lines stay clean — no more stray * or # popping up',
      'Notes: the caret no longer disappears after a heading, a bullet, a task or bold words',
      'Notes: Undo and Redo work properly — Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y or your phone’s undo — a word or a command at a time',
      'Notes: Enter carries numbered lists on and counts the items after again; Enter on an empty item ends the list',
      'Notes: Backspace at the start of a heading, list item or quote turns it into plain text first, then joins it to the line above',
      'Notes: Tab never takes you out of the note; outside lists it types a tab',
      'Notes: type "[] " at the start of a line for a checklist item; Backspace right after gives back what you typed',
      'Notes: Bold, Italic, Strike and Highlight with nothing selected work like Word: they style the word you’re in, or let you type styled words, and tapping again at the end steps back out',
      'Notes: the Link button links the word you’re in, and an empty link you don’t fill in is tidied away',
      'Notes: **two** **bold** words next to each other, \\* and other escapes now read right while writing, in reading view and in previews',
      'Notes: tapping a note in reading view starts writing where you tapped',
      'Notes: adding a picture while writing keeps the caret where it was',
    ],
  },
  {
    version: '1.87.0',
    date: '2026-10-15',
    changes: [
      'Feed: customizable widgets — the check-in, On this day, Coming up, Reading now, Song of the day and Channel points cards can each be hidden, reordered and set up',
      'Feed: a new button beside Search and Calendar (and Settings → Feed widgets) opens the editor; every change shows on the feed at once, and Reset brings the original layout back',
      'Coming up: choose how far ahead to look (1 week to 3 months) and how many dates to show',
      'Reading now: show all your books or just the first few',
      'Channel points: hide the 30-day graph if you prefer just the total',
    ],
  },
  {
    version: '1.86.0',
    date: '2026-10-15',
    changes: [
      'Music: redesigned records grid — bigger discs, centred with their name and rating underneath, two across on a phone and more room on desktop',
    ],
  },
  {
    version: '1.85.2',
    date: '2026-10-15',
    changes: [
      'Music: the records grid is cleaner — just the disc with its name and rating, no boxes around them',
    ],
  },
  {
    version: '1.85.1',
    date: '2026-10-15',
    changes: [
      'Media: the search bar is always there under Music and Books — no more hunting for the search icon',
    ],
  },
  {
    version: '1.85.0',
    date: '2026-10-14',
    changes: [
      'Notes: the toolbar buttons (photos, images, Spotify music, books and the rest) work again on phones',
      'Editing the wheel: the editor now opens above your notes instead of underneath them',
      'The flickering Saving…/Saved indicator is gone from the top of editors; you still get a message if something can’t be saved',
      'Music loads much faster with big collections: records appear a page at a time as you scroll',
      'Searching and filtering your music no longer lags with lots of songs, and the song-of-the-day picker opens quickly',
      'Small records and tapes load lighter cover images, and placeholder records show while your music loads',
    ],
  },
  {
    version: '1.84.1',
    date: '2026-10-14',
    changes: [
      'Notes: Add icon (and Make public) from the More menu opens its sheet again instead of closing it straight away',
    ],
  },
  {
    version: '1.84.0',
    date: '2026-10-14',
    changes: [
      'New page: Mind traps, forty cognitive biases ranked by how hard they pull (on the wheel under Insights)',
      'Each trap has a power score from its pull, reach and harm, how solid the evidence is, the experiment that caught it, where it gets you, how to get out, and a strange-but-true fact',
      'Try a dozen of them on yourself with quick questions, starting with three that show your fast and slow minds at work',
      'A power map puts every trap in its family’s slice of a spiral, nearer the centre the harder it pulls; point at one to see what it’s related to',
      'Every trap has its own inkblot, and you can count the times you catch yourself in one',
      'Edit the wheel: the pencil on the wheel (or Settings → Navigation wheel) lets you hide places, change their order, and gather them into groups of your own',
    ],
  },
  {
    version: '1.83.0',
    date: '2026-10-14',
    changes: [
      'On phones, tapping a button no longer leaves it looking pressed or selected afterwards',
      'Removing a person, book, song or repo happens at once with Undo, like deleting a note, instead of asking first',
      'Things that can’t be undone (deleting everything, signing out, stopping sync or sharing) ask in the app’s own sheet instead of a browser pop-up',
      'The phone gives the same small tick everywhere: switches, swiping past the pin or delete point, pinning, deleting and the hold menu — now on iPhone too',
      'Animations across the app share one set of speeds, so similar things move at the same pace',
    ],
  },
  {
    version: '1.82.6',
    date: '2026-10-14',
    changes: [
      'Page slides are quicker, and tapping while a page slides in skips straight to it instead of the tap being lost',
      'Screens load in the background after the app opens, so opening one for the first time no longer waits',
      'A thin bar at the top shows when a screen is still loading',
      'Writing a note is smoother: saving no longer re-sorts the whole journal or rescans every note for links',
      'Sync waits for a longer pause in your writing before sending',
      'The journal draws its newest days first and the rest as you scroll, so long journals open and update faster',
    ],
  },
  {
    version: '1.82.5',
    date: '2026-10-14',
    changes: [
      'The date at the top of the main screen no longer breaks “Wednesday” in the middle of the word',
    ],
  },
  {
    version: '1.82.4',
    date: '2026-10-14',
    changes: [
      'The back button on a document now always takes you to the Docs page',
    ],
  },
  {
    version: '1.82.3',
    date: '2026-10-14',
    changes: [
      'Fixed cards on the stats and Twitch pages sometimes staying invisible on phones',
    ],
  },
  {
    version: '1.82.2',
    date: '2026-10-14',
    changes: [
      'Fixed missing text on some PDF pages in Docs, like the Student Guides and the CPA help PDF',
    ],
  },
  {
    version: '1.82.1',
    date: '2026-10-14',
    changes: [
      'The app no longer zooms in when you pinch or double-tap on your phone',
      'Docs, photos and the map still zoom with their own pinch and buttons',
      'Help files have buttons to make their text bigger or smaller',
    ],
  },
  {
    version: '1.82.0',
    date: '2026-10-14',
    changes: [
      'Docs now include Windows help files (.chm), like the CPA help: read them a topic at a time with their contents beside them, and search them with everything else',
      'The three new CPA PDFs are in Docs too',
      'Reading a document on your phone now fills the whole screen, with the whole page in view',
      'Pinch or double-tap to zoom into a page, and drag to move around it; pages get sharper as you zoom in',
      'Swipe, or tap the left or right edge of a page, to turn it',
      'Full screen button: the page gets the whole screen and a tap in the middle hides or shows the controls',
      'On a computer the reader fills the window too, with zoom buttons, ctrl-scroll or trackpad pinch to zoom, and F for full screen',
    ],
  },
  {
    version: '1.81.0',
    date: '2026-10-14',
    changes: [
      'New Docs page (in the sidebar and on the wheel): your PDFs from the server, grouped by folder and shown by their first page',
      'Search every page of every PDF at once; accents and capitals don’t matter, and "quoted words" match as a phrase',
      'Open a result to read the document page by page, with your words highlighted on the page and buttons to jump between matches',
      'Docs are only visible when you’re signed in, and open as the original PDF with one tap',
    ],
  },
  {
    version: '1.80.0',
    date: '2026-10-14',
    changes: [
      'Add a whole Spotify playlist to your records at once: open it under Playlists and tap “Add all songs”',
      'Pick a place on the map: drop a pin with a tap and drag it to just the right spot, for a note’s place or your home',
      'While picking on the map, searching for a town, typing coordinates or “Where I am now” moves the pin there',
    ],
  },
  {
    version: '1.79.1',
    date: '2026-10-14',
    changes: ['Visiting savavlad.com/game no longer replaces the journal’s offline copy'],
  },
  {
    version: '1.79.0',
    date: '2026-10-14',
    changes: [
      'One page header everywhere: the title in serif, the controls on the right, and a round glass back arrow on pages you open from another (Settings, Patterns, What’s on your mind, Your brain, Channel points)',
      'Your shelf, Your records and Your repos now use the same plain title as every other page',
      'One set of sizes for text, corners and button heights across the whole app, so cards, chips and buttons line up',
      'Section headings, chart titles and the small uppercase labels now share one look',
      'The small number boxes on Records, Repos and Most picked are now the same box',
      'Repos keeps monospace only for code, hashes and branch lines; names and labels use the app’s own type',
      'The library card and stamps use shared colours instead of one-off ones, and the map’s background follows the theme',
    ],
  },
  {
    version: '1.78.3',
    date: '2026-10-13',
    changes: [
      'On desktop the records page uses the full width: the song of the day sits beside the numbers and tabs instead of under them',
      'On desktop Most picked shows its numbers in a square beside the ranking',
      'Fixed the missing space in page titles like “Your records”',
    ],
  },
  {
    version: '1.78.2',
    date: '2026-10-13',
    changes: [
      'On desktop a note fills the whole screen beside the sidebar, like a document, instead of a narrow column in the middle',
    ],
  },
  {
    version: '1.78.1',
    date: '2026-10-13',
    changes: [
      'Removed the mood background and its Settings switch: pages are plain again',
    ],
  },
  {
    version: '1.78.0',
    date: '2026-10-13',
    changes: [
      'Notes give the words the whole screen: the header card is gone, leaving a bare title and one quiet line beneath it with the date, weather, place, feeling and people',
      'The songs of a note collapse into one small “♪ 3 songs” chip on that line; tap it to see and play them in a sheet instead of a strip under the text',
      'The top bar is just Back, ⋯ and Done; reading view, making a note public, its icon and delete moved into the ⋯ menu',
      'The toolbar at the bottom only appears while you’re writing',
    ],
  },
  {
    version: '1.77.1',
    date: '2026-10-13',
    changes: [
      'The mood background is calmer: faint, blurred clouds drift slowly behind the page, with soft out-of-focus letters thickening where the clouds are',
      'Each mood keeps its own colours and letters, and its own gentle drift: joy and hope rise, sadness sinks in long curtains, calm stretches into mist',
      'Letters blend smoothly into one another instead of flickering, and the whole thing moves at a slow 20 frames a second',
    ],
  },
  {
    version: '1.77.0',
    date: '2026-10-13',
    changes: [
      'New mood background: behind every page, a faint field of letters takes the world of your latest mood',
      'Joy is a warm glow with twinkling sparks, calm a swell of ≈ waves, sadness a light rain of drops, anger rising embers, fear patches that flicker, shame brackets closing in, hope drifts rising upward, love two softly beating glows',
      'It fades from one world to the next when you log a new feeling, and stronger feelings show a little stronger',
      'Turn it off in Settings › Appearance › Mood background',
    ],
  },
  {
    version: '1.75.2',
    date: '2026-10-13',
    changes: [
      'Bold, italic, strike and highlight now work like in a word processor: they style the words only, never a heading’s, list’s or quote’s own marker, so a highlighted heading no longer turns into raw ### ==text==',
      'Styling a selection over several lines gives each line its own markers, and spaces stay outside them',
      'Styling part of text that is already styled splits it, styling over styled text merges it, and pressing again takes it all off',
      'Styles that overlap are cut so they always nest, and bold italic (***text***) now shows as both',
    ],
  },
  {
    version: '1.76.0',
    date: '2026-10-13',
    changes: [
      'The little cloud beside each journal day now shows the weather of the day: rain when sadness led, thunder and lightning when anger did, a shining sun when joy did',
      'The mood line reacts too: it flashes with each lightning strike, glows in the sun and sways in the rain',
      'Tap the cloud for more: a downpour, a lightning strike, or a burst of sunshine',
    ],
  },
  {
    version: '1.75.1',
    date: '2026-10-13',
    changes: [
      'Pictures in the feed keep their own shape instead of being cropped into a wide box',
      'Banners and tall slivers are shown whole, and small pictures are no longer blown up',
    ],
  },
  {
    version: '1.75.0',
    date: '2026-10-13',
    changes: [
      'On desktop, the sidebar can be hidden with the arrow on its edge, and brought back with the same arrow',
      'The page widens to use the freed space, and the choice is remembered',
    ],
  },
  {
    version: '1.74.0',
    date: '2026-10-13',
    changes: [
      'Clone one of your GitHub repos onto the server, right from its page',
      'Only the site’s owner sees the button, signed in to the site and to GitHub',
      'The page shows the clone as it runs, then where it landed or what went wrong',
    ],
  },
  {
    version: '1.73.0',
    date: '2026-10-13',
    changes: [
      'Add a note’s place by hand: “Choose a place” lets you search for a town or city, or type coordinates',
      'A note’s place can now be changed, not just removed',
      'Home in Settings also accepts coordinates, such as one copied from a map app',
    ],
  },
  {
    version: '1.72.0',
    date: '2026-10-13',
    changes: [
      'Choose what else a public note shows: feelings, people, place, weather and music each have their own switch',
      'Everything starts off, and each switch shows exactly what it would share',
      'People appear by name only and a place by its name only, never where it is on a map',
      'Music you share can be played right on the public page',
      'Changing the switches on a public note offers “Update public copy”, just like editing it',
    ],
  },
  {
    version: '1.71.1',
    date: '2026-10-13',
    changes: [
      'The Saved pill no longer blinks while you type: it stays put and changes in place',
      'A small spinning circle shows while a change is saving, then turns into a tick once it’s saved',
    ],
  },
  {
    version: '1.71.0',
    date: '2026-10-12',
    changes: [
      'Writing a note is seamless: no more #, * or other symbols. Words just turn bold, big or highlighted',
      'Bullets show as clean dots and checklists as round boxes you tap to tick, right while you write',
      'Backspace at the start of a heading, bullet or checklist item turns it back into plain text',
      'Enter at the start of a heading or list item adds a line above it',
      'Tap Bold or another style with nothing selected, and what you type next takes that style',
      'A calmer, slimmer toolbar above the keyboard, with a Checklist button right on it',
      'Text tools in small groups, plus Move in and Move out while you’re in a list',
      'A button to put the keyboard away when you’re done writing',
      'Pictures resize smoothly with a slider or their corners, to any size, with no jumps',
      'Dragging a picture is smoother: it lifts off, glides into place and doesn’t flicker between spots',
      '“Write next to it” moves a picture to the side and puts the cursor right beside it',
    ],
  },
  {
    version: '1.70.0',
    date: '2026-10-12',
    changes: [
      'Share a single note with the world: tap the globe at the top of a note to get a link anyone can open without signing in',
      'Each note is its own choice. Nothing is public until you turn it on for that note, and only you, signed in, can do it',
      'Only the title, text, pictures and day are shared. Feelings, people, place, weather and music stay private',
      'The link can’t be guessed and the page is hidden from search engines. “Stop sharing” takes the page down at once',
      'If you edit a public note, the sheet says so and “Update public copy” brings the page up to date',
      'Public notes show a small “Public” mark in the journal, and Settings lists every public note so you can copy or stop any of them',
      'Deleting a public note, or all entries, takes its public page down too',
    ],
  },
  {
    version: '1.69.0',
    date: '2026-10-12',
    changes: [
      'Each day’s mood line now has a tiny cloud beside it, drawn in that feeling’s letters and drifting like the sky',
    ],
  },
  {
    version: '1.68.0',
    date: '2026-10-12',
    changes: [
      'A new intro for anyone who isn’t signed in: a 3D brain drawn in letters, turning in a sky of letter clouds',
      'Its regions take turns lighting up, sparks run between them and a ring of feelings orbits around it',
      'Drag the brain to spin it, point at it to move the light, tap a region to light it up',
      'Sign in with the admin password and the brain bursts toward you as your journal comes in',
      'Settings: see whether this device is signed in, sign out, or look at the intro again',
    ],
  },
  {
    version: '1.67.1',
    date: '2026-10-12',
    changes: [
      'Signing in to Spotify or GitHub on one device no longer disconnects your others',
      'Spotify renews an expired session and tries again instead of signing you out',
      'A brief network drop or a slow Spotify or GitHub no longer shows you as disconnected',
      'More time to finish signing in on a phone',
    ],
  },
  {
    version: '1.67.0',
    date: '2026-10-11',
    changes: [
      'Repo cards now show a small README preview, loaded as you scroll',
    ],
  },
  {
    version: '1.66.2',
    date: '2026-10-11',
    changes: [
      'Fixed a brief flicker after the opening animation when entering the app',
    ],
  },
  {
    version: '1.66.1',
    date: '2026-10-11',
    changes: [
      'Spotify login now always finishes on savavlad.com, so it no longer fails when you start it from another address',
      'The site now lives only at savavlad.com',
    ],
  },
  {
    version: '1.66.0',
    date: '2026-10-11',
    changes: [
      'New Repos section: your GitHub repos, public and private, listed like a folder tree under a sky of code, with filters for All, Journaled, Public and Private',
      'Open a repo to rate it, say how working on it feels and write your thoughts about it; they sync and back up with the rest of your journal',
      'A repo’s page shows its commit history, drawn like a git log with a star for each commit, and its README in a terminal-style window',
      'Repos is in the sidebar and on the wheel; backups, sync, the text export and Delete all include it',
    ],
  },
  {
    version: '1.65.2',
    date: '2026-10-11',
    changes: [
      'GitHub: private repos are now counted from GitHub’s own list and checked against the access it granted, instead of relying on one profile field',
    ],
  },
  {
    version: '1.65.1',
    date: '2026-10-11',
    changes: [
      'GitHub login works from either of the site’s domains: it always finishes on the one set as the GitHub callback',
    ],
  },
  {
    version: '1.65.0',
    date: '2026-10-11',
    changes: [
      'Settings has a GitHub section: log in with GitHub to see how many public and private repos you have, and whether private ones are visible',
    ],
  },
  {
    version: '1.64.0',
    date: '2026-10-11',
    changes: [
      'Voice typing is gone: the microphone button in the note toolbar and the Voice typing section in Settings are removed',
      'Speech models already downloaded to a device are cleared the next time the app updates there',
    ],
  },
  {
    version: '1.63.0',
    date: '2026-10-11',
    changes: [
      'On a wide screen, the sidebar’s New button now has a little sky of its own: clouds drift behind letters in the button’s colours',
      'Stats and Settings moved up into the sidebar’s main list, right under the other places',
    ],
  },
  {
    version: '1.62.0',
    date: '2026-10-11',
    changes: [
      'On a wide screen, the Journal now has a small channel points card under the song of the day: your total, today’s gain, a line of the last month, and who is being watched now. Tap it for the full page',
    ],
  },
  {
    version: '1.61.0',
    date: '2026-10-11',
    changes: [
      'On a wide screen, the Journal now shows the song of the day in a card under the day’s panel: play it, shuffle, change it, or pick a song for any of the last two weeks',
    ],
  },
  {
    version: '1.60.0',
    date: '2026-10-11',
    changes: [
      'A new wheel button: a ring of sparks in the categories’ colours leaves it, a comet circles it, stars twinkle around it, and more sparks join in when you point at it or tap it',
      'Until you open the wheel for the first time, its button hops and sends out rings, and a “Tap for the menu” label points at it',
      'Every animation on the wheel is 1.5× faster: opening, closing, zooming in and out, and leaving for a page',
      'Mined channels: a name typed in the box now counts when you press Save, a new channel goes to the top so the miner watches it first, and each channel says if it is being watched or waiting for a free slot',
      'Channel points: a channel the miner was just given shows in the list straight away, instead of only after its first points',
    ],
  },
  {
    version: '1.59.0',
    date: '2026-10-10',
    changes: [
      'New in Settings › Privacy: Blur notes & people blurs your notes, check-in notes and the people in your lists, so no one can read them over your shoulder',
      'Opening a note still shows it clearly, and on a computer pointing at something brings it into focus',
    ],
  },
  {
    version: '1.58.1',
    date: '2026-10-09',
    changes: [
      'The app opens faster by loading screens as you visit them, while keeping them available offline',
      'Long journals render faster and load photos as they approach the screen',
      'The brain rests while hidden behind the wheel, with the same appearance and animations',
    ],
  },
  {
    version: '1.58.0',
    date: '2026-10-08',
    changes: [
      'Your brain can look at 7 weeks, 13 weeks or all of your journal, with the choice remembered',
      'A slider under the brain takes it back in time: drag it to see how the brain looked on any past day, or press play to watch it change from the start of your journal to today',
      'Over the 7 and 13 week views, each region also says whether it grew or shrank compared with the stretch just before',
      'The brainwave, counts and notes follow the stretch you picked (long stretches are drawn week by week)',
    ],
  },
  {
    version: '1.57.1',
    date: '2026-10-08',
    changes: [
      'The brain moved out of Settings: it is now Your brain on the wheel, under Insights, on a page of its own',
    ],
  },
  {
    version: '1.57.0',
    date: '2026-10-08',
    changes: [
      'Settings has a new Your brain section: a brain drawn in letters, like the sky, that reacts to the last 7 weeks of your journal',
      'Each of the eight feeling worlds lives in its own region (fear in the amygdala, joy in the reward hub, love in the temporal lobe, calm in the brainstem…) and moves like its sprite does',
      'Regions glow with how much of that world you felt, recent days counting more and older ones fading like memories; tap a region to read what it does and how it did',
      'A brainwave of your mood over the 7 weeks, three small counts, and notes from psychology checked against your entries: affect labelling, rumination loops, the peak–end rule, emotional granularity, late-night feelings and more',
    ],
  },
  {
    version: '1.56.0',
    date: '2026-10-07',
    changes: [
      'The + button now opens a wheel of things to add (note, check-in, person, book, music), like the wheel for getting around',
      'The old glass panel of tiles behind the + is gone',
    ],
  },
  {
    version: '1.55.0',
    date: '2026-10-07',
    changes: [
      'The Projects (GitHub) section is gone, with its slice on the wheel, its sidebar link and the GitHub row in Settings',
    ],
  },
  {
    version: '1.52.1',
    date: '2026-10-07',
    changes: [
      'Channel points: an Edit channels button at the top of the page, next to Back, so it\'s there without scrolling',
    ],
  },
  {
    version: '1.52.0',
    date: '2026-10-07',
    changes: [
      'Channel points: an Edit button on the channel list changes which channels the points miner watches',
      'Add a channel by name or link, reorder them to set who comes first, or remove one; saving restarts the miner with the new list',
      'Changing the channels needs the admin password; each device stays signed in for 90 days',
      'Channels the miner no longer watches are marked as such in the list',
    ],
  },
  {
    version: '1.51.0',
    date: '2026-10-06',
    changes: [
      'The Face ID lock is gone: My Mind and People open straight away, with no passkey prompt',
      'The Privacy section in Settings went with it',
    ],
  },
  {
    version: '1.50.2',
    date: '2026-10-06',
    changes: [
      'On iPhone, the lock asks for Face ID by itself again as soon as it shows, so it\'s one tap on the system sheet instead of two',
    ],
  },
  {
    version: '1.50.1',
    date: '2026-10-06',
    changes: [
      'On iPhone, the lock no longer brings up a passkey sheet: tap anywhere on it and Face ID starts straight away',
      'No more mentions of passkeys in the lock’s messages',
    ],
  },
  {
    version: '1.50.0',
    date: '2026-10-06',
    changes: [
      'A new add panel: the + grows into a sheet of glass with a note across the top and check-in, person, book and music in a grid below',
      'Each choice wears its own colour, and the one you pick fills with it before its page opens',
      'The same panel drops from New in the desktop sidebar; press the + and slide onto a choice still works on phones',
    ],
  },
  {
    version: '1.49.0',
    date: '2026-10-06',
    changes: [
      'The check-in card on the journal is now one compact line, without the row of eight feelings; tap it to check in',
      'The top of the journal is a little shorter',
      'The wheel button is bigger, gives a twirl every few seconds and sends out a ring of light',
    ],
  },
  {
    version: '1.48.1',
    date: '2026-10-06',
    changes: [
      'Drag the background around the wheel to turn it, and let go to fling it; a tap on the background goes back a level again',
    ],
  },
  {
    version: '1.48.0',
    date: '2026-10-06',
    changes: [
      'Tap the background around the wheel to give it a spin (the middle, the X and Escape still close it)',
    ],
  },
  {
    version: '1.47.2',
    date: '2026-10-06',
    changes: [
      'Picking a page on the wheel now dissolves the wheel into that page, instead of the half-closed wheel sliding away sideways',
      'Page changes no longer start twice on pages with the wheel button, and a swipe back on iPhone no longer animates twice',
      'Settings no longer shows the + button',
    ],
  },
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
