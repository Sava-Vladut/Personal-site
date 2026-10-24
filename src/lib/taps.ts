// Taps that mustn't do two things at once.

/**
 * Swallows the click that ends the touch under way. The finger lifting after a hold still clicks, and by then a
 * sheet's backdrop is under it (it mustn't close the sheet); a tap that only puts a card away mustn't also press what
 * was under the card.
 */
export function swallowLiftClick() {
  const stop = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  const lifted = () => {
    clearTimeout(lost);
    removeEventListener('pointerup', lifted, true);
    removeEventListener('pointercancel', lifted, true);
    setTimeout(() => removeEventListener('click', stop, true), 350);
  };
  // a press whose lift never reaches the page (on a scrollbar) mustn't leave the next click, much later, swallowed
  const lost = setTimeout(lifted, 1500);
  addEventListener('click', stop, { capture: true, once: true });
  addEventListener('pointerup', lifted, true);
  addEventListener('pointercancel', lifted, true);
}
