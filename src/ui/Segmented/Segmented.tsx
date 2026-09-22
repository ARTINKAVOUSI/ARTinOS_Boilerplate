import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import './Segmented.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when the label is an icon. */
  title?: string
}

export interface SegmentedProps<T extends string> {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** Accessible name of the group. */
  label: string
  size?: 'md' | 'sm'
  className?: string
}

/** Segmented — a small set of mutually exclusive choices, all visible. Arrow keys move the selection. */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'md', className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(0, options.findIndex(option => option.value === value))

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={className ? `aui-segmented ${className}` : 'aui-segmented'}
      data-size={size === 'sm' ? 'sm' : undefined}
      style={{ ['--count' as string]: options.length, ['--index' as string]: index }}
      onKeyDown={onKeyDown}
    >
      <span className="aui-segmented__thumb" aria-hidden />
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={element => {
            refs.current[i] = element
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.title}
          title={option.title}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default Segmented
