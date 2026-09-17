import { useEffect, useState } from 'react'
import './ColorField.css'

export interface ColorFieldProps {
  /** `#rrggbb`. */
  value: string
  onChange: (value: string) => void
  /** Accessible name. */
  label: string
  /** Preset swatches shown after the field. */
  swatches?: readonly string[]
  disabled?: boolean
  className?: string
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

function normalize(input: string): string | null {
  const match = input.trim().match(HEX)
  if (!match) return null
  const hex = match[1].length === 3 ? match[1].replace(/./g, c => c + c) : match[1]
  return `#${hex.toLowerCase()}`
}

/**
 * ColorField — a swatch that opens the system colour picker, plus an editable
 * hex value. Accepts `#rgb` and `#rrggbb`.
 */
export function ColorField({ value, onChange, label, swatches, disabled = false, className }: ColorFieldProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const next = normalize(draft)
    if (next && next !== value) onChange(next)
    else setDraft(value)
  }
  return (
    <span className={className ? `aui-color ${className}` : 'aui-color'} data-disabled={disabled || undefined}>
      <span className="aui-color__well">
        <span className="aui-color__swatch" style={{ background: value }} />
        <input
          type="color"
          aria-label={`${label} picker`}
          value={normalize(value) ?? '#000000'}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        />
        <input
          type="text"
          className="aui-color__hex"
          aria-label={label}
          spellCheck={false}
          disabled={disabled}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setDraft(value)
          }}
        />
      </span>
      {swatches && (
        <span className="aui-color__swatches">
          {swatches.map(swatch => (
            <button
              key={swatch}
              type="button"
              aria-label={`${label} ${swatch}`}
              aria-pressed={normalize(swatch) === normalize(value)}
              style={{ background: swatch }}
              disabled={disabled}
              onClick={() => onChange(normalize(swatch) ?? swatch)}
            />
          ))}
        </span>
      )}
    </span>
  )
}

export default ColorField
