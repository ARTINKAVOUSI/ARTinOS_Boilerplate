import { useId, useMemo, useState } from 'react'

export interface BloomPickerProps {
  value: string
  onChange: (value: string) => void
  palette: readonly string[]
  size?: number
  disabled?: boolean
}

/** A small, dependency-free Bloom palette specimen for the library page. */
export function BloomPicker({ value, onChange, palette, size = 260, disabled = false }: BloomPickerProps) {
  const [open, setOpen] = useState(true)
  const labelId = useId()
  const petals = useMemo(() => palette.slice(0, 12), [palette])
  const center = size / 2
  const radius = size * 0.32

  return (
    <div className={`bloom-picker ${open ? 'is-open' : ''}`} style={{ width: size, height: size }} aria-labelledby={labelId}>
      <span id={labelId} className="sr-only">Bloom colour picker</span>
      <div className="bloom-picker__orbit" aria-hidden="true" />
      {petals.map((color, index) => {
        const angle = (index / petals.length) * Math.PI * 2 - Math.PI / 2
        const x = center + Math.cos(angle) * radius
        const y = center + Math.sin(angle) * radius
        return (
          <button
            key={`${color}-${index}`}
            type="button"
            className={`bloom-picker__petal ${value.toLowerCase() === color.toLowerCase() ? 'is-selected' : ''}`}
            style={{ left: x, top: y, background: color, transform: `translate(-50%, -50%) rotate(${angle}rad)` }}
            aria-label={`Choose ${color}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            disabled={disabled}
            onClick={() => { onChange(color); setOpen(true) }}
          />
        )
      })}
      <button
        type="button"
        className="bloom-picker__center"
        style={{ background: value }}
        aria-label="Toggle Bloom palette"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        disabled={disabled}
      >
        <span>{value.toUpperCase()}</span>
      </button>
    </div>
  )
}
