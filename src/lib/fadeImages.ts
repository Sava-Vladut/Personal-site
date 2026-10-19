// Pictures fade in once they've loaded instead of popping in. One observer tags every <img> as it's added: one that's
// already loaded (cached, or a blob that's ready) is left alone and shows at once; one still loading gets
// data-img="wait", which hides it, until its load turns that into "in", which plays the fade (styles/fade-images.css).
// A picture that fails to load is shown again, so its alt text or broken icon isn't hidden. Only pictures this file has
// tagged are ever hidden, so if it never runs every picture simply shows as it loads.

const ATTR = 'data-img';
/** Pictures that don't fade: the photo viewer and the map fade their own, and in a note being written a picture is
 * part of the text (it shows as soon as it's there, and never again as the note re-renders). */
const SKIP = '.pswp, .map-tile, .ProseMirror[contenteditable="true"], [data-no-fade]';

/** Tag a picture for what it is now: loaded or broken (show it), or still loading (hide it until it is). */
function check(img: HTMLImageElement) {
  if (img.complete || (!img.getAttribute('src') && !img.srcset) || img.closest(SKIP)) img.removeAttribute(ATTR);
  else img.setAttribute(ATTR, 'wait');
}

function scan(node: Node) {
  if (node instanceof HTMLImageElement) check(node);
  else if (node instanceof Element && node.firstElementChild) for (const img of node.getElementsByTagName('img')) check(img);
}

/** Fades images in once they've loaded. */
export function startImageFade() {
  // Capture, as load and error don't bubble. Only a picture still waiting is changed: anything else that loads again
  // (a new size from srcset, say) stays as it is.
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.getAttribute(ATTR) === 'wait') img.setAttribute(ATTR, 'in');
  }, true);
  document.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement) e.target.removeAttribute(ATTR);
  }, true);
  // Once faded in (or cut short, say by its tab being hidden), the tag goes, so being shown again doesn't fade it twice.
  const settle = (e: AnimationEvent) => {
    if (e.animationName === 'img-fade-in' && e.target instanceof HTMLImageElement) e.target.removeAttribute(ATTR);
  };
  document.addEventListener('animationend', settle, true);
  document.addEventListener('animationcancel', settle, true);

  // New pictures, and ones given a new address (Preact reuses an <img> for the next song's art, say): a new address
  // that's cached shows at once, one that has to load fades in again. A picture moved or copied (a dragged picture's
  // ghost) is already loaded, so it's shown as it is, without replaying the fade.
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { if (r.target instanceof HTMLImageElement) check(r.target); }
      else for (const node of r.addedNodes) scan(node);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  scan(document.documentElement);
}
