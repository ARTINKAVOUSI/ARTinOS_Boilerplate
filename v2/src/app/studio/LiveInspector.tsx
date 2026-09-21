import { useSyncExternalStore } from 'react'
import { liveObject, type LiveTarget } from '../live-graph'
import type { LiveNode } from '../../ui/NodeGraph/LiveGraphView'
import { findFeature } from '../registry'
import { studio, useFeatureState } from '../store'
import { signalBus, useSignalSnapshot } from '../../features/input/signals'
import { PropertyRow } from '../../ui/PropertyRow/PropertyRow'
import { Slider } from '../../ui/Slider/Slider'
import { Toggle } from '../../ui/Toggle/Toggle'
import { Sparkline } from '../../ui/Sparkline/Sparkline'
import { Button } from '../../ui/Button/Button'
import { ControlInput, labelOf } from './ControlField'

/**
 * Edits the thing a live node stands for. Everything here writes through the
 * same surfaces the panels use, so the viewport reacts immediately.
 */
export function LiveInspector({ node, target, onOpenGraph }: { node: LiveNode | null; target?: LiveTarget; onOpenGraph: (id: string) => void }) {
  if (!node || !target) {
    return (
      <>
        <p className="artinos-graph-hint">Select a node to inspect and tweak what it stands for.</p>
        <PropertyRow label="Selection">
          <span className="artinos-effect-status">Nothing selected</span>
        </PropertyRow>
      </>
    )
  }
  if (target.kind === 'signal') return <SignalInspector id={target.id} />
  if (target.kind === 'parameter') return <ParameterInspector id={target.id} />
  if (target.kind === 'feature' || target.kind === 'effect') return <FeatureInspector id={target.id} />
  if (target.kind === 'object') return <ObjectInspector nodeId={node.id} name={node.title} />
  if (target.kind === 'graph')
    return (
      <>
        <p className="artinos-graph-hint">Authored graph feeding this system.</p>
        <PropertyRow label="Nodes">
          <span className="artinos-effect-status">{node.detail ?? '—'}</span>
        </PropertyRow>
        <Button size="sm" onClick={() => onOpenGraph(target.id)}>
          Open in editor
        </Button>
      </>
    )
  return (
    <>
      <p className="artinos-graph-hint">Render target sampled from the live pipeline.</p>
      <PropertyRow label="Target">
        <span className="artinos-effect-status">{target.id}</span>
      </PropertyRow>
      <PropertyRow label="Detail">
        <span className="artinos-effect-status">{node.detail ?? '—'}</span>
      </PropertyRow>
    </>
  )
}

/** A signal is owned by its device: read-only here, with its recent history. */
function SignalInspector({ id }: { id: string }) {
  useSignalSnapshot(10)
  const value = signalBus.get(id)
  const age = signalBus.age(id)
  return (
    <>
      <p className="artinos-graph-hint">Live signal. The device owns this value; it is read-only here.</p>
      <PropertyRow label="Value">
        <span className="artinos-effect-status">{value.toFixed(4)}</span>
      </PropertyRow>
      <PropertyRow label="Updated">
        <span className="artinos-effect-status">{Number.isFinite(age) ? `${age.toFixed(0)}ms ago` : '—'}</span>
      </PropertyRow>
      <Sparkline label={id} values={history(id, value)} />
    </>
  )
}

const trails = new Map<string, number[]>()
function history(id: string, value: number) {
  const list = trails.get(id) ?? []
  list.push(value)
  if (list.length > 90) list.splice(0, list.length - 90)
  trails.set(id, list)
  return list
}

/** One control of one feature, addressed as `feature.id:control`. */
function ParameterInspector({ id }: { id: string }) {
  const [featureId, name] = id.split(':')
  const feature = findFeature(featureId)
  const state = useFeatureState(featureId)
  const control = feature?.controls?.[name]
  if (!feature || !control || !state) {
    return (
      <PropertyRow label="Status">
        <span className="artinos-effect-status">Not registered</span>
      </PropertyRow>
    )
  }
  return (
    <>
      <p className="artinos-graph-hint">
        {feature.label} · {labelOf(name, control)}
      </p>
      <PropertyRow label={labelOf(name, control)} onReset={() => studio.setValue(featureId, name, control.value)}>
        <ControlInput name={name} control={control} value={state.values[name]} onChange={value => studio.setValue(featureId, name, value)} />
      </PropertyRow>
      <p className="artinos-graph-hint">A running graph is writing this control; editing it here is overwritten on the next frame it evaluates.</p>
    </>
  )
}

/** Any feature: its switch and every control it declares. */
function FeatureInspector({ id }: { id: string }) {
  const feature = findFeature(id)
  const state = useFeatureState(id)
  if (!feature || !state) {
    return (
      <PropertyRow label="Status">
        <span className="artinos-effect-status">Not in the registry</span>
      </PropertyRow>
    )
  }
  return (
    <>
      <p className="artinos-graph-hint">{feature.description ?? feature.path}</p>
      <PropertyRow label="Enabled">
        <Toggle size="sm" label={`${feature.label} enabled`} checked={state.enabled} onChange={value => studio.setEnabled(id, value)} />
      </PropertyRow>
      {Object.entries(feature.controls ?? {}).map(([name, control]) => (
        <PropertyRow key={name} label={labelOf(name, control)} onReset={() => studio.setValue(id, name, control.value)}>
          <ControlInput name={name} control={control} value={state.values[name]} onChange={value => studio.setValue(id, name, value)} />
        </PropertyRow>
      ))}
    </>
  )
}

/** A real object in the rendered scene, written straight through. */
function ObjectInspector({ nodeId, name }: { nodeId: string; name: string }) {
  // The scene mutates outside React, so read it on every paint of this panel.
  const revision = useSyncExternalStore(
    listener => {
      const timer = setInterval(listener, 250)
      return () => clearInterval(timer)
    },
    () => Math.floor(performance.now() / 250),
  )
  const object = liveObject(nodeId) as unknown as
    | { visible: boolean; type: string; intensity?: number; position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void } }
    | undefined
  if (!object) {
    return (
      <PropertyRow label="Status">
        <span className="artinos-effect-status">No longer in the scene</span>
      </PropertyRow>
    )
  }
  return (
    <>
      <p className="artinos-graph-hint" data-revision={revision}>
        Live object in the rendered scene.
      </p>
      <PropertyRow label="Type">
        <span className="artinos-effect-status">{object.type}</span>
      </PropertyRow>
      <PropertyRow label="Visible">
        <Toggle
          size="sm"
          label={`${name} visible`}
          checked={object.visible !== false}
          onChange={value => {
            object.visible = value
          }}
        />
      </PropertyRow>
      {typeof object.intensity === 'number' && (
        <PropertyRow label="Intensity">
          <Slider
            label="Intensity"
            value={object.intensity}
            min={0}
            max={Math.max(4, object.intensity * 2)}
            step={0.01}
            onChange={value => {
              object.intensity = value
            }}
          />
        </PropertyRow>
      )}
      {(['x', 'y', 'z'] as const).map(axis => (
        <PropertyRow key={axis} label={`Position ${axis.toUpperCase()}`}>
          <Slider
            label={`Position ${axis}`}
            value={object.position[axis]}
            min={-10}
            max={10}
            step={0.01}
            onChange={value => {
              const next = { ...{ x: object.position.x, y: object.position.y, z: object.position.z }, [axis]: value }
              object.position.set(next.x, next.y, next.z)
            }}
          />
        </PropertyRow>
      ))}
    </>
  )
}

export default LiveInspector
