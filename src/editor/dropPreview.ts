// Where a picture being dragged would land, drawn in the note itself: a faint copy of it at that place, as wide as it
// will be and on its side, so the words around it already wrap the way they will once it's dropped. The picture being
// moved is lifted out of the page meanwhile (still there, only not drawn), so what's seen is the note after the drop.
// Only the page (views/Editor.tsx, through NoteBody's handle) sets it, and only when the place or side changes, not
// on every move of the finger: each change is one redraw of the note.
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { t } from '../lib/i18n';

export interface DropPreview {
  /** the drop place it would land at (lib/noteDoc/edit dropPlaces), or null while it's over no place (over a picture) */
  at: number | null;
  side: 'left' | 'center' | 'right';
  /** its width there, in % of the column */
  size: number;
  /** its width over its height */
  ratio: number;
  /** the position before the picture picked up, taken out of the page while it's dragged; null: none is (one of a row's) */
  lifted: number | null;
  /** a copy of the picture, drawn faintly in the place */
  pic?: () => Node | null;
}

const key = new PluginKey<DropPreview | null>('dropPreview');

/** Shows (or, with null, takes away) where the picture would land. Changes nothing in the note itself. */
export const setDropPreview = (state: EditorState, p: DropPreview | null): Transaction =>
  state.tr.setMeta(key, p).setMeta('addToHistory', false);

/** The place in it now (after any change the note had meanwhile), or null. */
export const dropPreviewOf = (state: EditorState) => key.getState(state) ?? null;

function draw(p: DropPreview): HTMLElement {
  const el = document.createElement('div');
  el.className = `media-preview is-${p.side}`;
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  const ratio = Math.max(0.2, p.ratio || 4 / 3).toFixed(4);
  Object.assign(el.style, { width: p.size + '%', aspectRatio: ratio, maxWidth: `calc(70svh * ${ratio})` });
  const pic = p.pic?.();
  if (pic) el.append(pic);
  const label = document.createElement('span');
  label.className = 'media-preview-label glass';
  label.textContent = p.side === 'center' ? t('On its own line') : t('Text wraps around');
  el.append(label);
  return el;
}

export function dropPreviewPlugin(): Plugin {
  return new Plugin<DropPreview | null>({
    key,
    state: {
      init: () => null,
      apply(tr, was) {
        const meta = tr.getMeta(key) as DropPreview | null | undefined;
        if (meta !== undefined) return meta;
        if (!was || !tr.docChanged) return was;
        // the note changed under the drag (a copy from another device): the places move along with it
        const lifted = was.lifted === null ? null : tr.mapping.mapResult(was.lifted, 1);
        if (lifted?.deleted) return null;
        return { ...was, at: was.at === null ? null : tr.mapping.map(was.at, -1), lifted: lifted ? lifted.pos : null };
      },
    },
    props: {
      decorations(state) {
        const p = key.getState(state);
        if (!p) return null;
        const decos: Decoration[] = [];
        const node = p.lifted === null ? null : state.doc.nodeAt(p.lifted);
        if (node?.type.name === 'media') decos.push(Decoration.node(p.lifted!, p.lifted! + node.nodeSize, { class: 'is-lifted' }));
        if (p.at !== null && p.at <= state.doc.content.size) {
          // drawn again only when how it looks changes, not when it only moves to another place
          decos.push(Decoration.widget(p.at, () => draw(p), { key: `drop:${p.side}:${p.size}:${p.ratio.toFixed(3)}`, ignoreSelection: true, stopEvent: () => true }));
        }
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}
