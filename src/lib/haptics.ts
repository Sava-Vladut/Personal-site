/*
 * A short haptic tap. Android has navigator.vibrate; iOS Safari doesn't, but since iOS 18
 * flipping a native switch plays the system tick, so a hidden one stands in there.
 */
let ios: HTMLLabelElement | null = null;

export function haptic(ms = 8) {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
    return;
  }
  if (!ios) {
    ios = document.createElement('label');
    ios.setAttribute('aria-hidden', 'true');
    ios.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    ios.append(input);
    document.body.append(ios);
  }
  ios.click();
}
