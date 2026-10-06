// lib/i18n as it behaves in English, for test harnesses that replace every import with a mock.
const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

export const i18n = {
  lang: 'en',
  LOCALE: 'en-GB',
  LANGS: [['en', 'English'], ['ro', 'Română']],
  setLang() {},
  t: fill,
  rich: (s, parts) => s.split(/\{(\w+)\}/).map((x, i) => (i % 2 ? parts[x] : x)),
  count: (n, one, many) => `${n} ${n === 1 ? one : many}`,
  noun: (n, one, many) => (n === 1 ? one : many),
  listOf: (items) => new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(items),
};
