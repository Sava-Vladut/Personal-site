import { useEffect } from 'react'
import { isKeyboardCommand, isTypingTarget } from '../utils/keyboard.js'

export function useKeyboardNavigation({ navItems, onNavigate, onInvert }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target) || !isKeyboardCommand(event)) return

      const command = event.key.toLowerCase()
      const match = navItems.find((item) => item.shortcut === command)

      if (match) {
        event.preventDefault()
        onNavigate(match.target)
      }

      if (command === 'i') {
        event.preventDefault()
        onInvert()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [navItems, onInvert, onNavigate])
}
