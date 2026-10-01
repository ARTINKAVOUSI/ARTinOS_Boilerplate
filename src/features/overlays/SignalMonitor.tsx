import { useRef, useState, type PointerEvent } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalSnapshot } from '../../app/signals'
import { Meter } from '../../ui/Meter/Meter'
import { Panel, Section } from '../../ui/Panel/Panel'

export interface SignalMonitorProps {
  /** Only show signals whose name starts with this. */
  filter?: string
  /** Updates per second. */
  rate?: number
}

/** SignalMonitor — a live list of every signal on the bus, with level meters. Drag it by its header. */
export function SignalMonitor({ filter = '', rate = 15 }: SignalMonitorProps) {
  const signals = useSignalSnapshot(rate).filter(([name]) => name.startsWith(filter))
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('.ar-panel__head')) return
    drag.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div
      style={{ position: 'fixed', top: 64, left: '50%', translate: `calc(-50% + ${offset.x}px) ${offset.y}px`, zIndex: 14, width: 280 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Panel title="Signals" subtitle={`${signals.length} live`}>
        <Section title="Bus" count={signals.length} collapsible>
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'grid', gap: 2 }}>
            {signals.length === 0 && <div style={{ fontSize: 11, opacity: 0.5, padding: '6px 0' }}>No signals yet. Enable an input.</div>}
            {signals.map(([name, value]) => (
              <div key={name} style={{ display: 'grid', gridTemplateColumns: '112px 1fr', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }} title={name}>
                  {name}
                </span>
                <Meter label={name} value={Math.abs(value)} max={name.includes('wheel') ? 10 : 1} valueText={value.toFixed(2)} />
              </div>
            ))}
          </div>
        </Section>
      </Panel>
    </div>
  )
}

export default SignalMonitor

export const feature: Feature = {
  id: 'overlay.signals',
  label: 'Signal Monitor',
  kind: 'overlay',
  group: 'Diagnostics',
  order: 981,
  enabled: false,
  component: SignalMonitor,
  controls: {
    filter: { type: 'text', value: '', placeholder: 'e.g. audio' },
    rate: { type: 'number', value: 15, min: 1, max: 60, step: 1, unit: 'Hz' },
  },
}
