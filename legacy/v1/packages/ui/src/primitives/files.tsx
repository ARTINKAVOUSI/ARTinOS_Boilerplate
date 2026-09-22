import { useRef, useState, type ReactNode } from 'react'
export interface AssetReference { id: string; kind?: 'asset' | 'image' | 'texture' | 'video' | 'audio'; label?: string; uri?: string; mimeType?: string; metadata?: Record<string, unknown> }
import { controls } from './control-registry'

export function FileField({
  label,
  accept,
  multiple = false,
  onFiles,
}: {
  label: string
  accept?: string
  multiple?: boolean
  onFiles(files: File[]): void
}) {
  return (
    <label className="artinos-file-field">
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={event => {
          onFiles(Array.from(event.target.files ?? []))
          // Reset so re-picking the same file fires change again.
          event.target.value = ''
        }}
      />
      <b>Choose file{multiple ? 's' : ''}</b>
    </label>
  )
}

export function DropZone({
  children = 'Drop files here',
  accept,
  onFiles,
}: {
  children?: ReactNode
  accept?: string[]
  onFiles(files: File[]): void
}) {
  const [over, setOver] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const receive = (files: File[]) =>
    onFiles(accept?.length ? files.filter(file => accept.some(rule => file.type.includes(rule) || file.name.toLowerCase().endsWith(rule.toLowerCase()))) : files)

  return (
    <div
      className={`artinos-dropzone ${over ? 'is-over' : ''}`}
      onDragOver={event => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={event => {
        event.preventDefault()
        setOver(false)
        receive(Array.from(event.dataTransfer.files))
      }}
    >
      {children}
      <input ref={picker} type="file" hidden multiple accept={accept?.join(',')} onChange={event => { receive(Array.from(event.target.files ?? [])); event.target.value = '' }} />
      <button type="button" className="artinos-button artinos-dropzone-browse" onClick={() => picker.current?.click()}>Choose files</button>
    </div>
  )
}

export function KeyCapture({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  const [armed, setArmed] = useState(false)
  return (
    <div className="artinos-key-capture">
      <span>{label}</span>
      <button
        className={armed ? 'is-armed' : ''}
        onClick={() => setArmed(true)}
        onBlur={() => setArmed(false)}
        onKeyDown={event => {
          if (!armed) return
          event.preventDefault()
          onChange(event.code)
          setArmed(false)
        }}
      >
        {armed ? 'Press a key…' : value || 'Unassigned'}
      </button>
    </div>
  )
}

export function fileAssetReference(file: File, kind: NonNullable<AssetReference['kind']> = 'asset'): AssetReference {
  return {
    id: `file:${file.name}:${file.size}:${file.lastModified}`,
    kind,
    label: file.name,
    mimeType: file.type || undefined,
    metadata: { size: file.size, lastModified: file.lastModified },
  }
}

export function AssetField({
  label,
  value,
  accept,
  kind = 'asset',
  onImport,
  onChange,
}: {
  label: string
  value?: AssetReference | null
  accept?: string
  kind?: NonNullable<AssetReference['kind']>
  onImport?(file: File, reference: AssetReference): void | Promise<void>
  onChange(value: AssetReference | null): void
}) {
  const [error, setError] = useState('')
  const request = useRef(0)
  return (
    <div className="artinos-asset-field">
      <span>{label}</span>
      <output>{value?.label ?? value?.uri ?? 'None'}</output>
      <label><input type="file" accept={accept} onChange={async event => {
        const file = event.target.files?.[0]
        if (!file) return
        event.target.value = ''
        const token = ++request.current
        setError('')
        try {
        const reference = fileAssetReference(file, kind)
        if (onImport) await onImport(file, reference)
        else {
          // An Inspector asset must carry loadable bytes, not just the file name.
          const uri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
          const extension = file.name.split('.').pop()?.toLowerCase()
          reference.uri = extension === 'hdr' || extension === 'exr'
            ? uri.replace(/^data:[^;,]*/, `data:application/${extension}`) : uri
        }
        if (token === request.current) onChange(reference)
        } catch {
          if (token === request.current) setError(`Could not import ${file.name}.`)
        }
      }} /><b>Choose</b></label>
      {error && <span role="alert">{error}</span>}
      {value && <button type="button" aria-label={`Clear ${label}`} onClick={() => { request.current++; setError(''); onChange(null) }}>×</button>}
    </div>
  )
}

export function AssetDropZone({
  children = 'Drop assets here',
  kind = 'asset',
  accept,
  onImport,
}: {
  children?: ReactNode
  kind?: NonNullable<AssetReference['kind']>
  accept?: string[]
  onImport(files: Array<{ file: File; reference: AssetReference }>): void
}) {
  return <DropZone accept={accept} onFiles={files => onImport(files.map(file => ({ file, reference: fileAssetReference(file, kind) })))}>{children}</DropZone>
}

export function LegacyCurveEditor({
  label,
  points,
  min = 0,
  max = 1,
  onChange,
}: {
  label: string
  points: Array<[number, number]>
  min?: number
  max?: number
  onChange(points: Array<[number, number]>): void
}) {
  const width = 240
  const height = 100
  const ordered = [...points].sort((a, b) => a[0] - b[0])
  const toY = (value: number) => height - ((value - min) / (max - min || 1)) * height
  const path = ordered.map(([x, y], index) => `${index ? 'L' : 'M'} ${x * width} ${toY(y)}`).join(' ')

  const movePoint = (index: number, event: import('react').PointerEvent<SVGCircleElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!rect) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const move = (next: import('react').PointerEvent<SVGCircleElement>) => {
      const x = Math.max(0, Math.min(1, (next.clientX - rect.left) / rect.width))
      const y = max - Math.max(0, Math.min(1, (next.clientY - rect.top) / rect.height)) * (max - min)
      const updated = [...ordered]
      updated[index] = [x, y]
      onChange(updated.sort((a, b) => a[0] - b[0]))
    }
    move(event)
  }

  return (
    <div className="artinos-curve">
      <span>{label}</span>
      <svg viewBox={`0 0 ${width} ${height}`}>
        <path d={path} />
        {ordered.map(([x, y], index) => (
          <circle key={index} cx={x * width} cy={toY(y)} r="4"
            onPointerDown={event => movePoint(index, event)}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePoint(index, event) }}
            onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)}
          />
        ))}
      </svg>
    </div>
  )
}

LegacyCurveEditor.meta = controls.require('curve-editor')
