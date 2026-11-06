try {
  var s = JSON.parse(localStorage.getItem('mm-settings') || '{}');
  var t = s.theme || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // the status bar too, so it doesn't sit light above a dark page until the app loads (same colours as applyTheme)
  if (dark) document.querySelector('meta[name="theme-color"]').setAttribute('content', '#141413');
} catch (e) {}

// The first screen's files, fetched now alongside the app's own instead of once the app has started and asks for them.
// (In a function, so none of these names land on window: a global `screen` would replace window.screen.)
(function () {
  // The build fills these in (vite.config.ts): the files under /assets/, then by screen which of them it needs, and the
  // Romanian dictionary and letters (lib/i18n.ts loads the dictionary only on a device that reads Romanian).
  var FILES = [];
  var SCREENS = {};
  var ROMANIAN = [];
  try {
    var path = location.pathname;
    var head = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
    var learn = path.match(/^\/learn\/(\w+)/);
    // the screen main.tsx and lib/router.ts will open
    var screen = /^\/s\//.test(path) ? '/s' : /^\/status\//.test(path) ? '/status' : learn ? learn[1]
      : head[0] === 'books' ? 'media' : head[0] === 'people' && head[1] === 'mind' ? 'mind' : SCREENS[head[0]] ? head[0] : 'journal';
    var want = SCREENS[screen] || [];
    // opening the app on the journal plays the brain's opening first (main.tsx), once per visit
    if (screen === 'journal' && sessionStorage.getItem('mm-intro-seen') !== '1' && !matchMedia('(prefers-reduced-motion: reduce)').matches) want = want.concat(SCREENS.opening || []);
    // the language lib/i18n.ts will pick: the page's own (a public status), a shared Learn link's, else this device's
    var lang = document.documentElement.getAttribute('data-mm-lang') || (learn && new URLSearchParams(location.search).get('lang')) || localStorage.getItem('mm-lang');
    if (lang === 'ro') want = want.concat(ROMANIAN);
    for (var i = 0; i < want.length; i++) {
      var file = FILES[want[i]];
      var link = document.createElement('link');
      // the same request the app makes for it later (crossorigin included), so that one is answered by this one
      link.rel = /\.js$/.test(file) ? 'modulepreload' : 'preload';
      if (/\.css$/.test(file)) link.setAttribute('as', 'style');
      if (/\.woff2$/.test(file)) { link.setAttribute('as', 'font'); link.type = 'font/woff2'; }
      link.crossOrigin = '';
      link.href = '/assets/' + file;
      document.head.appendChild(link);
    }
  } catch (e) {}
})();
