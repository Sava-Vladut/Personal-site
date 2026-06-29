import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileDown, Trash2, Upload } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { formatBytes } from '../../utils/format.js'

const HEIC_PATTERN = /\.(heic|heif)$/i

let heicToPromise = null
const loadHeicTo = () => {
  if (!heicToPromise) {
    heicToPromise = import('heic-to').then((module) => module.heicTo)
  }
  return heicToPromise
}

let rowId = 0

export function HeicConverter() {
  const [items, setItems] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const inputRef = useRef(null)
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => item.url && URL.revokeObjectURL(item.url))
    },
    [],
  )

  const patchItem = useCallback((id, patch) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList ?? []).filter((file) => HEIC_PATTERN.test(file.name))
      if (files.length === 0) return

      const queued = files.map((file) => ({
        id: (rowId += 1),
        file,
        name: file.name,
        outName: file.name.replace(HEIC_PATTERN, '.png'),
        status: 'pending',
        size: null,
        url: null,
        error: null,
      }))

      setItems((current) => [...current, ...queued])
      setIsBusy(true)

      const heicTo = await loadHeicTo()

      for (const entry of queued) {
        try {
          const result = await heicTo({ blob: entry.file, type: 'image/png' })
          const blob = Array.isArray(result) ? result[0] : result
          patchItem(entry.id, {
            status: 'ok',
            size: blob.size,
            url: URL.createObjectURL(blob),
          })
        } catch (error) {
          patchItem(entry.id, {
            status: 'fail',
            error: error?.message?.split('\n')[0] || 'decode error',
          })
        }
      }

      setIsBusy(false)
    },
    [patchItem],
  )

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      setIsDragging(false)
      addFiles(event.dataTransfer?.files)
    },
    [addFiles],
  )

  const clearAll = useCallback(() => {
    itemsRef.current.forEach((item) => item.url && URL.revokeObjectURL(item.url))
    setItems([])
  }, [])

  const downloadAll = useCallback(() => {
    itemsRef.current
      .filter((item) => item.status === 'ok' && item.url)
      .forEach((item, index) => {
        window.setTimeout(() => {
          const anchor = document.createElement('a')
          anchor.href = item.url
          anchor.download = item.outName
          anchor.click()
        }, index * 120)
      })
  }, [])

  const done = items.filter((item) => item.status === 'ok').length
  const failed = items.filter((item) => item.status === 'fail').length

  return (
    <div className="heic-tool">
      <div
        className={`heic-drop${isDragging ? ' is-drag' : ''}${isBusy ? ' is-busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label="Drop HEIC or HEIF files, or browse to select them"
      >
        <TerminalIcon icon={Upload} label="" />
        <span className="heic-drop-main">
          {isBusy ? 'decoding…' : 'drop .heic / .heif'}
          <span className="heic-drop-cursor" aria-hidden="true">
            █
          </span>
        </span>
        <span className="heic-drop-sub">— or click to browse · nothing is uploaded</span>
        <input
          ref={inputRef}
          type="file"
          accept=".heic,.heif,image/heic,image/heif"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="heic-log" role="status" aria-live="polite">
          {items.map((item) => (
            <div className={`heic-row is-${item.status}`} key={item.id}>
              <span className="heic-tag">
                {item.status === 'ok' ? '[ok]' : item.status === 'fail' ? '[fail]' : '[··]'}
              </span>
              <span className="heic-name">
                {item.name}
                <span className="heic-arrow" aria-hidden="true"> -&gt; </span>
                {item.status === 'fail' ? (
                  <em className="heic-error">{item.error}</em>
                ) : (
                  item.outName
                )}
              </span>
              <span className="heic-size">{item.size != null ? formatBytes(item.size) : ''}</span>
              {item.status === 'ok' && item.url ? (
                <a className="heic-get" href={item.url} download={item.outName}>
                  <TerminalIcon icon={Download} label="" />
                  get
                </a>
              ) : (
                <span className="heic-get heic-get--ghost" aria-hidden="true" />
              )}
            </div>
          ))}

          <div className="heic-summary">
            <span>
              {isBusy ? 'working…' : 'done.'} {done} converted{failed ? `, ${failed} failed` : ''}
            </span>
            <div className="heic-actions">
              <button type="button" onClick={downloadAll} disabled={done === 0}>
                <TerminalIcon icon={FileDown} label="" />
                download all
              </button>
              <button type="button" onClick={clearAll}>
                <TerminalIcon icon={Trash2} label="" />
                clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
