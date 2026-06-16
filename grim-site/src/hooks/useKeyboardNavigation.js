import { useEffect } from 'react'
import { isKeyboardCommand, isTypingTarget } from '../utils/keyboard.js'

export function useKeyboardNavigation({ navItems, onNavigate }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target) || !isKeyboardCommand(event)) return

      const command = event.key.toLowerCase()
      const match = navItems.find((item) => item.shortcut === command)

      if (match) {
        event.preventDefault()
        if (match.href) {
          window.open(match.href, '_blank', 'noopener,noreferrer')
        } else {
          onNavigate(match.target)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [navItems, onNavigate])
}
