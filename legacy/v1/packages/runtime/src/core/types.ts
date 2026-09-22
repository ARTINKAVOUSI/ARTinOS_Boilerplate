export type Unsubscribe = () => void

export type Scalar = string | number | boolean | null
export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]
export type RangeValue = [number, number]
export type QuaternionValue = [number, number, number, number]
export type MatrixValue = number[]

export interface GradientStop {
  id?: string
  offset: number
  color: string
}

export interface GradientValue {
  kind?: 'linear' | 'radial' | 'conic'
  angle?: number
  stops: GradientStop[]
}

export interface CurvePoint {
  id?: string
  x: number
  y: number
  inTangent?: Vec2
  outTangent?: Vec2
  interpolation?: 'step' | 'linear' | 'bezier' | 'smooth'
}

export interface CurveValue {
  points: CurvePoint[]
  closed?: boolean
}

export interface EnvelopeValue {
  attack: number
  decay: number
  sustain: number
  release: number
  delay?: number
  hold?: number
}

/** Serializable handle to an application-owned resource. Runtime values never own the resource itself. */
export interface AssetReference {
  id: string
  kind?: 'asset' | 'image' | 'texture' | 'video' | 'audio'
  uri?: string
  label?: string
  mimeType?: string
  metadata?: Record<string, unknown>
}

/** Stable semantic reference. This deliberately excludes live object instances. */
export interface ObjectReference {
  id: string
  path?: string
  label?: string
  type?: string
}

export type ParameterValue =
  | Scalar
  | Vec2
  | Vec3
  | Vec4
  | number[]
  | GradientValue
  | CurveValue
  | EnvelopeValue
  | AssetReference
  | ObjectReference
  | Record<string, unknown>

export const BUILT_IN_PARAMETER_KINDS = [
  'number', 'integer', 'boolean', 'string', 'enum', 'range',
  'vec2', 'vec3', 'vec4',
  'angle', 'distance', 'percentage', 'time', 'frequency',
  'color', 'gradient', 'curve', 'envelope', 'matrix', 'quaternion',
  'asset', 'image', 'texture', 'video', 'audio', 'object-reference', 'path', 'custom',
] as const

export type BuiltInParameterKind = typeof BUILT_IN_PARAMETER_KINDS[number]
/** Built-ins are discoverable while namespaced plug-in kinds remain legal. */
export type ParameterKind = BuiltInParameterKind | `custom:${string}` | (string & {})

export type UnitDimension =
  | 'none' | 'angle' | 'distance' | 'ratio' | 'time' | 'frequency'
  | 'temperature' | 'mass' | 'data' | (string & {})

export interface UnitDefinition {
  id: string
  symbol: string
  dimension: UnitDimension
  /** Multiplier used when converting this unit to its dimension's canonical unit. */
  scale: number
  /** Offset applied before scale when converting to the canonical unit. */
  offset?: number
  precision?: number
  aliases?: string[]
  format?(value: number, locale?: string): string
}

export type UnitReference = string | UnitDefinition | null

export interface ParameterPresentationHints {
  preferred?: string
  allowed?: string[]
  hidden?: boolean
  readOnly?: boolean
  compact?: boolean
  importance?: 'primary' | 'secondary' | 'advanced'
  orientation?: 'horizontal' | 'vertical'
  precision?: number
  logarithmic?: boolean
  colorSpace?: string
  multiline?: boolean
  placeholder?: string
  [key: string]: unknown
}

export interface ParameterLayoutHints {
  span?: number
  minSpan?: number
  maxSpan?: number
  row?: number
  column?: number
  priority?: number
  collapsible?: boolean
}

export interface ParameterValidationResult {
  valid: boolean
  code?: string
  message?: string
  details?: Record<string, unknown>
}

export interface ParameterValidation<T extends ParameterValue = ParameterValue> {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string | RegExp
  validate?(value: T): ParameterValidationResult | boolean | string
}

export type ParameterScheduleMode =
  | 'immediate' | 'microtask' | 'animation-frame' | 'render-frame'
  | 'idle' | 'manual' | 'debounced' | 'throttled'

export interface ParameterSourceInfo {
  id: string
  kind: 'ui' | 'binding' | 'automation' | 'preset' | 'snapshot' | 'agent' | 'graph' | 'input' | 'plugin' | (string & {})
  label?: string
  priority?: number
  enabled?: boolean
  metadata?: Record<string, unknown>
}

export interface ParameterWriteOptions {
  source?: ParameterSourceInfo['kind']
  sourceId?: string
  schedule?: ParameterScheduleMode
  label?: string
  transient?: boolean
  recordHistory?: boolean
  timestamp?: number
}

export interface ParameterDefinition<T extends ParameterValue = ParameterValue, K extends ParameterKind = ParameterKind> {
  id: string
  label?: string
  type: K
  defaultValue: T
  min?: number
  max?: number
  step?: number
  options?: Array<{ label: string; value: Scalar; disabled?: boolean }>
  group?: string
  subgroup?: string
  description?: string
  /** Unit id, inline unit definition, or null. Legacy string ids remain accepted. */
  unit?: UnitReference
  validation?: ParameterValidation<T>
  presentation?: ParameterPresentationHints
  layout?: ParameterLayoutHints
  schedule?: ParameterScheduleMode
  metadata?: Record<string, unknown>
  modulatable?: boolean
  automatable?: boolean
  persist?: boolean
  advanced?: boolean
  order?: number
  tags?: string[]
  serialize?(value: T): unknown
  deserialize?(value: unknown): T
  format?(value: T): string
  parse?(input: string): T
}

export interface SignalSample<T = unknown> {
  id: string
  value: T
  timestamp: number
  previous?: T
  metadata?: Record<string, unknown>
}

export interface RuntimeSnapshotV1 {
  version: 1
  createdAt: number
  parameters: Record<string, ParameterValue>
  quality: { tier: string; scalar: number; mode: string; targetFps: number }
  bindings: Array<Record<string, unknown>>
  automation?: Array<Record<string, unknown>>
  presets?: Array<{ id: string; label: string; group?: string; description?: string; values: Record<string, ParameterValue>; tags?: string[] }>
  actions?: Array<Record<string, unknown>>
  signalPipelines?: Array<Record<string, unknown>>
  projectState?: Record<string, unknown>
}

export interface RuntimeSnapshotV2 extends Omit<RuntimeSnapshotV1, 'version' | 'parameters'> {
  version: 2
  parameters: Record<string, unknown>
  parameterDefinitions?: ParameterDefinition[]
  metadata?: Record<string, unknown>
}

/** Persistence accepts both formats; RuntimePersistence performs the v1 to v2 migration. */
export type RuntimeSnapshot = RuntimeSnapshotV1 | RuntimeSnapshotV2
