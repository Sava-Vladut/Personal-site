/**
 * Keeps the note's text focused (and the phone's keyboard up) while a button of the ribbon or the bar is tapped.
 * Safari doesn't focus a tapped button, so the text losing the focus would read as "not writing" and put the bar away
 * (inert) before the tap's click arrived.
 */
export const keepFocus = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
};
