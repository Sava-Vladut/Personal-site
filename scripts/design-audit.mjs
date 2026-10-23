#!/usr/bin/env node
// Lists places where the styles drift from design.md: raw values where a token exists, sizes off the
// scales, hover rules that stick on touch screens, and so on. It only reports; it never fails the build,
// because some literals are allowed (artwork, brand marks, the Word look of notes). Judge each one against
// design.md before changing it.
//
//   node scripts/design-audit.mjs                 summary + the first findings of every rule
//   node scripts/design-audit.mjs --rule=radius   every finding for one rule
//   node scripts/design-audit.mjs --json          machine-readable, for comparing runs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const PER_RULE = args.rule ? Infinity : Number(args.max ?? 5)

// the scales from design.md
const SPACING = new Set([0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 44, 48, 56, 64])
const ICONS = new Set([12, 14, 16, 18, 20, 22, 24, 28, 32])
const BREAKPOINTS = new Set([380, 560, 720, 1024, 1280])
const LAYERS = new Set([30, 35, 36, 40, 50, 60, 65, 70, 75, 80, 90, 1000, 1100])

const RULES = {
  hex: 'Literal hex colour outside a token or custom property',
  'font-size': 'Raw px font size (use --text-*; 16px is only for inputs)',
  weight: 'Numeric font weight (use --w-regular/medium/bold)',
  radius: 'Raw px radius (use --r-*; 50% for circles)',
  shadow: 'Raw drop shadow (use --shadow-1/2/3 or --glass-shadow)',
  duration: 'Raw interface duration, 1s or less (use --dur-*)',
  spacing: 'Spacing off the scale',
  hover: ':hover outside @media (hover: hover) (sticks after a tap on phones)',
  breakpoint: 'Breakpoint off the list (380, 560, 720, 1024, 1280)',
  layer: 'z-index above 10 that is not a documented layer',
  icon: 'Icon size off the scale (12, 14, 16, 18, 20, 22, 24)',
  'inline-style': 'Raw size, weight, radius or colour in a TSX inline style',
}
const findings = Object.fromEntries(Object.keys(RULES).map((r) => [r, []]))
const add = (rule, file, line, text) => findings[rule].push({ file: relative(ROOT, file), line, text: text.trim().slice(0, 140) })

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, ext, out)
    else if (p.endsWith(ext)) out.push(p)
  }
  return out
}

// ---------- CSS ----------

function auditCss(file) {
  // blank out comments but keep newlines so line numbers stay true
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const stack = [] // { prelude, isAt }
  let buf = ''
  let line = 1
  let startLine = 1
  for (const ch of src) {
    if (ch === '\n') line++
    if (ch === '{') {
      const prelude = buf.trim()
      stack.push({ prelude, isAt: prelude.startsWith('@') })
      if (prelude.startsWith('@media')) checkMedia(file, startLine, prelude)
      if (prelude.includes(':hover') && !stack.some((s) => /hover:\s*hover/.test(s.prelude))) add('hover', file, startLine, prelude)
      buf = ''
      startLine = line
    } else if (ch === ';' || ch === '}') {
      if (buf.includes(':')) checkDecl(file, startLine, buf.trim(), stack)
      if (ch === '}') stack.pop()
      buf = ''
      startLine = line
    } else {
      if (!buf.trim()) startLine = line
      buf += ch
    }
  }
}

function checkMedia(file, line, prelude) {
  for (const m of prelude.matchAll(/(min|max)-width:\s*([\d.]+)px/g)) {
    const px = Math.round(Number(m[2]) + (m[1] === 'max' ? 0.02 : 0))
    if (!BREAKPOINTS.has(px)) add('breakpoint', file, line, prelude)
  }
}

function checkDecl(file, line, decl, stack) {
  const i = decl.indexOf(':')
  const prop = decl.slice(0, i).trim()
  const value = decl.slice(i + 1).trim()
  if (prop.startsWith('--')) return // defining a token or a local custom property
  if (stack.some((s) => /^@keyframes|prefers-reduced-motion/.test(s.prelude))) return
  const selector = stack.filter((s) => !s.isAt).map((s) => s.prelude).join(' ')

  if (/#[0-9a-f]{3,8}\b/i.test(value) && !/mask/.test(prop)) add('hex', file, line, `${selector} { ${decl} }`)

  if (prop === 'font-size' || prop === 'font') {
    const px = value.match(/(?:^|\s)([\d.]+)px/)
    if (px && !/clamp\(/.test(value) && !(px[1] === '16' && /input|select|textarea|search/.test(selector))) add('font-size', file, line, `${selector} { ${decl} }`)
  }
  if (prop === 'font-weight' && /^\d+$/.test(value)) add('weight', file, line, `${selector} { ${decl} }`)
  if (prop === 'font' && /^\d{3}\s/.test(value)) add('weight', file, line, `${selector} { ${decl} }`)

  if (/^border(-[a-z]+)?-radius$/.test(prop) && /\d+px/.test(value) && !/var\(--r-/.test(value)) add('radius', file, line, `${selector} { ${decl} }`)

  if (prop === 'box-shadow' && !/var\(--(shadow|glass-shadow)/.test(value)) {
    // a drop shadow: some offset, a real blur and a dark colour; rings and inset highlights are fine
    const drop = value.split(/,(?![^(]*\))/).some((part) => !/inset/.test(part) && /rgb\(0 0 0|rgba\(0, ?0, ?0|black/.test(part) && /\s(\d{2,}|[3-9])px/.test(part))
    // the exceptions design.md allows: drawn objects, physical knobs and the page-slide edge
    const allowed = /book-cover|record-|cassette|\.shelf|due-card|map-pin|map-marker|sotd-disc|media-corner|slider-thumb|range-thumb|\.switch::after|view-transition/.test(selector)
    if (drop && !allowed) add('shadow', file, line, `${selector} { ${decl} }`)
  }

  // page slides, the nav wheel, the opening and the intro, and once-a-second clocks keep their own timing (design.md, Motion)
  const ownTiming = /view-transition|\.nw-|\.app-opening|\.intro/.test(selector) || /\b1s linear\b/.test(value)
  if (/^(transition|transition-duration|animation|animation-duration)$/.test(prop) && !/infinite/.test(value) && !ownTiming) {
    // the first time in each comma-separated part is the duration (the second is a delay); anything
    // longer than 1s is a decorative loop, which keeps its own timing
    for (const part of value.split(/,(?![^(]*\))/)) {
      if (/var\(--dur-/.test(part)) continue
      let bare = part
      while (/\([^()]*\)/.test(bare)) bare = bare.replace(/[a-z-]*\([^()]*\)/g, '')
      const t = bare.match(/(?:^|\s)(\d*\.?\d+)(m?s)\b/)
      const secs = t && Number(t[1]) / (t[2] === 'ms' ? 1000 : 1)
      if (secs && secs <= 1) { add('duration', file, line, `${selector} { ${decl} }`); break }
    }
  }

  if (/^(gap|row-gap|column-gap|padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/.test(prop) && !/calc\(|env\(/.test(value)) {
    const off = [...value.matchAll(/(?:^|\s|-)(\d+)px/g)].map((m) => Number(m[1])).filter((n) => !SPACING.has(n))
    if (off.length) add('spacing', file, line, `${selector} { ${decl} }`)
  }

  if (prop === 'z-index' && Number(value) > 10 && !LAYERS.has(Number(value))) add('layer', file, line, `${selector} { ${decl} }`)
}

// ---------- TSX ----------

function auditTsx(file) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((text, n) => {
    for (const m of text.matchAll(/<Icon\b[^>]*\bsize=\{(\d+)\}/g)) if (!ICONS.has(Number(m[1]))) add('icon', file, n + 1, text)
    if (/style=\{\{[^}]*\b(fontSize|fontWeight|borderRadius):\s*['"]?\d/.test(text)) add('inline-style', file, n + 1, text)
    else if (/style=\{\{[^}]*['"]#[0-9a-f]{3,8}['"]/i.test(text)) add('inline-style', file, n + 1, text)
  })
}

walk(join(ROOT, 'src/styles'), '.css').forEach(auditCss)
walk(join(ROOT, 'src'), '.tsx').forEach(auditTsx)

if (args.json) {
  console.log(JSON.stringify(findings, null, 2))
} else {
  const rules = args.rule ? [args.rule] : Object.keys(RULES)
  console.log('Design audit (design.md). Counts, then examples; some literals are allowed, check before fixing.\n')
  for (const r of Object.keys(RULES)) console.log(`${String(findings[r].length).padStart(5)}  ${r.padEnd(13)} ${RULES[r]}`)
  console.log(`${String(Object.values(findings).flat().length).padStart(5)}  total\n`)
  for (const r of rules) {
    if (!findings[r]?.length) continue
    console.log(`## ${r}`)
    for (const f of findings[r].slice(0, PER_RULE)) console.log(`  ${f.file}:${f.line}  ${f.text}`)
    if (findings[r].length > PER_RULE) console.log(`  … ${findings[r].length - PER_RULE} more (--rule=${r})`)
    console.log()
  }
}
