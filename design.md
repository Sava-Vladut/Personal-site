# My Mind — design system

White and graphite, a serif for voice and a sans for everything else. The app should feel calm, quick and
quiet: colour comes from feelings and from the things you save (covers, photos, records), not from the chrome.

Every value below is a CSS custom property defined at the top of `src/styles/app.css` (glass in
`src/styles/glass.css`). Use the token, never the raw number. If no token fits, that's a sign to reuse an
existing pattern, not to add a one-off value.

`node scripts/design-audit.mjs` lists the places where the styles still drift from this file (see
[Keeping it consistent](#keeping-it-consistent)).

## Principles

1. **Content is solid, chrome floats.** Cards, notes and charts sit on opaque surfaces. Only things that
   float above content (tab bar, sheets, toasts, tooltips, menus, sticky toolbars) use glass and blur.
2. **Quiet by default.** Nothing loops forever at rest. Decoration plays once when a page appears, or on
   hover/focus, and then stops.
3. **Fast before fancy.** Page changes take about 0.2s. Entrances are a subtle cascade, never a wait.
4. **One of each.** One radius per role, one shadow per elevation, three weights, one way to build each
   kind of screen. Near-duplicates (550 next to 600, 0.26s next to 0.25s, 17px next to 18px icons) are bugs.
5. **Dark mode is free.** Use colour tokens and dark mode follows. A literal hex is a dark-mode bug
   waiting to happen.
6. **Same job, same look.** Two screens that list things, filter things or show an empty state do it with
   the same components, spacing and wording. A screen that looks different should have a reason.

## Colour

| Token | Role |
|---|---|
| `--bg` | Page background |
| `--surface` | Cards, sheets, inputs |
| `--surface-2` | Quiet buttons, chips, segmented controls, wells |
| `--surface-3` | Pressed or hovered quiet controls |
| `--line` / `--line-2` | Hairlines and card borders / input borders, stronger dividers |
| `--ink` / `--ink-2` / `--ink-3` | Primary text / secondary text / captions, icons, placeholders |
| `--on-ink` | Text on an ink (primary) button |
| `--on-color` | Text and icons on a feeling's colour or a photo (instead of `#fff`) |
| `--danger` | Destructive actions and errors only |
| `--pos` / `--neg` | Pleasant / unpleasant in charts |
| `--emo-*` | The eight emotion worlds (CVD-validated). The only saturated colours in the UI |

Tints of a feeling are mixes, not new colours: `color-mix(in oklab, var(--c) 22%, var(--surface))` for a
tinted background, `color-mix(in oklab, var(--c) 55%, var(--ink))` for text on it (see `.avatar.tinted`).

Allowed literal colours: scrims over photos and covers, artwork (vinyl, paper, wood, the intro's night
sky), brand marks (Twitch purple, Spotify green, GitHub language colours), the Word look of notes (Word
blue, highlighter) and `#000` inside `mask-image` (only its alpha counts).

## Type

Serif (`--serif`) is for titles and names: things that are *yours*. Sans (`--sans`) is for everything
else. Mono (`--mono`) is for codes and the intro only.

| Token | Size | Use |
|---|---|---|
| `--text-2xs` | 10px | Chart axis and badge labels |
| `--text-xs` | 11px | Small print, counters, uppercase labels |
| `--text-s` | 12px | Captions, eyebrows |
| `--text-m` | 13px | Secondary text, chips, small buttons |
| `--text-base` | 15px | Body, buttons, section titles |
| `--text-l` | 17px | Serif list titles, lead text |
| `--text-xl` | 22px | Sub-page titles (`.title-s`) |
| `--text-2xl` | 28px | Display: titles you type in, big stat numbers, countdown digits |

- Page titles (`.title`) use `clamp(26px, 7.4vw, 34px)`.
- Display text is `--text-2xl` (28px): the title fields of books and people (`.title-input`), stat tiles
  (`.tile-value`), the mind card's percentage and countdown digits. The note editor's own title is a
  document style and keeps its size.
- Inputs stay at **16px** so iOS doesn't zoom.
- Below 10px only inside SVG drawings (wheel rings, chart dots, maps) and tiny avatars, where the text
  scales with the drawing.
- Text inside notes scales with zoom and keeps its own document sizes (and its 420 heading weight).

| Weight | Value | Use |
|---|---|---|
| `--w-regular` | 400 | Body text |
| `--w-medium` | 500 | Labels, chips, serif titles |
| `--w-bold` | 600 | Buttons, emphasis, numbers, section titles |

Nothing else. Headings inside the note body are document styles and may differ.

**Line height:** 1.5 body (set on `body`); 1.45 for multi-line secondary text; 1.25 for serif titles and
headings; 1.12 for page titles; 1 for single-line numbers, badges and icon labels. Nothing in between.

**Letter spacing:** `-0.015em` page titles, `-0.01em` sub-page titles, `-0.025em` big numbers, `0.02em`
eyebrows. Uppercase labels are `--text-xs`, `--w-bold`, `0.08em`, `--ink-3` (`.badge`, month names, dates
in note details). Use uppercase sparingly: one label per block at most.

Numbers that change or line up (counters, stats, times) use `font-variant-numeric: tabular-nums`.

## Shape

| Token | Value | Use |
|---|---|---|
| `--r-2xs` | 2px | Hairline bars, chart marks |
| `--r-xs` | 4px | Tags, small marks, code |
| `--r-s` | 8px | Small controls, thumbnails, focus rings |
| `--r-m` | 12px | Inputs, segmented controls, menus |
| `--r-l` | 16px | Cards |
| `--r-xl` | 28px | Sheets, banners |
| `--r-pill` | 999px | Buttons, chips, icon buttons, the tab bar |

Avatars and dots use `50%`. Nested corners: inner radius = outer radius − padding (or `inherit`).

## Elevation

| Token | Use |
|---|---|
| none + `1px solid var(--line)` | Default card (`.card`) |
| `--shadow-1` | Resting controls: the selected segment, raised chips |
| `--shadow-2` (`--shadow`) | Floating cards, menus, hints |
| `--shadow-3` | Sheets, dialogs, popovers, dragged items |
| `--glass-shadow` | Glass chrome (in `glass.css`) |

Focus rings, inset highlights and coloured glows are not elevation and stay bespoke. Small physical
knobs (the switch thumb, slider thumbs) and the page-slide edge may keep their own small shadow. So do
the drawn objects (book covers, records and sleeves, cassettes, the shelf, the library due card, map
pins, the song-of-the-day disc): their shadow is part of the artwork, like their literal colours.
Anything that is interface (a card, a pill, a menu) uses the tokens.

## Layers

Fixed and floating things stack in this order. Pick the layer by role; don't invent a number. Inside a
component, use 1–5 (and `isolation: isolate` on the component) for local stacking.

| z-index | What |
|---|---|
| 30 | Note format toolbar (ribbon) |
| 35, 36 | Note status bar and top bar; the top bar's button |
| 40 | Tab bar, desktop sidebar, the full-screen note |
| 50 | Drop overlay while dragging a file |
| 60 | Sheets, the intro, a dragged picture |
| 65 | Nav wheel |
| 70 | Context menus |
| 75 | Mention popover |
| 80 | Toasts |
| 90 | Tooltips, mention bursts |
| 1000 | Loading bar at the very top |
| 1100 | The opening as the app starts (`opening.css`), over everything, even the loading bar |

## Layout and spacing

**Page shell.** Every screen is a `.page`: max 640px wide on phones, `--gutter` (16px) side padding,
18px under the safe area. Wider layouts live in `desktop.css` from 1024px. The floating tab bar reserves
`--nav-h` at the bottom; safe areas use `--safe-t` / `--safe-b`.

**Vertical rhythm.**

| Gap | Between |
|---|---|
| 4px | An icon or mark and its label, tight rows of marks |
| 6px | An eyebrow or subtitle and its title |
| 8px | Chips, buttons in a row, paragraphs in an empty note |
| 10px | A section title and its content |
| 12px | Cards in a stack (`.stack-l`), the page bar and the title |
| 18px | The page head and the first content |
| 26px | Sections (`.section`) |

**Inside things.** Cards (`--r-l`) pad `14px 16px`; tiles, wells and compact cards (`--r-m`) pad
`12px 14px`; list rows pad `13px 16px` and are at
least 56px tall; buttons pad `0 18px` (`0 14px` small); chips pad `0 13px`.

**Scale.** Spacing uses 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28px (1px and 3px only as optical
nudges inside controls). Odd values like 5, 7, 9, 11, 13 are usually a near-duplicate of a neighbour.
Prefer `gap` on a grid/flex parent over margins on children.

**Controls.** `--h-s` (34px) for small buttons, chips, tabs and small icon buttons; `--h-m` (44px) for
buttons, fields and icon buttons, the minimum touch target.

**Breakpoints.** Phones first, then widen:

| Width | Use |
|---|---|
| `max-width: 380px` | Very narrow phones: tighten, hide the extras |
| `min-width: 560px` | Grids go from one or two columns to more (tiles, rungs) |
| `min-width: 720px` | Two-column lists and option grids, wider sheets |
| `min-width: 1024px` (`max-width: 1023.98px`) | Desktop layout: sidebar, wider page (`desktop.css`) |
| `min-width: 1280px` | Wide desktop |

Other widths (400, 420, 480, 520, 640, 900) are drift: fold them into the nearest of these.

## Icons

Icons come from `<Icon name size />` (`src/components/icons.tsx`, stroke 1.75). Sizes follow the text
next to them:

| Size | Use |
|---|---|
| 14 | Inside chips, captions and inline with `--text-m` |
| 16 | Inside small buttons (`.btn-s`), segmented tabs (`.seg.tabs`), list rows and inline with body text |
| 18 | Inside full-size buttons (`.btn`), icon buttons and toolbar buttons (the default for a control) |
| 20 | Icons on their own: page actions, card headers |
| 22 | Tab bar |
| 24 | Empty states and big moments that have no mark (see below) |

12 is allowed for tiny marks. 13, 15, 17 and 19 are near-duplicates: round to the role above. Don't
change the stroke, except the active tab (2 vs 1.6).

## Illustrations (marks)

The Learn screens (Mind traps, Laws of power, Win friends) give every entry a **mark**: a small spot
illustration in the manner of Anthropic's editorial drawings, with ivory cut-paper shapes and loose black
brush lines on a flat, papery colour tile. `<Mark id hue />` (`src/components/Mark.tsx`) draws the tile and
runs the lines through a seeded wobble so they look hand-inked; the drawings live in `src/data/marks.ts`.

Line icons are for **doing**, marks are for **meaning**. Use a mark where the app wants to make you
feel or understand something, and where a line icon would feel thin:

- **Empty states** of whole screens: one mark above the sentence instead of a 24px line icon (no notes yet,
  no people yet, no songs yet).
- **Hero moments**: the "today" card on a screen, the top of a detail page, a finished streak or a
  milestone, the opening of a guide.
- **Section and hub headers** that introduce a topic (a Learn part, an Insights group), next to the title.
- **Shared pages** people see from outside the app, where it needs to feel like a printed card.

Never use a mark:

- In controls or chrome: buttons, chips, tabs, the tab bar, toolbars, list-row icons, menus, toasts.
  Those stay line icons (`<Icon>`), so the app stays quiet.
- More than once per view at hero size, or as decoration with no meaning behind it.
- As a stand-in for the emotion sprites or a person's avatar; those already say who and what.

**Sizes** (width = height; the tile's corner is part of the drawing, so don't add a radius):

| Size | Use |
|---|---|
| 28 | Inline in a row or a link to another entry |
| 34 | Related entries ("kin") in a list |
| 48 | Cards in a grid or list |
| 64 | The "today" card and section headers |
| 96 | The top of a detail page, empty states |

32 next to 34 is a near-duplicate: use 34.

**Colour.** `hue` is an emotion world (`--emo-*`), picked by the entry's family, arena or part, or by the
screen's world for marks elsewhere. The tile mixes it with paper (`mark.css`) and looks the same in both
themes; the ink (`#141413`) and paper (`#faf9f5`) are artwork, an allowed literal.

**Drawing a new mark.** Add it to `src/data/marks.ts` with the pen helpers there (`k` ink line, `p` cut
paper, `pk` outlined paper, `f` solid ink, plus `circle`, `star`, `glint`, `heart` and friends) in the
100 × 100 box, at the standard line width `W`. One idea per drawing, a single clear silhouette, no text,
only ink and paper (the tile brings the colour), and keep the subject inside the tile's rounded corners.
Marks outside Learn go in their own map (for example `SPOT_MARKS`, keyed `spot:<name>`) merged into `ART`
in `Mark.tsx`, so their ids can't collide with trap, law or principle ids. Give the wrapping class a
component prefix (see the class-collision note in the checklist).

## Motion

| Token | Value | Use |
|---|---|---|
| `--dur-0` | 0.1s | A press going down |
| `--dur-1` | 0.15s | Hovers, colours, exits |
| `--dur-2` | 0.25s | Small state changes, entrances |
| `--dur-3` | 0.45s | Panels, sheets, things rising in |
| `--dur-4` | 0.6s | Springs and pops |
| `--dur-5` | 0.9s | Meters and charts drawing themselves |

Easing: `--ease` (default), `--ease-emph` (pages and sheets: quick start, soft landing), `--spring`
(settles with a hint of overshoot), `--spring-bouncy` (small things that pop).

Rules:
- **Page transitions:** push 0.22s, pop 0.2s, tab switch a ~0.18s fade-through (`app.css`, "page
  transitions"). These, the nav wheel, the opening and the intro (`opening.css`, `intro.css`), clocks
  that tick once a second (a countdown bar moving `1s linear`) and decorative loops (anything over 1s)
  keep their own timings; every other duration is a token.
- **Staggered entrances:** 20ms per item, everything in by 80ms, using `--dur-2`/`--dur-3`.
- **Only animate `transform` and `opacity`** in anything that loops or runs while scrolling. Never
  animate `filter`, `box-shadow`, `width`, `stroke-width` or `background-position` in a loop.
- **No infinite loops at rest.** Decoration runs a few times and stops (e.g. the nav wheel plays twice
  after a page appears, `--nw-runs`, and comes alive again on hover/focus). Loops that show state are fine:
  a record turning while it plays, a live dot, a spinner, a countdown ticking once a second.
- `prefers-reduced-motion` turns animation off globally (end of `app.css`); the sky canvas stops too.

## Loading and arrival

Nothing pops, nothing jumps, nothing flashes. Content arrives: it fades and settles into a space that was
already waiting for it, and the seams between "not here yet" and "here" are hidden.

**What the app already does for you** (reuse these; don't write a new entrance):

| Mechanism | Where | What it does |
|---|---|---|
| First paint | `fade-data.css`, `.page[data-boot]` | A cold start's pieces settle in one after another; sidebar and tab bar come with them |
| Page changes | `app.css`, "page transitions" | Push, pop and tab fade-through via View Transitions |
| Slow screen | `lib/router.ts`, `html[data-loading]` | A thin bar creeps across the top, only after 120ms |
| Pictures | `lib/fadeImages.ts`, `fade-images.css` | Every `<img>` still loading is hidden in its slot and fades in from a touch larger. Automatic; opt out with `data-no-fade` |
| Below the fold | `lib/reveal.ts`, `fade-scroll.css` | Cards, rows and tiles drift up as they scroll into view, once. Automatic for the units listed there; opt out with `data-no-reveal` |
| Fetched block | `.fade-arrive` / `.fade-arrive-soft` | One block landing (a widget, a preview, a line of fetched text); `--i` staggers blocks that land together |
| Fetched list | `.fade-rows` / `.fade-rows-soft` | Rows cascade 25ms apart, all moving within 100ms |

Use the `-soft` versions (no blur) for big blocks, for anything Settings › Blur can blur, and for more
than a handful of items.

**Rules.**

1. **Wait before showing a wait.** A load under ~120ms shows nothing at all. Only after that does a
   loader appear, and it fades in too. Most loads should never show one.
2. **Hold the space.** Whatever is loading gets its final size up front: `aspect-ratio` or `width`/`height`
   on pictures and covers, `min-height` on blocks, `tabular-nums` and a `min-width` on numbers that tick.
   The page must not shift when content lands. A picture's empty slot is `--surface-2` (or the cover's
   own colour when it's known), never white or a hard border.
3. **Ghosts, not spinners, for content.** When a card, row or list takes longer than ~300ms, show quiet
   placeholder shapes in `--surface-2` with the same size, radius and layout as what's coming (a line for
   a title, a shorter one for the subtitle, a square for a cover). Build them from the shared `.ghost`
   class in `app.css` (Media's `GhostRows` is an example), not one per screen. Ghosts may breathe (a slow
   opacity pulse, `opacity` only) while loading and stop the moment the content is in. No sweeping shimmer
   gradients: they animate `background-position`, which the motion rules forbid.
4. **Cross-fade the swap.** The content takes the ghost's place in the same box with `.fade-arrive-soft`
   (or `.fade-rows-soft` for a list); never cut from ghost to content.
5. **Spinners only for actions.** A button that is working shows its label changing ("Saving…") and stays
   the same width; a full-screen spinner is never the answer. Loading text ("Loading…", "Reading the repo
   from GitHub…") is a last resort for a slow external service: `--ink-3`, with `.loading-note`, which
   keeps it hidden for the first 120ms and then lets it rise in.
6. **Errors and empty states arrive too.** They come in with `.fade-arrive-soft`, not with a snap, and
   replace the ghost in the same space.
7. **Soften the edges.** Where content is cut off, fade it out instead of clipping it hard: a
   `mask-image` gradient at the end of a horizontal scroller or a clipped preview (`.rd-scroll.is-clipped`
   does this), a gradient scrim under text on a photo, a slow fade on a sky or a glow behind a page
   (`.route-status`). Meters and charts draw themselves in (`--dur-5`) instead of appearing full.
8. **Play once, on arrival.** An entrance plays when the element is put in the page, not on every
   re-render, refresh or sync. Keep list keys stable, so a refresh doesn't replay the cascade. Content
   that is already on screen is never faded again.
9. **Quick and capped.** Arrivals use `--dur-2`/`--dur-3` with `--ease-emph`, staggers stop at 100ms,
   and the whole screen is in within about 0.4s. Never hold content back for the sake of an animation.
10. **Reduced motion is instant, and nothing stays hidden.** Everything above is instant under
    `prefers-reduced-motion` (end of `app.css`), and only elements a script tagged are ever hidden, so if
    the script fails, content simply shows.

## Glass

The liquid glass material (`.glass`, `.glass-btn`, `--glass-*`) is for chrome only: the tab bar, toolbar
buttons, sheets, toasts, tooltips and context menus. **Never put `backdrop-filter` on an in-flow card**,
especially over the animated sky: the browser re-blurs it every frame and scrolling stutters. For a card on
a sky banner, use an opaque mix such as `color-mix(in oklab, var(--bg) 64%, var(--surface))`.

## Components

Reuse these before writing new CSS (all in `app.css` unless noted):

| Class | What it is |
|---|---|
| `.btn` + `.btn-primary` / `.btn-quiet` / `.btn-danger`, `.btn-s` | Pill buttons; ink, quiet grey, destructive; small size |
| `.icon-btn` (`.small`) | Round icon-only button; always has an `aria-label` |
| `.chip`, `.chips` (`.scroll-x`) | Filter and choice pills; `aria-pressed="true"` turns them ink |
| `.seg` (`.compact`, `.tabs`) | Segmented control; selected item uses `aria-selected` |
| `.switch` | On/off toggle; `role="switch"` with `aria-checked` |
| `.input`, `.input-s`, `.field-label` | Text fields and their labels |
| `.card` | Solid surface, `--r-l`, hairline border |
| `.list` + `.list-row` (`.action`) | Settings-style rows inside a card; the last row drops its border |
| `.meter` | Thin progress bar that grows in from the left |
| `.badge` | Small uppercase status label |
| `.avatar` (`.tinted`, `.new`) | Round initials or photo for a person |
| `.page`, `.page-head`, `.title`, `.title-s`, `.subtitle`, `.eyebrow` | Page shell and headings; list screens use `PageHead` |
| `.section`, `.section-title` | A titled block within a page |
| `.empty`, `.empty-note` | Empty states: a centred one for a whole screen, a quiet line inside a section |
| `.stack-l`, `.row` | Layout helpers |
| `.glass`, `.glass-btn` (`glass.css`) | Floating chrome |
| `Sheet`, `Confirm`, `Toasts`, `PageHead` (components) | Bottom sheets, confirmations, toasts, list-screen headers |

**States.**
- Press: `.btn` scales to 0.98 over `--dur-0`. Other tappables (chips, icon buttons, cards, rows) share
  one rule in `app.css` ("press feedback") that sinks them to `--press` and springs back: 0.93 for small
  things, 0.98 for big surfaces. Add a new tappable to that list rather than writing a new `:active`.
- Hover: one step up in surface (`--surface-2` → `--surface-3`), or `opacity: 0.88` on ink buttons.
  **Always inside `@media (hover: hover)`**, so it doesn't stick after a tap on a phone.
- Selected: ink background with `--on-ink` text (chips), or a raised `--surface` with `--shadow-1` (segments).
- Focus: `:focus-visible` 2px ink outline with 2px offset (global). Fields swap the outline for an ink
  border and a soft 3px ring.
- Disabled: `opacity: 0.45`, default cursor (global for buttons).

**Same job, same pattern.**
- Every list screen: `PageHead` (title, actions), then filters as `.chips.scroll-x`, then the list.
- Every page you go into: `PageHead` with `back` (the glass arrow above the title), then sections.
- Every empty state: one short sentence in `--ink-3`, and at most one action (`.btn-quiet`).
- Every destructive action: `.btn-danger` or `.danger` text, behind `Confirm`.
- Every sheet: `Sheet`, a title, content, then the actions.

## Writing in the UI

- Short, plain and warm. Sentence case everywhere ("Add a note", not "Add A Note"). No full stop on
  buttons, labels or titles.
- Buttons say what happens ("Save", "Remove link"), not "OK" or "Submit".
- Every string goes through `t()` and exists in every language (`npm test` runs `test-i18n`).

## Performance budget

- Styles a screen needs only on that screen are imported by its view or component, not by `main.tsx`.
  `main.tsx` keeps only what the app shell uses or what `desktop.css` overrides (see the comment there).
  `desktop.css` loads last on purpose. A lazily loaded file comes after it and wins ties, so give lazy
  rules that compete with desktop rules more specific selectors.
- Screens are lazy (`src/lib/views.ts`) and the nearby ones preload while the app is idle.
- Canvas animations (the sky) must pause when off-screen, when the tab is hidden and under reduced motion.
- No browser test runners on the production host (see `AGENTS.md`).

## Checklist for new UI

- [ ] Only tokens for colour, type size, weight, radius, shadow and duration
- [ ] Spacing, icon sizes, breakpoints and z-index from the tables above
- [ ] Built from the components above; same pattern as the screens that do the same job
- [ ] Line icons in controls; a mark (not a big line icon) for empty states and hero moments where one fits
- [ ] New top-level classes have a component prefix (`wf-`, `nw-`…); a view imports the lazy stylesheet it uses
- [ ] Looks right in dark mode
- [ ] Touch targets ≥ `--h-m` on phones
- [ ] Content is opaque; only chrome uses glass
- [ ] Nothing loops at rest; loops animate `transform`/`opacity` only
- [ ] Loads hold their space, show nothing for ~120ms, use ghosts for content and arrive with a fade
- [ ] Hover inside `@media (hover: hover)`; visible `:focus-visible`; works with reduced motion
- [ ] Screen-specific CSS imported by its view, not globally
- [ ] `node scripts/design-audit.mjs` shows no new findings in the files you touched

## Keeping it consistent

`node scripts/design-audit.mjs` scans `src/styles/*.css` and `src/**/*.tsx` and counts drift per rule
(raw hex, font sizes, weights, radii, shadows and durations; spacing, icon sizes and breakpoints off the
scale; hover outside `@media (hover: hover)`; unknown z-index layers; raw inline styles). It only reports.
Some findings are allowed exceptions listed in this file, so judge each one before changing it.

`--rule=<name>` lists every finding for one rule; `--json` prints all of them for comparing runs.

The hourly `/improve consistency` loop works from this list and from a look at whole screens side by side.
Each run fixes one small, real inconsistency, ships it and reports the count before and after. When a rule
here turns out to be wrong for good reasons, change this file in the same commit instead of the code.
