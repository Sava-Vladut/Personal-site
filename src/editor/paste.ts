// Pasting from other apps. Their HTML is tidied into what the note's schema reads (lib/noteDoc/schema.ts parse rules)
// before ProseMirror parses it: Word's list paragraphs and the web's nested lists become flat list items (a note's
// lists are one line each, their depth in the indent), tables become lines, line breaks become new lines, and pictures
// are left out (pictures are added as files). Plain text is read as the note's own Markdown (lib/noteDoc/edit/clipboard.ts).
import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model';

/** A line break inside a paragraph, carried through the parse (the parser collapses \n to a space) to be split later. */
const BREAK = ' ';

const CHECKED = /☒|☑|✓|✔/;
const BOX = /^[\s ]*[☐☒☑]/;

function depthOf(el: Element): number {
  let d = 0;
  for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'UL' || p.tagName === 'OL') d++;
  return Math.max(0, d - 1);
}

/** A list item's paragraph: kind, depth and whether it's ticked. */
function itemPara(doc: Document, kind: string, depth: number, checked: boolean, from: Node[]): HTMLElement {
  const p = doc.createElement('p');
  p.setAttribute('data-li', kind);
  p.setAttribute('data-depth', String(Math.min(6, depth)));
  if (checked) p.setAttribute('data-checked', 'true');
  p.append(...from);
  return p;
}

/** Word's list paragraphs (`mso-list: l0 level2`) as list items; the bullet or number Word writes before each goes. */
function wordLists(doc: Document) {
  for (const p of doc.querySelectorAll<HTMLElement>('p[style*="mso-list"]')) {
    const style = p.getAttribute('style') ?? '';
    const level = Number(/level(\d+)/.exec(style)?.[1] ?? 1);
    let marker = '';
    for (const ignore of p.querySelectorAll('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]')) {
      marker += ignore.textContent ?? '';
      ignore.remove();
    }
    const kind = BOX.test(marker) ? 'task' : /\d|^[a-z]+[.)]/i.test(marker.trim()) ? 'ol' : 'ul';
    const item = itemPara(doc, kind, level - 1, CHECKED.test(marker), [...p.childNodes]);
    p.replaceWith(item);
  }
}

/** Nested ul/ol/li as flat list items, in order, each with its depth. Checkboxes make them tasks. */
function webLists(doc: Document) {
  // innermost first, so each item's own text is taken apart from the lists inside it
  const lists = [...doc.querySelectorAll('ul, ol')].reverse();
  for (const list of lists) {
    const out: Node[] = [];
    const ol = list.tagName === 'OL';
    for (const li of [...list.children]) {
      if (li.tagName !== 'LI') {
        out.push(li);
        continue;
      }
      const depth = depthOf(li);
      const box = li.querySelector('input[type=checkbox], [role=checkbox]');
      const task = !!box || li.hasAttribute('aria-checked') || /\b(checked|checkbox|task-list-item)\b/.test(li.className);
      const checked = (box instanceof HTMLInputElement && box.checked) || box?.getAttribute('aria-checked') === 'true'
        || li.getAttribute('aria-checked') === 'true' || /\b(checked|checkbox-on)\b/.test(li.className);
      box?.remove();
      const own: Node[] = [], after: Node[] = [];
      for (const n of [...li.childNodes]) {
        // the flattened items of a list inside, or a block of its own, come after the item's line
        if (n instanceof HTMLElement && (n.hasAttribute('data-li') || /^(P|DIV|H\d|BLOCKQUOTE|PRE)$/.test(n.tagName))) {
          if (n.hasAttribute('data-li') || own.length) after.push(n);
          else own.push(...n.childNodes);
        } else own.push(n);
      }
      out.push(itemPara(doc, task ? 'task' : ol ? 'ol' : 'ul', depth, checked, own), ...after);
    }
    list.replaceWith(...out);
  }
}

/** A table as lines: each row a line, its cells apart. */
function tables(doc: Document) {
  for (const table of doc.querySelectorAll('table')) {
    const rows = [...table.querySelectorAll('tr')].map((tr) => {
      const p = doc.createElement('p');
      [...tr.children].forEach((cell, i) => {
        if (i) p.append('  ');
        p.append(...cell.childNodes);
      });
      return p;
    });
    table.replaceWith(...rows);
  }
}

/** Other apps' HTML, tidied for the note's schema (ProseMirror's transformPastedHTML). */
export function tidyPastedHTML(html: string): string {
  const clean = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\/?o:p>/gi, '');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const el of doc.querySelectorAll('img, picture, video, audio, svg, style, script, meta, link, title')) el.remove();
  wordLists(doc);
  webLists(doc);
  tables(doc);
  for (const br of doc.querySelectorAll('br')) br.replaceWith(BREAK);
  return doc.body.innerHTML;
}

/** Text with carried line breaks back to \n: the editor then splits those lines apart (lib/noteDoc/normalize.ts). */
function breaks(f: Fragment): Fragment {
  const out: PMNode[] = [];
  f.forEach((n) => {
    if (n.isText) out.push(n.text!.includes(BREAK) ? n.type.schema.text(n.text!.replaceAll(BREAK, '\n'), n.marks) : n);
    else out.push(n.copy(breaks(n.content)));
  });
  return Fragment.from(out);
}

/**
 * The pasted slice, ready to go in (ProseMirror's transformPasted): line breaks back, and pictures the note doesn't
 * hold (or already shows elsewhere) left out.
 */
export function tidyPasted(slice: Slice, keepMedia: (node: PMNode) => boolean): Slice {
  const content = breaks(slice.content);
  const kept: PMNode[] = [];
  content.forEach((n) => (n.type.name !== 'media' || keepMedia(n)) && kept.push(n));
  if (kept.length === content.childCount) return new Slice(content, slice.openStart, slice.openEnd);
  if (!kept.length) return Slice.empty;
  // an end that went keeps no depth open
  const first = kept[0] === content.firstChild, last = kept[kept.length - 1] === content.lastChild;
  return new Slice(Fragment.from(kept), first ? slice.openStart : 0, last ? slice.openEnd : 0);
}
