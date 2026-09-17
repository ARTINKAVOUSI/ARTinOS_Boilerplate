/**
 * Graphics binding adapters (PRD §11, §60, §61).
 *
 * A parameter drives a Three/TSL target through the runtime's frame coordinator,
 * so the path is
 *
 *   pointer → parameter → frame scheduler → Three / TSL / GPU
 *
 * and never
 *
 *   pointer → setState → React render → effect → Three update.
 *
 * Targets are typed structurally so this file adds no `three` dependency to
 * `@artinos/ui` — anything with the right shape binds, including a TSL uniform
 * node or a plain object.
 */

import type { ArtinosRuntime } from '@artinos/runtime'

/** Anything with a settable `.value`, which covers TSL uniforms and refs. */
export interface ValueTarget<T = number> {
  value: T
}

/** Minimal Object3D surface: enough for transforms without importing three. */
export interface Vector3Like {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): unknown
}
export interface Vector2Like { x: number; y: number; set(x: number, y: number): unknown }
export interface Vector4Like { x: number; y: number; z: number; w: number; set(x: number, y: number, z: number, w: number): unknown }
export interface MatrixLike { fromArray(values: ArrayLike<number>): unknown }

export interface ColorLike {
  set(value: string | number): unknown
}

export type Unbind = () => void

export interface BindOptions {
  /** Frame phase to apply on. Graphics writes belong before render. */
  phase?: 'parameters' | 'before-render' | 'simulation' | 'compute'
  /** Cap the apply rate, in Hz. Omit to apply every frame the value is dirty. */
  frequency?: number
  /** Read the resolved value (bindings + automation) rather than the base. */
  resolved?: boolean
  /** Stable owner suffix when the same parameter drives multiple targets. */
  taskId?: string
  /** Invalidate cached material/projection state after a write. */
  invalidate?(): void
}

let bindingSequence = 0

/**
 * Applies a parameter to an arbitrary setter on the frame boundary.
 *
 * The setter runs only when the value actually changed, so a bound parameter
 * that is not moving costs one comparison per frame.
 */
export function bindParameter<T>(
  runtime: ArtinosRuntime,
  id: string,
  apply: (value: T) => void,
  options: BindOptions = {},
): Unbind {
  const { phase = 'before-render', frequency, resolved = true } = options
  const taskId = options.taskId ?? `target-${++bindingSequence}`
  let last: T | undefined
  let primed = false

  return runtime.frames.add({
    id: `bind.${id}.${phase}.${taskId}`,
    phase,
    frequency,
    run: () => {
      const state = runtime.parameters.state(id)
      if (!state) return
      const next = (resolved ? state.resolvedValue : state.baseValue) as T
      if (primed && Object.is(next, last)) return
      last = next
      primed = true
      apply(next)
      options.invalidate?.()
    },
  })
}

export function bindVector2(runtime: ArtinosRuntime, id: string, target: Vector2Like, options?: BindOptions): Unbind {
  return bindParameter<number[]>(runtime, id, value => { if (Array.isArray(value) && value.length >= 2) target.set(value[0], value[1]) }, options)
}

/** Numeric parameter → any `{ value }` target: TSL uniform, ref, plain object. */
export function bindUniform(
  runtime: ArtinosRuntime,
  id: string,
  target: ValueTarget,
  options?: BindOptions,
): Unbind {
  return bindParameter<number>(runtime, id, v => {
    target.value = v
  }, options)
}

export function bindVector4(runtime: ArtinosRuntime, id: string, target: Vector4Like, options?: BindOptions): Unbind {
  return bindParameter<number[]>(runtime, id, value => { if (Array.isArray(value) && value.length >= 4) target.set(value[0], value[1], value[2], value[3]) }, options)
}

export const bindEuler = bindVector3
export const bindQuaternion = bindVector4

export function bindMatrix(runtime: ArtinosRuntime, id: string, target: MatrixLike, options?: BindOptions): Unbind {
  return bindParameter<number[]>(runtime, id, value => { if (Array.isArray(value)) target.fromArray(value) }, options)
}

export function bindTexture(runtime: ArtinosRuntime, id: string, target: ValueTarget<unknown>, resolve: (asset: unknown) => unknown, options?: BindOptions): Unbind {
  return bindParameter<unknown>(runtime, id, value => { target.value = resolve(value) }, options)
}

export function bindMaterialProperty<O extends object, K extends keyof O>(runtime: ArtinosRuntime, id: string, material: O & { needsUpdate?: boolean }, key: K, options?: BindOptions): Unbind {
  return bindProperty(runtime, id, material, key, { ...options, invalidate: () => { material.needsUpdate = true; options?.invalidate?.() } })
}

export function bindCameraProperty<O extends object, K extends keyof O>(runtime: ArtinosRuntime, id: string, camera: O & { updateProjectionMatrix?(): void }, key: K, options?: BindOptions): Unbind {
  return bindProperty(runtime, id, camera, key, { ...options, invalidate: () => { camera.updateProjectionMatrix?.(); options?.invalidate?.() } })
}

/** Numeric parameter → a named property on an object (material.roughness, …). */
export function bindProperty<O extends object, K extends keyof O>(
  runtime: ArtinosRuntime,
  id: string,
  target: O,
  key: K,
  options?: BindOptions,
): Unbind {
  return bindParameter<O[K]>(runtime, id, v => {
    target[key] = v
  }, options)
}

/** vec3 parameter → a Vector3-like (position, scale, rotation). */
export function bindVector3(
  runtime: ArtinosRuntime,
  id: string,
  target: Vector3Like,
  options?: BindOptions,
): Unbind {
  return bindParameter<number[] | undefined>(runtime, id, v => {
    if (!Array.isArray(v) || v.length < 3) return
    target.set(v[0], v[1], v[2])
  }, options)
}

/** color parameter → a Color-like. */
export function bindColor(
  runtime: ArtinosRuntime,
  id: string,
  target: ColorLike,
  options?: BindOptions,
): Unbind {
  return bindParameter<string>(runtime, id, v => {
    if (typeof v === 'string') target.set(v)
  }, options)
}

/**
 * Binds a whole object at once: `{ intensity: 'light.intensity' }`.
 *
 * Returns one unbind that releases every task, so a component's cleanup stays a
 * single call regardless of how many properties it bound.
 */
export function bindThree<O extends object>(
  runtime: ArtinosRuntime,
  target: O,
  map: Partial<Record<keyof O, string>>,
  options?: BindOptions,
): Unbind {
  const unbinds: Unbind[] = []
  for (const [key, id] of Object.entries(map) as Array<[keyof O, string | undefined]>) {
    if (!id) continue
    const current = target[key] as unknown
    // A Vector3/Color exposes `set`; a scalar does not. Pick the right writer
    // rather than clobbering the object with a number.
    if (current && typeof (current as Vector3Like).set === 'function' && 'x' in (current as object) && 'w' in (current as object)) {
      unbinds.push(bindVector4(runtime, id, current as Vector4Like, options))
    } else if (current && typeof (current as Vector3Like).set === 'function' && 'x' in (current as object) && 'z' in (current as object)) {
      unbinds.push(bindVector3(runtime, id, current as Vector3Like, options))
    } else if (current && typeof (current as Vector2Like).set === 'function' && 'x' in (current as object)) {
      unbinds.push(bindVector2(runtime, id, current as Vector2Like, options))
    } else if (current && typeof (current as MatrixLike).fromArray === 'function') {
      unbinds.push(bindMatrix(runtime, id, current as MatrixLike, options))
    } else if (current && typeof (current as ColorLike).set === 'function') {
      unbinds.push(bindColor(runtime, id, current as ColorLike, options))
    } else {
      unbinds.push(bindProperty(runtime, id, target, key, options))
    }
  }
  return () => unbinds.forEach(u => u())
}

/**
 * Mirrors a parameter onto a CSS custom property.
 *
 * The same frame-scheduled path for DOM chrome that reacts to realtime values —
 * a meter, a glow, an overlay — without re-rendering React.
 */
export function bindCssVariable(
  runtime: ArtinosRuntime,
  id: string,
  element: HTMLElement,
  property: string,
  format: (value: unknown) => string = String,
  options?: BindOptions,
): Unbind {
  return bindParameter<unknown>(runtime, id, v => {
    element.style.setProperty(property, format(v))
  }, options)
}
