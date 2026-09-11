import { useState } from 'react'
import { Tabs } from '../primitives'
import { HistoryPanel } from './HistoryPanel'
import { ObjectInspectorPanel } from './ObjectInspectorPanel'
import { ParametersPanel } from './ParametersPanel'
import { QualityPanel } from './QualityPanel'
import { ResourcesPanel } from './ResourcesPanel'
import { SignalsPanel } from './SignalsPanel'

const TABS = [
  { id: 'object', label: 'Object', View: ObjectInspectorPanel },
  { id: 'parameters', label: 'Parameters', View: ParametersPanel },
  { id: 'signals', label: 'Signals', View: SignalsPanel },
  { id: 'resources', label: 'Resources', View: ResourcesPanel },
  { id: 'quality', label: 'Quality', View: QualityPanel },
  { id: 'history', label: 'History', View: HistoryPanel },
]

export function InspectorPanel() {
  const [tab, setTab] = useState('object')
  const View = TABS.find(entry => entry.id === tab)?.View ?? ObjectInspectorPanel
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={TABS.map(({ id, label }) => ({ id, label }))} />
      <View />
    </>
  )
}
