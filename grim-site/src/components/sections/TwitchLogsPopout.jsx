import { useEffect, useMemo } from 'react'
import { TwitchLogs } from './TwitchLogs.jsx'

// Standalone user archive opened from the detached IRC chat window. The hash
// carries the channel and chatter so the latest stored logs can load without a
// second form submission; the optional color keeps the clicked Twitch identity
// visible in the archive header.
export function TwitchLogsPopout() {
  const subject = useMemo(() => {
    const raw = window.location.hash.replace(/^#\/?chatlogspop\/?/, '')
    const [path, query = ''] = raw.split('?')
    const [channel = '', user = ''] = path.split('/').map((part) => decodeURIComponent(part))
    const color = new URLSearchParams(query).get('color') || ''

    return {
      channel: channel.trim().toLowerCase(),
      user: user.trim().toLowerCase(),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : '',
      nonce: `${channel}:${user}`,
    }
  }, [])

  useEffect(() => {
    document.title = `@${subject.user || 'unknown'} · #${subject.channel || 'unknown'} logs`
  }, [subject])

  return <TwitchLogs preset={subject} popout accent={subject.color} />
}
