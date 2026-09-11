import { useMemo, type ReactNode } from 'react'

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="artinos-row">
      <span>{label}</span>
      <output>{value}</output>
    </div>
  )
}

export function Meter({ label, value, min = 0, max = 1, unit }: { label: string; value: number; min?: number; max?: number; unit?: string }) {
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100))
  return (
    <div className="artinos-meter">
      <span>{label}</span>
      <div>
        <i style={{ width: `${percent}%` }} />
      </div>
      <output>
        {value.toFixed(2)}
        {unit ?? ''}
      </output>
    </div>
  )
}

export function Progress({ label, value = 0, max = 1 }: { label?: string; value?: number; max?: number }) {
  const percent = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className="artinos-progress">
      {label && <span>{label}</span>}
      <div>
        <i style={{ width: `${percent}%` }} />
      </div>
      <output>{percent.toFixed(0)}%</output>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'danger' }) {
  return <span className={`artinos-badge tone-${tone}`}>{children}</span>
}

export function Sparkline({ values, width = 150, height = 36 }: { values: number[]; width?: number; height?: number }) {
  const path = useMemo(() => {
    if (!values.length) return ''
    const min = Math.min(...values)
    const span = Math.max(...values) - min || 1
    return values
      .map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * width
        const y = height - ((value - min) / span) * height
        return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [values, width, height])

  return (
    <svg className="artinos-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <path d={path} />
    </svg>
  )
}

export function ValueReadout({ label, value, unit, precision = 2, status }: { label: string; value: number | string; unit?: string; precision?: number; status?: 'live' | 'warn' | 'fault' }) {
  const formatted = typeof value === 'number' ? value.toFixed(precision) : value
  return <output className="artinos-value-readout" data-state={status}><span>{label}</span><strong>{formatted}</strong>{unit && <em>{unit}</em>}</output>
}

export function LevelMeter({ label, channels, min = 0, max = 1, peak }: { label: string; channels: number[]; min?: number; max?: number; peak?: number[] }) {
  return (
    <div className="artinos-level-meter" role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.max(...channels, min)}>
      <span>{label}</span>
      <div>{channels.map((value, index) => {
        const amount = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
        const peakValue = peak?.[index]
        const peakAmount = peakValue === undefined ? undefined : Math.max(0, Math.min(1, (peakValue - min) / (max - min || 1)))
        return <i key={index}><b style={{ transform: `scaleY(${amount})` }} />{peakAmount !== undefined && <u style={{ bottom: `${peakAmount * 100}%` }} />}</i>
      })}</div>
    </div>
  )
}

export function StatusDisplay({ label, value, tone = 'neutral', detail }: { label: string; value: string; tone?: 'neutral' | 'live' | 'warn' | 'fault'; detail?: string }) {
  return <div className="artinos-status-display" data-state={tone}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}
