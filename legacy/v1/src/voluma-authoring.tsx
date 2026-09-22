import { useEffect, type PropsWithChildren } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'

export type EmitterType = 'point' | 'sphere' | 'volume' | 'jet' | 'nozzle' | 'stream' | 'line' | 'ring' | 'radial' | 'spiral' | 'vortex' | 'vortex-ring' | 'orbit' | 'surface' | 'mesh' | 'image-mask' | 'procedural' | 'trail' | 'path' | 'burst' | 'spectrum' | 'spectrum-ring' | 'group'
export type ForceType = 'attractor' | 'repulsor' | 'directional' | 'gravity' | 'vortex' | 'turbulence' | 'damping' | 'flow-volume' | 'audio-impulse'

export interface VolumeEmitterProps {
  id?: string
  type: EmitterType
  species: string
  position?: [number, number, number]
  axis?: [number, number, number]
  direction?: [number, number, number]
  radius?: number
  mass?: number
  circulation?: number
  temperature?: number
  rate?: number
  burstCount?: number
  audio?: string
  bands?: number
  enabled?: boolean
  groupId?: string
}

export interface ForceFieldProps {
  id?: string
  type: ForceType
  strength: number
  position?: [number, number, number]
  direction?: [number, number, number]
  radius?: number
  audio?: string
  post?: boolean
}

function ResourceDeclaration({ id, kind, value }: { id: string; kind: string; value: unknown }) {
  const runtime = useArtinosRuntime()
  useEffect(() => runtime.resources.set(id, value, { kind, owner: 'voluma-authoring' }), [id, kind, runtime, value])
  return null
}

export function VolumetricTank({ children, carrier = 'clear-water', quality = 'draft' }: PropsWithChildren<{ carrier?: string; quality?: string }>) {
  return <group name={`VolumetricTank:${carrier}:${quality}`}>{children}</group>
}

export function SpeciesPalette({ items }: { items: readonly string[] }) {
  return <ResourceDeclaration id="voluma.palette" kind="species-palette" value={items} />
}

export function VolumeEmitter(props: VolumeEmitterProps) {
  const id = props.id ?? 'primary'
  return <ResourceDeclaration id={`voluma.emitter.${id}`} kind="volume-emitter" value={props} />
}

export function ForceField(props: ForceFieldProps) {
  const id = props.id ?? props.type
  return <ResourceDeclaration id={`voluma.force.${id}`} kind="volume-force" value={props} />
}

export function AudioReactor({ source = 'demo', graph = 'voluma-audio-sculpture' }: { source?: 'mic' | 'file' | 'element' | 'demo'; graph?: string }) {
  return <ResourceDeclaration id="voluma.audio.reactor" kind="audio-reactor" value={{ source, graph }} />
}

export function PointerSculptor({ mode = 'vortex' }: { mode?: 'stir' | 'inject' | 'vortex' | 'pull' }) {
  return <ResourceDeclaration id="voluma.pointer-sculptor" kind="pointer-sculptor" value={{ mode, depth: .5 }} />
}
