#!/usr/bin/env node
// Counts the motion in the styles that costs frames (design.md, Motion): loops that never stop, animations and
// transitions of properties the compositor can't do alone (they re-style or repaint every frame), animated custom
// properties, and backdrop blurs. It only reports. Run it before and after a change to see what moved.
//
//   node scripts/motion-audit.mjs            summary and every finding
//   node scripts/motion-audit.mjs --json     machine-readable, for comparing runs
//   node scripts/motion-audit.mjs --dir=path audit another checkout's src/styles
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const DIR = args.dir ?? join(ROOT, 'src/styles')

// what the compositor animates by itself
const CHEAP = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity', 'offset-distance', 'visibility'])
// loops that show something happening are allowed to run (design.md: a spinner, a live dot, a record that plays,
// a first-time nudge until it's answered, a text caret, a notice that's due, something only while it's pointed at or
// picked); they're still listed, apart from the rest
const STATE = /spin|pulse|ghost|shimmer|loading|beckon|hop|eq\b|is-on|playing|live|busy|wait|cursor|blink|:hover|aria-selected|notice/i

const files = readdirSync(DIR).filter((f) => f.endsWith('.css')).map((f) => join(DIR, f))

function blocks(src) {
  // flatten nested @media/@supports: yield [selector, body, line] for every rule, and @keyframes whole
  const out = []
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  let i = 0, line = 1
  const stack = []
  let buf = '', bufLine = 1
  for (; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '\n') line++
    if (ch === '{') {
      const prelude = buf.trim()
      if (/^@keyframes\s/.test(prelude)) {
        let depth = 1, j = i + 1
        for (; j < clean.length && depth; j++) { if (clean[j] === '{') depth++; else if (clean[j] === '}') depth--; }
        const body = clean.slice(i + 1, j - 1)
        out.push({ keyframes: prelude.split(/\s+/)[1], body, line: bufLine })
        line += (clean.slice(i, j).match(/\n/g) ?? []).length
        i = j - 1
        buf = ''
        continue
      }
      stack.push(prelude)
      buf = ''
      bufLine = line
    } else if (ch === '}') {
      const prelude = stack.pop()
      if (prelude && !prelude.startsWith('@')) out.push({ selector: prelude, body: buf, line: bufLine, media: stack.join(' ') })
      buf = ''
    } else {
      if (!buf.trim()) bufLine = line
      buf += ch
      // a nested rule's declarations end where its parent's next rule starts
      if (ch === ';' && stack.length && stack[stack.length - 1].startsWith('@')) { /* declarations at @-level are rare */ }
    }
  }
  return out
}

const keyframes = new Map() // name -> { props, file, line }
const rules = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const b of blocks(src)) {
    if (b.keyframes) {
      const props = new Set([...b.body.matchAll(/([-\w]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function'))
      keyframes.set(b.keyframes, { props, file, line: b.line })
    } else rules.push({ ...b, file })
  }
}

const decls = (body) => body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const k = d.indexOf(':')
  return [d.slice(0, k).trim(), d.slice(k + 1).trim()]
})
const where = (r) => `${relative(ROOT, r.file)}:${r.line}`
const reduced = (r) => /prefers-reduced-motion:\s*reduce/.test(r.media)

const found = { loops: [], stateLoops: [], paint: [], transitions: [], custom: [], blur: [] }
for (const r of rules) {
  if (reduced(r)) continue
  for (const [prop, value] of decls(r.body)) {
    if (prop === 'animation' || prop === 'animation-name') {
      for (const part of value.split(/,(?![^(]*\))/)) {
        const names = part.trim().split(/\s+/).filter((w) => keyframes.has(w))
        for (const name of names) {
          const kf = keyframes.get(name)
          const heavy = [...kf.props].filter((p) => !CHEAP.has(p))
          const infinite = /\binfinite\b/.test(part)
          const item = { at: where(r), selector: r.selector.replace(/\s+/g, ' ').slice(0, 90), name, heavy }
          if (infinite) (STATE.test(r.selector + ' ' + name) ? found.stateLoops : found.loops).push(item)
          if (heavy.some((p) => p.startsWith('--'))) found.custom.push(item)
          else if (heavy.length) found.paint.push({ ...item, loop: infinite })
        }
      }
    }
    if (prop === 'transition') {
      const props = value.split(/,(?![^(]*\))/).map((p) => p.trim().split(/\s+/)[0])
      const heavy = props.filter((p) => !CHEAP.has(p) && !/^(color|background-color|border-color|fill|stroke|outline-color|text-decoration-color|none)$/.test(p))
      if (heavy.length) found.transitions.push({ at: where(r), selector: r.selector.replace(/\s+/g, ' ').slice(0, 90), heavy })
    }
    if (/^(-webkit-)?backdrop-filter$/.test(prop) && !/^none$/.test(value) && !prop.startsWith('-webkit-')) {
      found.blur.push({ at: where(r), selector: r.selector.replace(/\s+/g, ' ').slice(0, 90), value })
    }
  }
}

const TITLES = {
  loops: 'Decorative loops that never stop (should run a few times, then rest)',
  stateLoops: 'Loops that show state (spinners, live dots, playing music): allowed',
  paint: 'Animations of properties that repaint or re-lay out each frame',
  custom: 'Animated custom properties (re-style everything that reads them, each frame)',
  transitions: 'Transitions of properties that repaint or re-lay out (fine one-shot; not on many elements)',
  blur: 'Backdrop blurs (must never sit over moving content)',
}
if (args.json) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length]))))
} else {
  for (const [k, list] of Object.entries(found)) {
    console.log(`\n## ${k} — ${list.length}\n${TITLES[k]}`)
    for (const f of list) console.log(`  ${f.at}  ${f.selector}  ${f.name ?? ''} ${(f.heavy ?? []).join(',')}${f.value ? f.value : ''}${f.loop ? '  (loop)' : ''}`)
  }
}
