import { useEffect } from 'react'
import { scrollToSection } from '../utils/navigation.js'

export function useKeyboardNavigation({ navItems, onInvert }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey) return

      const command = event.key.toLowerCase()
      const match = navItems.find((item) => item.shortcut === command)

      if (match) {
        event.preventDefault()
        scrollToSection(match.target)
      }

      if (command === 'i') {
        event.preventDefault()
        onInvert()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navItems, onInvert])
}
