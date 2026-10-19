try {
  var s = JSON.parse(localStorage.getItem('mm-settings') || '{}');
  var t = s.theme || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // the status bar too, so it doesn't sit light above a dark page until the app loads (same colours as applyTheme)
  if (dark) document.querySelector('meta[name="theme-color"]').setAttribute('content', '#141413');
} catch (e) {}
