import type { ComponentType, ReactNode } from 'react'
import type { BindingDefinition, ModuleManifest, ParameterDefinition, Preset, ArtinosRuntime, Unsubscribe } from '@artinos/runtime'
import type { GraphDefinition } from '@artinos/graph'

export type ArtinosShell = 'studio' | 'minimal' | 'metablock' | 'panels'

export interface ArtinosRendererConfig {
  backend?: 'auto' | 'webgpu' | 'webgl2'
  dpr?: number | [number, number]
  shadows?: boolean
  postfx?: boolean
  alpha?: boolean
  antialias?: boolean
  powerPreference?: 'default' | 'high-performance' | 'low-power'
  threeInspector?: boolean
  threeInspectorVisible?: boolean
}

/**
 * Which parts of the shared stage a project keeps. A preset scene that owns its
 * own camera, lights or backdrop turns the matching sections off so the two
 * never fight. Render settings (tone mapping, DPR, shadow maps) always stay on.
 */
export interface ArtinosStageOptions {
  environment?: boolean
  camera?: boolean
  controls?: boolean
  lighting?: boolean
  shadows?: boolean
  fog?: boolean
  grid?: boolean
}

export interface ArtinosProjectContext { runtime: ArtinosRuntime }
export type ProjectCleanup = void | Unsubscribe | Array<Unsubscribe | void>

export interface ArtinosProject {
  id: string
  name: string
  version?: string
  description?: string
  default?: boolean
  shell?: ArtinosShell
  renderer?: ArtinosRendererConfig
  /** Stage sections to mount (all by default); `false` keeps only render settings. */
  stage?: false | ArtinosStageOptions
  telemetry?: boolean
  adaptiveQuality?: boolean
  Content: ComponentType
  Overlay?: ComponentType
  parameters?: ParameterDefinition[]
  modules?: ModuleManifest[]
  presets?: Preset[]
  bindings?: BindingDefinition[]
  graphs?: GraphDefinition[]
  setup?(context: ArtinosProjectContext): ProjectCleanup
  loading?: ReactNode
}

export function defineArtinosProject<const T extends ArtinosProject>(project:T):T { return project }

export function normalizeCleanup(cleanup:ProjectCleanup):Unsubscribe {
  const callbacks=(Array.isArray(cleanup)?cleanup:[cleanup]).filter((item):item is Unsubscribe=>typeof item==='function')
  return()=>{for(let index=callbacks.length-1;index>=0;index--)callbacks[index]()}
}
