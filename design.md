# My Mind — design system

White and graphite, a serif for voice and a sans for everything else. The app should feel calm, quick and
quiet: colour comes from feelings and from the things you save (covers, photos, records), not from the chrome.

Every value below is a CSS custom property defined at the top of `src/styles/app.css` (glass in
`src/styles/glass.css`). Use the token, never the raw number. If no token fits, that's a sign to reuse an
existing pattern, not to add a one-off value.

## Principles

1. **Content is solid, chrome floats.** Cards, notes and charts sit on opaque surfaces. Only things that
   float above content (tab bar, sheets, toasts, tooltips, menus, sticky toolbars) use glass and blur.
2. **Quiet by default.** Nothing loops forever at rest. Decoration plays once when a page appears, or on
   hover/focus, and then stops.
3. **Fast before fancy.** Page changes take about 0.2s. Entrances are a subtle cascade, never a wait.
4. **One of each.** One radius per role, one shadow per elevation, three weights. Near-duplicates (550
   next to 600, 0.26s next to 0.25s) are bugs.
5. **Dark mode is free.** Use colour tokens and dark mode follows. A literal hex is a dark-mode bug
   waiting to happen.

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
| `--on-color` | Text on a feeling's colour or a photo |
| `--danger` | Destructive actions and errors only |
| `--pos` / `--neg` | Pleasant / unpleasant in charts |
| `--emo-*` | The eight emotion worlds (CVD-validated). The only saturated colours in the UI |

Allowed literal colours: scrims over photos and covers, artwork (vinyl, paper, wood), brand marks
(Twitch purple, Spotify green, GitHub language colours) and the Word look of notes (Word blue, highlighter).

## Type

Serif (`--serif`) is for titles and names: things that are *yours*. Sans (`--sans`) is for everything else.

| Token | Size | Use |
|---|---|---|
| `--text-2xs` | 10px | Chart axis and badge labels |
| `--text-xs` | 11px | Small print, counters |
| `--text-s` | 12px | Captions, eyebrows |
| `--text-m` | 13px | Secondary text, chips, small buttons |
| `--text-base` | 15px | Body, buttons |
| `--text-l` | 17px | Serif list titles, lead text |
| `--text-xl` | 22px | Section titles (`.title-s`) |

Page titles (`.title`) use `clamp(26px, 7.4vw, 34px)`. Inputs stay at **16px** so iOS doesn't zoom.
Text inside notes scales with zoom and keeps its own document sizes.

| Weight | Value | Use |
|---|---|---|
| `--w-regular` | 400 | Body text |
| `--w-medium` | 500 | Labels, chips, serif titles |
| `--w-bold` | 600 | Buttons, emphasis, numbers |

Nothing else. Headings inside the note body are document styles and may differ.

## Shape

| Token | Value | Use |
|---|---|---|
| `--r-2xs` | 2px | Hairline bars, chart marks |
| `--r-xs` | 4px | Tags, small marks, code |
| `--r-s` | 8px | Small controls, thumbnails, focus rings |
| `--r-m` | 12px | Inputs, segmented controls, menus |
| `--r-l` | 16px | Cards |
| `--r-xl` | 28px | Sheets, banners |
| `--r-pill` | 999px | Buttons, chips, the tab bar |

Avatars and dots use `50%`. Nested corners: inner radius = outer radius − padding (or `inherit`).

## Elevation

| Token | Use |
|---|---|
| none + `1px solid var(--line)` | Default card (`.card`) |
| `--shadow-1` | Resting controls: the selected segment, raised chips |
| `--shadow-2` (`--shadow`) | Floating cards, menus, hints |
| `--shadow-3` | Sheets, dialogs, popovers, dragged items |
| `--glass-shadow` | Glass chrome (in `glass.css`) |

Focus rings, inset highlights and coloured glows are not elevation and stay bespoke.

## Spacing and size

- Page gutter: `--gutter` (16px); page content max 640px on phones (wider layouts in `desktop.css` from 1024px).
- Controls: `--h-s` (34px) for small buttons, chips and tabs; `--h-m` (44px) for buttons and fields, the
  minimum touch target.
- Spacing steps used across the app: 4, 6, 8, 12, 16, 18, 24px. Prefer `gap` on a grid/flex parent over
  margins on children.
- Safe areas: `--safe-t` / `--safe-b`; the floating tab bar reserves `--nav-h`.

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
- **Page transitions:** push 0.22s, pop 0.2s, tab switch a ~0.18s fade-through (`app.css`, "page transitions").
- **Staggered entrances:** 20–25ms per item, capped around 80–100ms, using `--dur-2`/`--dur-3`.
- **Only animate `transform` and `opacity`** in anything that loops or runs while scrolling. Never
  animate `filter`, `box-shadow`, `width`, `stroke-width` or `background-position` in a loop.
- **No infinite loops at rest.** Decoration runs a few times and stops (e.g. the nav wheel plays twice
  after a page appears, `--nw-runs`, and comes alive again on hover/focus). Loops that show state are fine:
  a record turning while it plays, a live dot, a spinner.
- `prefers-reduced-motion` turns animation off globally (end of `app.css`); the sky canvas stops too.

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
| `.chip`, `.chips` (`.scroll-x`) | Filter and choice pills; `aria-pressed="true"` turns them ink |
| `.seg` (`.compact`, `.tabs`) | Segmented control; selected item uses `aria-selected` |
| `.input`, `.input-s` | Text fields |
| `.card` | Solid surface, `--r-l`, hairline border |
| `.meter` | Thin progress bar that grows in from the left |
| `.page`, `.page-head`, `.title`, `.title-s`, `.subtitle`, `.eyebrow` | Page shell and headings; list screens use `PageHead` |
| `.empty`, `.empty-note` | Empty states |
| `.stack-l`, `.row` | Layout helpers |
| `.glass`, `.glass-btn` (`glass.css`) | Floating chrome |
| `Sheet`, `Confirm`, `Toasts` (components) | Bottom sheets, confirmations, toasts |

States: press = `scale(0.98)` over `--dur-0`; hover = one step up in surface (`--surface-2` → `--surface-3`);
selected = ink background with `--on-ink` text; focus = `:focus-visible` 2px ink outline with 2px offset.

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
- [ ] Looks right in dark mode
- [ ] Touch targets ≥ `--h-m` on phones
- [ ] Content is opaque; only chrome uses glass
- [ ] Nothing loops at rest; loops animate `transform`/`opacity` only
- [ ] Visible `:focus-visible` state; works with reduced motion
- [ ] Screen-specific CSS imported by its view, not globally
