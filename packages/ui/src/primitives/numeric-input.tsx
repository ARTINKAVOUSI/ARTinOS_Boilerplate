import { useRef, useState } from 'react'

export function boundedNumber(raw: string, fallback: number, min = -Infinity, max = Infinity): number {
  if (!raw.trim()) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

/** Keep incomplete edits local so clearing a field never writes a spurious zero. */
export function NumericInput({ value, min, max, step = .01, onChange, className, label }: {
  value: number; min?: number; max?: number; step?: number; onChange(value: number): void; className?: string; label?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const origin = useRef(value)
  const format = (number: number) => Number(number.toFixed(Math.min(6, (String(step).split('.')[1] ?? '').length))).toString()
  return <input className={className} aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft ?? format(value)}
    onFocus={() => { origin.current = value; setDraft(format(value)) }}
    onChange={event => {
      const raw = event.target.value
      setDraft(raw)
      const next = Number(raw)
      if (raw.trim() && Number.isFinite(next) && next >= (min ?? -Infinity) && next <= (max ?? Infinity)) onChange(next)
    }}
    onBlur={event => { const next = boundedNumber(event.target.value, value, min, max); if (!Object.is(next, value)) onChange(next); setDraft(null) }}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = String(origin.current); onChange(origin.current); setDraft(null); event.currentTarget.blur() }
    }} />
}
