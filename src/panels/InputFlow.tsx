import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import type { DiscoveredFeature } from '../app/feature'
import { features } from '../app/registry'
import { studio, useFeatureState } from '../app/store'
import { FeatureTile } from '../app/studio/FeatureTile'
import { PanelBar } from '../app/studio/PanelBar'
import { useSignalSnapshot } from '../app/signals'
import { Segmented } from '../ui/Segmented/Segmented'
import { Meter } from '../ui/Meter/Meter'
import { TextField } from '../ui/TextField/TextField'

const inputs = features.filter(feature => feature.group === 'Input')
/** How often the Signals view refreshes its readouts. */
const SIGNALS_HZ = 15

/** Which control actually starts a device (a permission prompt), if it has one. */
const ARMING: Record<string, { key: string; on: string | boolean; off: string | boolean }> = {
  'input.audio': { key: 'source', on: 'microphone', off: 'off' },
  'input.hands': { key: 'enabled', on: true, off: false },
}

/** One device, reading only its own state. */
function DeviceTile({ feature }: { feature: DiscoveredFeature }) {
  const state = useFeatureState(feature.id)
  if (!state) return null
  const arming = ARMING[feature.id]
  const live = state.enabled && (!arming || state.values[arming.key] === arming.on)
  return (
    <FeatureTile
      feature={feature}
      on={live}
      state={{ label: live ? 'Live' : state.enabled && arming ? 'Ready' : 'Off', live }}
      onToggle={value => {
        if (!arming) return studio.setEnabled(feature.id, value)
        if (value) studio.setEnabled(feature.id, true)
        studio.setValue(feature.id, arming.key, value ? arming.on : arming.off)
      }}
    />
  )
}

function Devices() {
  return (
    <>
      <div className="v2-tiles">
        {inputs.map(feature => (
          <DeviceTile key={feature.id} feature={feature} />
        ))}
      </div>
      <p className="v2-note">Microphone and camera ask for permission the first time they start. Values reach reactive objects through the signal bus.</p>
    </>
  )
}

function Signals({ query }: { query: string }) {
  const signals = useSignalSnapshot(SIGNALS_HZ).filter(([name]) => name.includes(query.trim()))
  if (signals.length === 0) {
    return (
      <div className="v2-empty">
        <b>{query.trim() ? 'No signal matches' : 'The bus is quiet'}</b>
        {query.trim() ? `Nothing on the bus is named like “${query.trim()}”.` : 'Start a device and its signals appear here, live.'}
      </div>
    )
  }
  return (
    <div className="v2-tiles">
      {signals.map(([name, value]) => (
        <div key={name} className="v2-tile">
          <span className="v2-path">{name}</span>
          <output>{value.toFixed(3)}</output>
          <Meter label={name} value={Math.abs(value)} max={name.includes('wheel') ? 10 : 1} valueText={null} />
        </div>
      ))}
    </div>
  )
}

function InputFlow() {
  const [view, setView] = useState<'devices' | 'signals'>('devices')
  const [query, setQuery] = useState('')
  return (
    <div className="artinos-inputflow-workspace">
      <PanelBar>
        <Segmented
          label="InputFlow view"
          value={view}
          onChange={setView}
          options={[
            { value: 'devices', label: 'Devices' },
            { value: 'signals', label: 'Signals' },
          ]}
        />
        {/* Filters the live bus, which the palette cannot do — not the studio search. */}
        {view === 'signals' && <TextField type="search" size="sm" value={query} onChange={setQuery} label="Filter signals" placeholder="Filter signals" />}
      </PanelBar>
      {view === 'devices' ? <Devices /> : <Signals query={query} />}
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
  owns: feature => feature.group === 'Input',
  footer: () => <>DEVICES · SIGNAL BUS</>,
  component: InputFlow,
}
