import { useEffect, useRef, type CSSProperties } from 'react'
import './Meter.css'

export interface MeterProps {
  /** Current level. */
  value: number
  min?: number
  max?: number
  /** Accessible name. */
  label: string
  /** Text drawn at the right; defaults to the value. Pass null to hide. */
  valueText?: string | null
  /** Hold the peak for a moment and let it fall. */
  peak?: boolean
  tone?: 'live' | 'warm' | 'neutral'
  className?: string
  style?: CSSProperties
}

/**
 * Meter — a horizontal level bar for live values (audio, CPU, progress).
 * Updating it at frame rate is fine: the fill is a CSS transform.
 */
export function Meter({ value, min = 0, max = 1, label, valueText, peak = false, tone = 'live', className, style }: MeterProps) {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)))
  const peakRef = useRef<HTMLSpanElement>(null)
  const held = useRef({ value: 0, time: 0 })

  useEffect(() => {
    if (!peak || !peakRef.current) return
    const now = performance.now()
    const h = held.current
    if (t >= h.value) {
      h.value = t
      h.time = now
    } else if (now - h.time > 700) {
      h.value = Math.max(t, h.value - (now - h.time - 700) / 4000)
    }
    peakRef.current.style.left = `${h.value * 100}%`
  })

  const text = valueText === undefined ? value.toFixed(2) : valueText
  return (
    <div
      className={className ? `aui-meter ${className}` : 'aui-meter'}
      data-tone={tone}
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      style={style}
    >
      <span className="aui-meter__track">
        <span className="aui-meter__fill" style={{ transform: `scaleX(${t})` }} />
        {peak && <span ref={peakRef} className="aui-meter__peak" />}
      </span>
      {text !== null && <span className="aui-meter__value">{text}</span>}
    </div>
  )
}

export default Meter
