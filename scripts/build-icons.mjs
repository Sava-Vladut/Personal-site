// Generates the icon data used by the note icon picker.
//   src/data/icons-curated.json  — hand-picked categories, bundled as a lazy chunk
//   public/icons/all.json        — every icon, fetched only when "Search all" is used
// Sources (both MIT): Tabler Icons (line, "t:") and Microsoft Fluent Emoji High Contrast ("e:").
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const tabler = JSON.parse(readFileSync('node_modules/@iconify-json/tabler/icons.json', 'utf8'));
const fluent = JSON.parse(readFileSync('node_modules/@iconify-json/fluent-emoji-high-contrast/icons.json', 'utf8'));

const WRAP = '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">';
const SINGLE = /^<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="([^"]+)"\/>$/;

// Tabler bodies are stored without their stroke wrapper; the app re-adds it (at a lighter stroke).
function tablerBody(name) {
  const icon = tabler.icons[name];
  if (!icon) return null;
  const b = icon.body;
  if (b.startsWith(WRAP) && b.endsWith('</g>')) return b.slice(WRAP.length, -4);
  const m = b.match(SINGLE);
  if (m) return `<path d="${m[1]}"/>`;
  return null; // a handful use <defs>/ids; skip them
}
const fluentBody = (name) => fluent.icons[name]?.body ?? null;

const body = (id) => (id.startsWith('t:') ? tablerBody(id.slice(2)) : fluentBody(id.slice(2)));

const e = (s) => s.trim().split(/\s+/).map((n) => 'e:' + n);
const t = (s) => s.trim().split(/\s+/).map((n) => 't:' + n);

const categories = [
  ['Feelings', e(`
    grinning-face beaming-face-with-smiling-eyes smiling-face-with-smiling-eyes slightly-smiling-face smiling-face
    relieved-face smiling-face-with-halo smiling-face-with-hearts smiling-face-with-heart-eyes star-struck
    face-with-tears-of-joy partying-face hugging-face winking-face upside-down-face zany-face nerd-face
    smiling-face-with-sunglasses thinking-face face-with-monocle face-with-raised-eyebrow neutral-face
    expressionless-face face-without-mouth dotted-line-face face-exhaling melting-face
    unamused-face face-with-rolling-eyes grimacing-face face-with-diagonal-mouth confused-face worried-face
    slightly-frowning-face frowning-face pensive-face disappointed-face sad-but-relieved-face crying-face
    loudly-crying-face face-holding-back-tears smiling-face-with-tear pleading-face anxious-face-with-sweat
    downcast-face-with-sweat fearful-face face-screaming-in-fear anguished-face persevering-face confounded-face
    weary-face tired-face yawning-face sleepy-face sleeping-face woozy-face face-with-spiral-eyes shaking-face
    flushed-face hot-face cold-face nauseated-face face-with-head-bandage face-with-thermometer pouting-face
    angry-face face-with-steam-from-nose face-with-symbols-on-mouth smiling-face-with-horns zipper-mouth-face
    shushing-face face-with-hand-over-mouth face-with-open-eyes-and-hand-over-mouth face-with-peeking-eye
    smirking-face hushed-face astonished-face ghost see-no-evil-monkey hear-no-evil-monkey speak-no-evil-monkey
  `)],
  ['Moods', t(`
    mood-happy mood-smile mood-smile-beam mood-crazy-happy mood-xd mood-wink mood-tongue mood-heart mood-spark
    mood-sing mood-neutral mood-empty mood-unamused mood-annoyed mood-annoyed-2 mood-confused mood-puzzled
    mood-nervous mood-surprised mood-sad mood-sad-2 mood-sad-squint mood-sad-dizzy mood-cry mood-angry mood-wrrr
    mood-sick mood-silence mood-off mood-look-up mood-look-down
  `)],
  ['Heart', [...e(`
    red-heart broken-heart mending-heart heart-on-fire two-hearts sparkling-heart growing-heart heart-with-arrow
    heart-hands people-hugging handshake folded-hands open-hands raising-hands waving-hand
  `), ...t(`
    heart heart-broken heart-handshake hearts heartbeat hand-love-you friends users user mood-heart
  `)]],
  ['Mind', [...e(`
    thought-balloon brain crystal-ball zzz dizzy collision anger-symbol sparkles speech-balloon right-anger-bubble
  `), ...t(`
    brain bulb bulb-off puzzle eye eye-closed zzz yoga infinity spiral focus-2 target compass key lock lock-open
    message-circle messages bubble-text question-mark exclamation-mark hourglass clock anchor feather
  `)]],
  ['Sky', [...e(`
    sun sun-behind-cloud cloud-with-rain cloud-with-lightning-and-rain rainbow crescent-moon full-moon-face
    new-moon-face shooting-star glowing-star fire sunrise night-with-stars
  `), ...t(`
    sun sunrise sunset moon moon-stars cloud cloud-rain cloud-storm cloud-snow cloud-fog rainbow snowflake wind
    tornado droplet umbrella bolt flame sparkles star stars meteor
  `)]],
  ['Nature', [...e(`sunflower seedling herb`), ...t(`
    leaf plant plant-2 seedling flower tree trees mountain ripple butterfly paw cat dog fish feather
    cactus clover sailboat beach
  `)]],
  ['Life', t(`
    home bed coffee mug book book-2 notebook pencil music headphones device-gamepad-2 movie camera palette brush
    briefcase school gift cake confetti balloon plane car bike run walk swimming barbell stretching ball-football
    map-pin calendar phone device-mobile shopping-bag cash pill stethoscope first-aid-kit bath salad pizza
    glass-full beer tools-kitchen-2 dog-bowl baby-carriage
  `)],
  ['Energy', t(`
    battery battery-1 battery-2 battery-3 battery-4 battery-charging bolt flame rocket trending-up trending-down
    activity heartbeat gauge bed zzz
  `)],
];

const bodies = {};
const out = [];
const missing = [];
for (const [name, ids] of categories) {
  const kept = [];
  for (const id of [...new Set(ids)]) {
    const b = body(id);
    if (b) { bodies[id] = b; kept.push(id); } else missing.push(id);
  }
  out.push({ name, icons: kept });
}
if (missing.length) console.warn('missing:', missing.join(' '));

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/icons-curated.json', JSON.stringify({ categories: out, bodies }));

// Full set: every outline Tabler icon (brands and filled variants skipped).
const all = {};
for (const name of Object.keys(tabler.icons)) {
  if (name.endsWith('-filled') || name.startsWith('brand-')) continue;
  const b = tablerBody(name);
  if (b) all['t:' + name] = b;
}
// Fluent emoji are ~8x heavier than Tabler paths, so only the curated faces/hearts join the full set.
for (const id of Object.keys(bodies)) if (id.startsWith('e:')) all[id] = bodies[id];
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/all.json', JSON.stringify(all));

const n = out.reduce((s, c) => s + c.icons.length, 0);
console.log(`curated: ${n} icons in ${out.length} categories · all: ${Object.keys(all).length} icons`);

// Interface icons (navigation, buttons) — tiny, bundled with the app.
const UI = `notebook chart-bar plus settings search x chevron-left chevron-right chevron-down calendar photo trash check
  arrow-left dots download upload photo-search sun moon device-desktop link table info-circle clock sparkles
  mood-smile mood-plus arrow-up-right refresh logout photo-plus calendar-event pencil list layout-grid chart-dots
  lock alert-circle brand-spotify music playlist chart-donut-2 cloud copy key devices users user user-plus
  arrow-up arrow-down float-left float-center float-right grip-vertical maximize
  bold italic strikethrough highlight heading list-numbers list-check blockquote code separator-horizontal book
  share copy-plus library-photo layout-grid-remove stack-pop books star bookmark quote chart-pie crop zoom-in zoom-out pin pinned-off layout-list
  haze mist cloud-rain cloud-snow cloud-storm temperature sunrise map map-pin map-pins current-location home minus
  player-play player-pause external-link vinyl library repeat at typography cake heart hourglass
  microphone player-stop loader-2 trophy dice-5 flame crown arrows-shuffle
  brand-twitch coins gift broadcast trending-up brain eye-off`.split(/\s+/);
const ui = {};
for (const name of UI) {
  const b = tablerBody(name);
  if (b) ui[name] = b; else console.warn('missing ui icon:', name);
}
writeFileSync('src/data/ui-icons.json', JSON.stringify(ui));
console.log(`ui: ${Object.keys(ui).length} icons`);
