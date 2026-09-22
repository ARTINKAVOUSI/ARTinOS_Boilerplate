import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

export interface TooltipProps {
  content: ReactNode
  /** One focusable element; it receives the hover/focus handlers. */
  children: ReactElement<Record<string, unknown>>
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

type Position = { left: number; top: number }

/** Tooltip — a short hint on hover or keyboard focus, portalled to the body so panels never clip it. */
export function Tooltip({ content, children, side = 'top', delay = 450 }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const anchor = useRef<HTMLElement | null>(null)
  const tip = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = (event: { currentTarget: EventTarget }) => {
    anchor.current = event.currentTarget as HTMLElement
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
    setPosition(null)
  }

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && hide()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return
    const a = anchor.current.getBoundingClientRect()
    const t = tip.current.getBoundingClientRect()
    const gap = 6
    let left = a.left + a.width / 2 - t.width / 2
    let top = a.top - t.height - gap
    if (side === 'bottom') top = a.bottom + gap
    if (side === 'left') {
      left = a.left - t.width - gap
      top = a.top + a.height / 2 - t.height / 2
    }
    if (side === 'right') {
      left = a.right + gap
      top = a.top + a.height / 2 - t.height / 2
    }
    if (side === 'top' && top < 4) top = a.bottom + gap
    left = Math.min(window.innerWidth - t.width - 4, Math.max(4, left))
    top = Math.min(window.innerHeight - t.height - 4, Math.max(4, top))
    setPosition({ left, top })
  }, [open, side, content])

  const props = children.props as Record<string, (event: never) => void>
  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onPointerEnter: (event: PointerEvent & { currentTarget: EventTarget }) => {
      props.onPointerEnter?.(event as never)
      show(event)
    },
    onPointerLeave: (event: PointerEvent) => {
      props.onPointerLeave?.(event as never)
      hide()
    },
    onFocus: (event: FocusEvent & { currentTarget: EventTarget }) => {
      props.onFocus?.(event as never)
      show(event)
    },
    onBlur: (event: FocusEvent) => {
      props.onBlur?.(event as never)
      hide()
    },
  })

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className="aui-tooltip"
            style={{ left: position?.left ?? -9999, top: position?.top ?? -9999, opacity: position ? 1 : 0 }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

export default Tooltip
