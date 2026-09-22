/**
 * Geometry engine — interaction geometry, separated from JSX and CSS.
 *
 * Pure functions over numbers. No DOM, no React, no runtime. That is what lets the
 * same control drive DOM, SVG, canvas or a future non-DOM renderer without the
 * mechanics being rewritten per renderer (PRD §21).
 */

export type Orientation = 'horizontal' | 'vertical'

export interface LinearSpec {
  /** Pixel length of the rail along its axis. */
  length: number
  value: number
  min: number
  max: number
  orientation?: Orientation
  /** Right-to-left, or a vertical rail that grows upward. */
  inverted?: boolean
  direction?: 'ltr' | 'rtl'
  /** Values that should render a detent mark. */
  detents?: readonly number[]
}

export interface LinearGeometry {
  /** Value mapped to 0..1 across the range. */
  normalized: number
  /** Position of the thumb along the rail, in px from the rail origin. */
  thumb: number
  /** Filled portion, in px. */
  fill: number
  /** Detent positions in px, in rail space. */
  detents: number[]
  /** Total travel available to a drag, in px. */
  travel: number
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Normalizes a value into 0..1 without clamping the caller's intent. */
export function normalize(value: number, min: number, max: number): number {
  const span = max - min
  return span === 0 ? 0 : (value - min) / span
}

/** Inverse of `normalize`. */
export function denormalize(t: number, min: number, max: number): number {
  return min + t * (max - min)
}

export function linearGeometry(spec: LinearSpec): LinearGeometry {
  const { length, value, min, max, inverted = false, direction = 'ltr', detents = [] } = spec
  const reverse = inverted !== (direction === 'rtl')
  const raw = clamp01(normalize(value, min, max))
  const normalized = reverse ? 1 - raw : raw
  const thumb = normalized * length
  return {
    normalized: raw,
    thumb,
    fill: thumb,
    travel: length,
    detents: detents.map(d => {
      const t = clamp01(normalize(d, min, max))
      return (reverse ? 1 - t : t) * length
    }),
  }
}

/**
 * Value under a pointer at `offset` px along the rail.
 *
 * Kept separate from `linearGeometry` because hit-testing runs per pointer event
 * while geometry runs per render; they have different lifetimes.
 */
export function valueAtOffset(offset: number, spec: LinearSpec): number {
  const { length, min, max, inverted = false, direction = 'ltr' } = spec
  const reverse = inverted !== (direction === 'rtl')
  if (length <= 0) return min
  const t = clamp01(offset / length)
  return denormalize(reverse ? 1 - t : t, min, max)
}

/**
 * Value change for a pointer delta. Used by scrub/drag, where the gesture is
 * relative to where it started rather than absolute along a rail.
 */
export function valueForDelta(delta: number, spec: LinearSpec, sensitivity = 1): number {
  const { length, min, max, inverted = false, direction = 'ltr' } = spec
  if (length <= 0) return 0
  const signed = inverted !== (direction === 'rtl') ? -delta : delta
  return (signed / length) * (max - min) * sensitivity
}

export interface AngularSpec {
  value: number
  min: number
  max: number
  /** Total sweep in degrees. Instrument dials conventionally use 270. */
  sweep?: number
  /** Degrees of the sweep's midpoint from 12 o'clock. */
  offset?: number
}

export interface AngularGeometry {
  normalized: number
  /** Pointer angle in degrees, 0 = 12 o'clock, clockwise positive. */
  angle: number
  startAngle: number
  endAngle: number
}

export function angularGeometry(spec: AngularSpec): AngularGeometry {
  const { value, min, max, sweep = 270, offset = 0 } = spec
  const normalized = clamp01(normalize(value, min, max))
  const startAngle = offset - sweep / 2
  return {
    normalized,
    angle: startAngle + normalized * sweep,
    startAngle,
    endAngle: offset + sweep / 2,
  }
}

/** Vertical travel, in px, that covers the dial's full range. */
export const DIAL_TRAVEL = 160

export interface PlanarSpec {
  width: number
  height: number
  x: number
  y: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  /** Screen y grows downward; most XY pads want the value axis to grow upward. */
  flipY?: boolean
}

export interface PlanarGeometry {
  normalized: { x: number; y: number }
  handle: { x: number; y: number }
}

export function planarGeometry(spec: PlanarSpec): PlanarGeometry {
  const { width, height, x, y, minX, maxX, minY, maxY, flipY = true } = spec
  const nx = clamp01(normalize(x, minX, maxX))
  const nyRaw = clamp01(normalize(y, minY, maxY))
  const ny = flipY ? 1 - nyRaw : nyRaw
  return { normalized: { x: nx, y: nyRaw }, handle: { x: nx * width, y: ny * height } }
}

export interface RangeGeometry {
  start: LinearGeometry
  end: LinearGeometry
  fillStart: number
  fillEnd: number
  fillLength: number
}

export function rangeGeometry(spec: Omit<LinearSpec, 'value'> & { value: readonly [number, number] }): RangeGeometry {
  const start = linearGeometry({ ...spec, value: spec.value[0] })
  const end = linearGeometry({ ...spec, value: spec.value[1] })
  const fillStart = Math.min(start.thumb, end.thumb)
  const fillEnd = Math.max(start.thumb, end.thumb)
  return { start, end, fillStart, fillEnd, fillLength: fillEnd - fillStart }
}

export interface SpatialGeometry {
  normalized: number[]
  position: number[]
}

export function spatialGeometry(
  values: readonly number[],
  minimums: readonly number[],
  maximums: readonly number[],
  extents: readonly number[],
  invert: readonly boolean[] = [],
): SpatialGeometry {
  const normalized = values.map((value, index) => {
    const t = clamp01(normalize(value, minimums[index] ?? 0, maximums[index] ?? 1))
    return invert[index] ? 1 - t : t
  })
  return { normalized, position: normalized.map((value, index) => value * (extents[index] ?? 0)) }
}

export const xyGeometry = (
  value: readonly [number, number],
  min: readonly [number, number],
  max: readonly [number, number],
  size: readonly [number, number],
): SpatialGeometry => spatialGeometry(value, min, max, size, [false, true])

export const xyzGeometry = (
  value: readonly [number, number, number],
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  size: readonly [number, number, number],
): SpatialGeometry => spatialGeometry(value, min, max, size)

export interface ColorPlaneGeometry extends PlanarGeometry {
  hue?: number
}

export function colorPlaneGeometry(spec: PlanarSpec & { hue?: number }): ColorPlaneGeometry {
  return { ...planarGeometry(spec), hue: spec.hue }
}

export interface PositionedPoint {
  id?: string
  x: number
  y: number
}

export function gradientStopGeometry(
  stops: readonly { id?: string; offset: number }[],
  length: number,
  direction: 'ltr' | 'rtl' = 'ltr',
): PositionedPoint[] {
  return stops.map(stop => ({ id: stop.id, x: (direction === 'rtl' ? 1 - clamp01(stop.offset) : clamp01(stop.offset)) * length, y: 0 }))
}

export function curveGeometry(
  points: readonly { id?: string; x: number; y: number }[],
  width: number,
  height: number,
  flipY = true,
): PositionedPoint[] {
  return points.map(point => ({ id: point.id, x: clamp01(point.x) * width, y: (flipY ? 1 - clamp01(point.y) : clamp01(point.y)) * height }))
}

export function envelopeGeometry(
  value: { attack: number; decay: number; sustain: number; release: number; delay?: number; hold?: number },
  width: number,
  height: number,
): PositionedPoint[] {
  const delay = Math.max(0, value.delay ?? 0)
  const attack = Math.max(0, value.attack)
  const hold = Math.max(0, value.hold ?? 0)
  const decay = Math.max(0, value.decay)
  const release = Math.max(0, value.release)
  const total = delay + attack + hold + decay + release || 1
  const times = [0, delay, delay + attack, delay + attack + hold, delay + attack + hold + decay, total]
  const levels = [0, 0, 1, 1, clamp01(value.sustain), 0]
  return times.map((time, index) => ({ x: time / total * width, y: (1 - levels[index]) * height }))
}

export interface RadialGeometry extends AngularGeometry {
  center: { x: number; y: number }
  handle: { x: number; y: number }
  radius: number
}

export function radialGeometry(spec: AngularSpec & { centerX: number; centerY: number; radius: number }): RadialGeometry {
  const angular = angularGeometry(spec)
  const radians = (angular.angle - 90) * Math.PI / 180
  return {
    ...angular,
    center: { x: spec.centerX, y: spec.centerY },
    radius: spec.radius,
    handle: { x: spec.centerX + Math.cos(radians) * spec.radius, y: spec.centerY + Math.sin(radians) * spec.radius },
  }
}

export interface HitArea {
  x: number
  y: number
  width: number
  height: number
}

export function expandHitArea(area: HitArea, minimum = 44): HitArea {
  const width = Math.max(area.width, minimum)
  const height = Math.max(area.height, minimum)
  return { x: area.x - (width - area.width) / 2, y: area.y - (height - area.height) / 2, width, height }
}

export function hitTest(point: { x: number; y: number }, area: HitArea): boolean {
  return point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height
}
