import { useRef, useState, type ReactNode } from 'react'
import './FileDrop.css'

export interface FileDropProps {
  onFiles: (files: File[]) => void
  /** Same syntax as the input `accept` attribute, e.g. "image/*,.glb". */
  accept?: string
  multiple?: boolean
  /** Main line. */
  title?: ReactNode
  /** Quiet line under it. */
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

function matches(file: File, accept?: string) {
  if (!accept) return true
  return accept.split(',').some(rule => {
    const r = rule.trim().toLowerCase()
    if (!r) return false
    if (r.startsWith('.')) return file.name.toLowerCase().endsWith(r)
    if (r.endsWith('/*')) return file.type.startsWith(r.slice(0, -1))
    return file.type === r
  })
}

/** FileDrop — drop files on it or click to browse. Files not matching `accept` are ignored. */
export function FileDrop({ onFiles, accept, multiple = true, title = 'Drop files or click to browse', hint, disabled = false, className }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const deliver = (list: FileList | null) => {
    const files = [...(list ?? [])].filter(file => matches(file, accept))
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <button
      type="button"
      className={className ? `aui-filedrop ${className}` : 'aui-filedrop'}
      data-over={over || undefined}
      disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={event => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={event => {
        event.preventDefault()
        setOver(false)
        if (!disabled) deliver(event.dataTransfer.files)
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden>
        <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5M4 13v2.5h12V13" />
      </svg>
      <span className="aui-filedrop__title">{title}</span>
      {hint && <span className="aui-filedrop__hint">{hint}</span>}
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={event => {
          deliver(event.target.files)
          event.target.value = ''
        }}
      />
    </button>
  )
}

export default FileDrop
