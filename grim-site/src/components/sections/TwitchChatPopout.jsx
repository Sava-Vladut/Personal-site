import { useCallback, useMemo } from 'react'
import { TwitchChat } from './TwitchChat.jsx'

// Standalone chat window, reached at #/chatpop/<channel> (opened by the "pop
// out" button on the chat service). It runs its own IRC socket, so it keeps
// streaming no matter what the opener tab does. Clicking a chatter here opens
// a second utility window with that user's latest archived messages; the live
// chat stays visible and connected behind it.
export function TwitchChatPopout() {
  const channel = useMemo(
    () =>
      decodeURIComponent(window.location.hash.replace(/^#\/?chatpop\/?/, ''))
        .trim()
        .toLowerCase(),
    [],
  )

  const onOpenLogs = useCallback((subject) => {
    const color = subject.color ? `?color=${encodeURIComponent(subject.color)}` : ''
    const logsWindow = window.open(
      `#/chatlogspop/${encodeURIComponent(subject.channel)}/${encodeURIComponent(subject.user)}${color}`,
      `grim-logs-${subject.channel}-${subject.user}`,
      'popup=yes,width=760,height=680',
    )
    if (logsWindow) logsWindow.focus()
  }, [])

  return <TwitchChat popout initialChannel={channel} onOpenLogs={onOpenLogs} />
}
