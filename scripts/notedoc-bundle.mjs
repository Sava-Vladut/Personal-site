import { rolldown } from 'rolldown';

// Loads the note document code (src/lib/noteDoc) in Node for tests: bundled with rolldown (ProseMirror and Tiptap
// included) and imported from a data: URL, so nothing is written to disk. The module gives:
//   • everything src/lib/noteDoc/index.ts exports (noteSchema, parseNote, serializeNote, normalizeDoc, …)
//   • stateFrom / show from src/lib/noteDoc/testing.ts: stateFrom('- a|b') is an EditorState with the caret
//     between a and b, show(state) writes it back ('|' caret, '«' anchor … '»' head)
//   • pmModel, pmState, pmTransform: ProseMirror's modules, the same copies the code above uses
//   • parseBody, serializeBody (lib/body.ts)
//   • markdownParse, with { markdown: true }: components/Markdown.tsx's own `parse` (the reading view's blocks),
//     exposed by a transform (the file isn't changed) with its components and i18n stubbed out
// More modules can be added with `entries`, e.g. { entries: ["export * from '<root>/src/lib/noteDoc/edit/lists.ts';"] }
// (`root` is exported here for that). `stubs` swaps modules for code of their own, by the end of their path, e.g.
// { stubs: { '/src/lib/store.ts': 'export const getBooks = () => [];' } } (for modules that need the browser to load).
export const root = new URL('../', import.meta.url).pathname;

const STUBS = {
  'preact/jsx-runtime': 'export const jsx = () => null, jsxs = jsx, Fragment = () => null;',
  'react/jsx-runtime': 'export const jsx = () => null, jsxs = jsx, Fragment = () => null;',
  mentions: 'export const PersonMention = () => null, SongMention = () => null, WikiLink = () => null;',
  i18n: 'export const t = (s) => s;',
};

export async function loadNoteDoc({ entries = [], markdown = false, stubs = {} } = {}) {
  const entry = [
    `export * from '${root}src/lib/noteDoc/index.ts';`,
    `export { stateFrom, show } from '${root}src/lib/noteDoc/testing.ts';`,
    `export { parseBody, serializeBody } from '${root}src/lib/body.ts';`,
    `export * as pmModel from '@tiptap/pm/model';`,
    `export * as pmState from '@tiptap/pm/state';`,
    `export * as pmTransform from '@tiptap/pm/transform';`,
    markdown ? `export { parse as markdownParse } from '${root}src/components/Markdown.tsx';` : '',
    ...entries,
  ].join('\n');
  const bundle = await rolldown({
    input: 'notedoc:entry',
    cwd: root,
    logLevel: 'silent',
    plugins: [{
      name: 'notedoc-entry',
      resolveId(id, importer) {
        if (id === 'notedoc:entry') return '\0notedoc:entry';
        if (id in STUBS) return '\0stub:' + id;
        if (importer?.endsWith('/Markdown.tsx') && (id === './mentions' || id === '../lib/i18n')) return '\0stub:' + id.split('/').pop();
        return null;
      },
      load(id) {
        if (id === '\0notedoc:entry') return entry;
        if (id.startsWith('\0stub:')) return STUBS[id.slice(6)];
        for (const [end, code] of Object.entries(stubs)) if (id.endsWith(end)) return code;
        return null;
      },
      transform(code, id) {
        if (id.endsWith('/components/Markdown.tsx')) return code + '\nexport { parse };';
        return null;
      },
    }],
  });
  try {
    // named, so stack traces show `notedoc-bundle.js:line` instead of the whole data: URL
    const code = (await bundle.generate({ format: 'esm' })).output[0].code + '\n//# sourceURL=notedoc-bundle.js\n';
    return await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  } finally {
    await bundle.close();
  }
}
