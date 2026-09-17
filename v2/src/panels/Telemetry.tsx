import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { compactNumber, useRuntime } from '../app/runtime'
import { FeatureCard } from '../app/studio/FeatureCard'
import { Tabs } from '../ui/Tabs/Tabs'
import { Sparkline } from '../ui/Sparkline/Sparkline'
import { Meter } from '../ui/Meter/Meter'
import { PropertyRow } from '../ui/PropertyRow/PropertyRow'

const diagnostics = features.filter(feature => feature.group === 'Diagnostics')

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="artinos-parameter-card" style={{ margin: 0 }}>
      <div className="artinos-panel-summary" style={{ margin: 0 }}>
        <span>{label.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {unit && <small style={{ marginLeft: 4, fontSize: 9, opacity: 0.55 }}>{unit}</small>}
      </div>
    </div>
  )
}

function Overview() {
  const stats = useRuntime()
  const budget = stats.frameMs / (1000 / 60)
  return (
    <>
      <div className="artinos-input-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <Kpi label="Frame rate" value={stats.fps.toFixed(0)} unit="fps" />
        <Kpi label="Frame time" value={stats.frameMs.toFixed(2)} unit="ms" />
        <Kpi label="Draw calls" value={compactNumber(stats.renderer.calls)} />
        <Kpi label="Triangles" value={compactNumber(stats.renderer.triangles)} />
        <Kpi label="Backend" value={stats.backend === 'webgpu' ? 'WebGPU' : stats.backend === 'webgl2' ? 'WebGL2' : '—'} />
        <Kpi label="Resolution" value={`${stats.renderer.width}×${stats.renderer.height}`} unit={`${stats.renderer.pixelRatio.toFixed(2)}×`} />
      </div>
      <div className="artinos-parameter-cards" style={{ marginTop: 10 }}>
        <div className="artinos-parameter-card">
          <div className="artinos-parameter-card-head">
            <b>Frame time</b>
            <small>last {stats.history.length} frames · 16.7 ms budget</small>
          </div>
          <Sparkline values={stats.history} min={0} max={50} threshold={16.7} width={320} height={64} tone={budget > 1.5 ? 'warm' : 'live'} label="Frame time history" />
        </div>
        <div className="artinos-parameter-card">
          <div className="artinos-parameter-card-head">
            <b>Frame rate</b>
            <small>15 s</small>
          </div>
          <Sparkline values={stats.fpsHistory} min={0} max={Math.max(60, ...stats.fpsHistory)} width={320} height={64} label="Frame rate history" />
        </div>
        <div className="artinos-parameter-card">
          <div className="artinos-parameter-card-head">
            <b>Load</b>
          </div>
          <PropertyRow label="Frame budget" density="compact">
            <Meter label="Frame budget" value={Math.min(2, budget)} max={2} valueText={`${Math.round(budget * 100)}%`} tone={budget > 1 ? 'warm' : 'live'} />
          </PropertyRow>
          <PropertyRow label="Geometries" density="compact">
            <Meter label="Geometries" value={stats.renderer.geometries} max={Math.max(64, stats.renderer.geometries)} valueText={String(stats.renderer.geometries)} tone="neutral" />
          </PropertyRow>
          <PropertyRow label="Textures" density="compact">
            <Meter label="Textures" value={stats.renderer.textures} max={Math.max(64, stats.renderer.textures)} valueText={String(stats.renderer.textures)} tone="neutral" />
          </PropertyRow>
        </div>
      </div>
    </>
  )
}

function Telemetry() {
  const [view, setView] = useState<'overview' | 'diagnostics'>('overview')
  return (
    <div className="artinos-panel-suite artinos-telemetry-suite">
      <Tabs
        label="Telemetry views"
        value={view}
        onChange={setView}
        items={[
          { value: 'overview', label: 'Performance overview' },
          { value: 'diagnostics', label: 'Diagnostics', badge: diagnostics.length },
        ]}
      />
      <div style={{ paddingTop: 8 }}>
        {view === 'overview' ? (
          <Overview />
        ) : (
          <div className="artinos-parameter-cards">
            {diagnostics.map(feature => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Telemetry

export const panel: PanelManifest = {
  id: 'telemetry',
  title: 'Telemetry',
  description: 'Frame profile, renderer load and diagnostic overlays',
  keywords: ['performance', 'profiler', 'memory', 'inspector', 'fps'],
  order: 11,
  owns: feature => feature.group === 'Diagnostics',
  footer: () => <>RUNTIME · LIVE</>,
  component: Telemetry,
}
