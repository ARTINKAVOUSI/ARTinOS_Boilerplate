import type { ComponentType } from 'react'

/**
 * The feature contract.
 *
 * A feature is one file under `src/features/` that exports a React component and
 * a `feature` manifest describing it. The app discovers every manifest at build
 * time, renders the component in the right place, and builds its controls into
 * the studio. Delete the file and the feature is gone; paste one in and it
 * appears. Nothing else needs editing.
 *
 * The component never imports this file at runtime (manifests use
 * `import type`), so the component itself stays portable: copied into a project
 * without this app, delete the `feature` export and use the component directly.
 */

/** Presentation every control can carry, whatever its type. */
interface ControlMeta {
  label?: string
  /** Sub-heading the control sits under in its card, e.g. 'Glass Volume'. */
  group?: string
  /** Hidden until the panel's Advanced switch is on. */
  advanced?: boolean
  /** One line shown as the row's tooltip. */
  description?: string
}

export type Control = ControlMeta &
  (
    | { type: 'number'; value: number; min?: number; max?: number; step?: number; unit?: string }
    | { type: 'boolean'; value: boolean }
    | { type: 'select'; value: string; options: readonly string[] }
    | { type: 'color'; value: string }
    | { type: 'vector3'; value: [number, number, number]; step?: number }
    | { type: 'text'; value: string; placeholder?: string }
  )

export type Controls = Record<string, Control>
export type ControlValue = Control['value']
export type Values = Record<string, ControlValue>

/**
 * Where the app mounts the component.
 *
 *   app              app-level, outside the canvas, mounted beside the stage
 *                    (input devices, services). Never wraps anything, so
 *                    switching one never remounts the scene.
 *   canvas-provider  wraps everything inside the canvas (the PostFX pipeline).
 *                    Always mounted; receives `enabled` and must render its
 *                    children either way.
 *   scene            inside the canvas (camera, lights, fog, objects)
 *   effect           inside the canvas, under the PostFX pipeline
 *   overlay          DOM over the canvas (HUDs, monitors). Also receives
 *                    `renderer` and `backend` from the app.
 */
export type FeatureKind = 'app' | 'canvas-provider' | 'scene' | 'effect' | 'overlay'

export interface Feature {
  /** Unique, stable. Persisted state is keyed by it. */
  id: string
  label: string
  kind: FeatureKind
  /** Inspector section. Defaults to the kind. */
  group?: string
  /** Effects: color, blur, light, … Used for grouping in the PostFX browser. */
  category?: string
  /** Mount order for providers/scene, pipeline order for effects. Lower first. */
  order?: number
  /** Whether it is on in a fresh session. Defaults to true. */
  enabled?: boolean
  description?: string
  /** Relative GPU cost, shown in the PostFX browser. */
  cost?: 'low' | 'medium' | 'high' | 'very-high'
  /** Renders nothing without WebGPU. */
  webgpuOnly?: boolean
  controls?: Controls
  component: ComponentType<any>
}

export interface DiscoveredFeature extends Feature {
  /** Source file, for the studio's "copy path" action. */
  path: string
}

/** Resolve a controls schema to its default values. */
export function defaultsOf(controls: Controls | undefined): Values {
  const values: Values = {}
  for (const [key, control] of Object.entries(controls ?? {})) values[key] = control.value
  return values
}
