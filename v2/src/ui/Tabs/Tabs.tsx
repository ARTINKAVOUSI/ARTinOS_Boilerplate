import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './Tabs.css'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  /** Small count or status after the label. */
  badge?: ReactNode
  content?: ReactNode
}

export interface TabsProps<T extends string> {
  value: T
  items: readonly TabItem<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}

/**
 * Tabs — an underline tab strip with its panels. Arrow keys, Home and End
 * move between tabs (automatic activation). Items without `content` render
 * the strip only, so it can drive panels you place yourself.
 */
export function Tabs<T extends string>({ value, items, onChange, label, className }: TabsProps<T>) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(0, items.findIndex(item => item.value === value))
  const active = items[index]

  const onKeyDown = (event: KeyboardEvent) => {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    onChange(items[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className={className ? `aui-tabs ${className}` : 'aui-tabs'}>
      <div role="tablist" aria-label={label} className="aui-tabs__list" onKeyDown={onKeyDown}>
        {items.map((item, i) => (
          <button
            key={item.value}
            ref={element => {
              refs.current[i] = element
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === index}
            aria-controls={item.content !== undefined ? `${base}-panel-${i}` : undefined}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.badge != null && <span className="aui-tabs__badge">{item.badge}</span>}
          </button>
        ))}
      </div>
      {active?.content !== undefined && (
        <div role="tabpanel" id={`${base}-panel-${index}`} aria-labelledby={`${base}-tab-${index}`} className="aui-tabs__panel">
          {active.content}
        </div>
      )}
    </div>
  )
}

export default Tabs
