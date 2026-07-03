import { useCallback, useMemo } from 'react'
import { TwitchChat } from './TwitchChat.jsx'

// Standalone chat window, reached at #/chatpop/<channel> (opened by the "pop
// out" button on the chat service). It runs its own IRC socket, so it keeps
// streaming no matter what the opener tab does. Clicking a chatter here
// broadcasts the subject back to any open services tab, which flips to the
// Logs service and pulls the user — the popup itself stays on chat.
export function TwitchChatPopout() {
  const channel = useMemo(
    () =>
      decodeURIComponent(window.location.hash.replace(/^#\/?chatpop\/?/, ''))
        .trim()
        .toLowerCase(),
    [],
  )

  const onOpenLogs = useCallback((subject) => {
    try {
      const bc = new BroadcastChannel('grim-tchat')
      bc.postMessage({ type: 'open-logs', ...subject })
      bc.close()
    } catch {
      /* BroadcastChannel unsupported — the click just does nothing here */
    }
    if (window.opener && !window.opener.closed) window.opener.focus()
  }, [])

  return <TwitchChat popout initialChannel={channel} onOpenLogs={onOpenLogs} />
}
