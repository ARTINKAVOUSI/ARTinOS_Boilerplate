import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { studio, useStudio, type StudioState } from '../app/store'
import { FeatureCard } from '../app/studio/FeatureCard'
import { useSignalSnapshot } from '../features/input/signals'
import { Tabs } from '../ui/Tabs/Tabs'
import { Toggle } from '../ui/Toggle/Toggle'
import { Meter } from '../ui/Meter/Meter'
import { TextField } from '../ui/TextField/TextField'

const inputs = features.filter(feature => feature.group === 'Input')
const selectFeatures = (state: StudioState) => state.features

/** Which control actually starts a device (a permission prompt), if it has one. */
const ARMING: Record<string, { key: string; on: string | boolean; off: string | boolean }> = {
  'input.audio': { key: 'source', on: 'microphone', off: 'off' },
  'input.hands': { key: 'enabled', on: true, off: false },
}

function Devices() {
  const states = useStudio(selectFeatures)
  return (
    <>
      <div className="artinos-input-grid">
        {inputs.map(feature => {
          const state = states[feature.id]
          if (!state) return null
          const arming = ARMING[feature.id]
          const live = state.enabled && (!arming || state.values[arming.key] === arming.on)
          return (
            <div key={feature.id} className="artinos-device">
              <span>
                <b>{feature.label}</b>
                <small>{feature.description}</small>
                <small className={live ? 'state-on' : ''}>{live ? 'LIVE' : state.enabled && arming ? 'READY · OFF' : state.enabled ? 'LIVE' : 'DISABLED'}</small>
              </span>
              <Toggle
                label={`${feature.label} ${arming ? 'capture' : 'enabled'}`}
                checked={live}
                onChange={value => {
                  if (!arming) return studio.setEnabled(feature.id, value)
                  if (value) studio.setEnabled(feature.id, true)
                  studio.setValue(feature.id, arming.key, value ? arming.on : arming.off)
                }}
              />
            </div>
          )
        })}
      </div>
      <p className="artinos-device-note">Microphone and camera ask for permission the first time they start. Values reach reactive objects through the signal bus.</p>
      <div className="artinos-parameter-cards">
        {inputs.map(feature => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </>
  )
}

function Signals() {
  const [query, setQuery] = useState('')
  const signals = useSignalSnapshot(15).filter(([name]) => name.includes(query.trim()))
  return (
    <div className="artinos-signals-panel">
      <div className="v2-panel-bar">
        <TextField type="search" size="sm" value={query} onChange={setQuery} label="Filter signals" placeholder="Filter signals, e.g. audio" />
        <span className="v2-spacer" />
        <span className="artinos-panel-summary">{signals.length} LIVE</span>
      </div>
      {signals.length === 0 && <div className="v2-empty">No signals yet. Start a device.</div>}
      <div className="artinos-input-grid">
        {signals.map(([name, value]) => (
          <div key={name} className="artinos-signal-row">
            <div className="v2-panel-bar" style={{ margin: 0 }}>
              <span>{name}</span>
              <span className="v2-spacer" />
              <output>{value.toFixed(3)}</output>
            </div>
            <Meter label={name} value={Math.abs(value)} max={name.includes('wheel') ? 10 : 1} valueText={null} />
          </div>
        ))}
      </div>
    </div>
  )
}

function InputFlow() {
  const [view, setView] = useState<'devices' | 'signals'>('devices')
  return (
    <div className="artinos-inputflow-workspace">
      <Tabs
        label="InputFlow views"
        value={view}
        onChange={setView}
        items={[
          { value: 'devices', label: 'Devices', badge: inputs.length },
          { value: 'signals', label: 'Signals' },
        ]}
      />
      <div className="artinos-inputflow-content" style={{ paddingTop: 8 }}>
        {view === 'devices' ? <Devices /> : <Signals />}
      </div>
    </div>
  )
}

export default InputFlow

export const panel: PanelManifest = {
  id: 'inputflow',
  title: 'InputFlow',
  description: 'Devices and live signals',
  keywords: ['devices', 'pointer', 'audio', 'microphone', 'hands', 'vision', 'signals'],
  order: 3,
  footer: () => <>DEVICES · SIGNAL BUS</>,
  component: InputFlow,
}
