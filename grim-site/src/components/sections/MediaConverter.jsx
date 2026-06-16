import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Play, Trash2 } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { CopyCommand } from '../common/CopyCommand.jsx'
import { filenameFromDisposition, formatBytes } from '../../utils/format.js'

let entryId = 0

const shortUrl = (url) => {
  try {
    const { hostname, pathname } = new URL(url)
    const path = pathname.length > 22 ? `${pathname.slice(0, 21)}…` : pathname
    return `${hostname.replace(/^www\./, '')}${path}`
  } catch {
    return url.slice(0, 40)
  }
}

export function MediaConverter({ service }) {
  const { endpoint, formats, placeholder, note } = service
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState(formats[0])
  const [busy, setBusy] = useState(false)
  const [entries, setEntries] = useState([])
  const entriesRef = useRef(entries)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(
    () => () => {
      entriesRef.current.forEach((entry) => entry.url && URL.revokeObjectURL(entry.url))
    },
    [],
  )

  const patch = useCallback((id, next) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...next } : entry)))
  }, [])

  const submit = useCallback(
    async (event) => {
      event.preventDefault()
      const trimmed = url.trim()
      if (!trimmed || busy) return

      const id = (entryId += 1)
      setEntries((current) => [
        ...current,
        { id, status: 'working', label: shortUrl(trimmed), format, name: null, size: null, url: null, error: null },
      ])
      setBusy(true)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed, format }),
        })

        if (!response.ok) {
          let detail = `request failed (${response.status})`
          try {
            const data = await response.json()
            if (data?.detail) detail = data.detail
          } catch {
            /* non-json error */
          }
          patch(id, { status: 'fail', error: detail })
          return
        }

        const blob = await response.blob()
        const name = filenameFromDisposition(
          response.headers.get('Content-Disposition'),
          `download.${format}`,
        )
        const objectUrl = URL.createObjectURL(blob)

        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = name
        anchor.click()

        patch(id, { status: 'ok', name, size: blob.size, url: objectUrl })
        setUrl('')
      } catch {
        patch(id, {
          status: 'fail',
          error: "can't reach the converter api — is the backend running? (see server/README.md)",
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, endpoint, format, patch, url],
  )

  const clearAll = useCallback(() => {
    entriesRef.current.forEach((entry) => entry.url && URL.revokeObjectURL(entry.url))
    setEntries([])
  }, [])

  return (
    <div className="media-tool">
      <form className="media-form" onSubmit={submit}>
        <div className="media-input-row">
          <span className="media-prompt" aria-hidden="true">
            &gt;
          </span>
          <input
            className="media-input"
            type="url"
            inputMode="url"
            placeholder={placeholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={`${service.title} link`}
          />
        </div>

        <div className="media-controls">
          {formats.length > 1 && (
            <div className="media-formats" role="group" aria-label="Output format">
              {formats.map((option) => (
                <button
                  type="button"
                  key={option}
                  className="media-format"
                  aria-pressed={format === option}
                  onClick={() => setFormat(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className="media-run" disabled={busy || !url.trim()}>
            <TerminalIcon icon={Play} label="" />
            {busy ? 'working…' : 'convert'}
          </button>
          {note ? <span className="media-note">{note}</span> : null}
          {entries.length > 0 && (
            <button type="button" className="media-clear" onClick={clearAll} disabled={busy}>
              <TerminalIcon icon={Trash2} label="" />
              clear
            </button>
          )}
        </div>
      </form>

      {entries.length > 0 && (
        <div className="media-log" role="status" aria-live="polite">
          {entries.map((entry) => (
            <div className={`media-entry is-${entry.status}`} key={entry.id}>
              <span className="media-tag">
                {entry.status === 'ok' ? '[ok]' : entry.status === 'fail' ? '[fail]' : '[··]'}
              </span>
              <span className="media-line">
                {entry.status === 'working' && (
                  <>
                    converting <em>{entry.label}</em> → {entry.format}…
                  </>
                )}
                {entry.status === 'ok' && (
                  <>
                    {entry.name}
                    <span className="media-size"> · {formatBytes(entry.size)}</span>
                  </>
                )}
                {entry.status === 'fail' && <em className="media-error">{entry.error}</em>}
              </span>
              {entry.status === 'ok' && entry.url && (
                <a className="media-get" href={entry.url} download={entry.name}>
                  <TerminalIcon icon={Download} label="" />
                  get
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="media-hint">
        <summary>backend not running? start it</summary>
        <CopyCommand command="cd grim-site/server && python -m uvicorn app:app --reload --port 8000" />
        <p>Requires Python deps (server/requirements.txt) and ffmpeg on PATH.</p>
      </details>
    </div>
  )
}
