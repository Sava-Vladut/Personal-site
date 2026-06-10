export function isTypingTarget(target) {
  return (
    target instanceof HTMLElement
    && (target.isContentEditable
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function isKeyboardCommand(event) {
  return event.ctrlKey || event.altKey || event.metaKey || (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey)
}
