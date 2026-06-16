import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { TerminalIcon } from './TerminalIcon.jsx'

export function CopyCommand({ command, label }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = command
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 1400)
  }, [command])

  return (
    <div className="cmd-line">
      {label ? <span className="cmd-label">{label}</span> : null}
      <code className="cmd-code">
        <span className="cmd-prompt" aria-hidden="true">
          $
        </span>
        {command}
      </code>
      <button
        type="button"
        className="cmd-copy"
        onClick={copy}
        aria-label={copied ? 'Copied to clipboard' : `Copy: ${command}`}
      >
        <TerminalIcon icon={copied ? Check : Copy} label="" />
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  )
}
