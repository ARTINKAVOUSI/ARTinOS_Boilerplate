/**
 * The room model: its parameters, the dimensions actually applied to the
 * geometry, and the fit that turns a viewport into room dimensions.
 *
 *   viewport -> aspect -> frustum -> visible world size -> room dimensions
 *
 * Height and depth stay stable; width is the responsive dimension.
 */

export interface RoomParams {
  /** Interior height, world units. */
  height: number
  /** Interior depth to the composition plane, world units. */
  depth: number
  /** Cove / corner radius. */
  radius: number
  /** Extra recess behind the nominal rear wall. */
  rearInset: number
  /** Physical wall thickness: exterior shell offset and front-rim depth. */
  wallThickness: number
  /** Vertical camera FOV in degrees. */
  fov: number
  /** Multiplier on the fitted camera distance. */
  distanceBias: number
  /** Composition safe-area margin as a fraction of the viewport (0.01–0.2). */
  margin: number
  /** Vertical composition bias, -0.5 (floor-heavy) … 0.5 (ceiling-heavy). Clamped to the frustum margin. */
  targetBias: number
}

/** Interior dimensions actually applied to the geometry, damped toward the params. */
export interface RoomDims {
  width: number
  height: number
  /** Nominal depth (the composition plane). */
  depth: number
  /** depth + rearInset: the actual rear wall. */
  totalDepth: number
  radius: number
  wallThickness: number
}

/**
 * Every stage's dimensions. The room needs only the RoomDims part; the other
 * stages also size themselves from the frustum. Unused keys stay 0.
 */
export interface StageDims extends RoomDims {
  /** How far the floor (and open side walls) run past the opening toward the camera. */
  front: number
  /** Open-top stages: a wall height the frustum never sees over. Niche: the facade's top. */
  wallHeight: number
  /** Stages without side walls, and the niche facade: a width that covers the frustum. */
  outerWidth: number
  /** Niche: the arched opening. */
  archWidth: number
  archHeight: number
}

export const STAGE_KEYS = ['width', 'height', 'depth', 'totalDepth', 'radius', 'wallThickness', 'front', 'wallHeight', 'outerWidth', 'archWidth', 'archHeight'] as const satisfies readonly (keyof StageDims)[]

export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

/** Extra interior width beyond the frustum at the rim. */
export const FRONT_PAD = 0.55
/** The frustum never covers more than this share of the room height. */
const MAX_COVER = 0.982

export interface FrustumFit {
  /** Camera distance from the open front plane (z = 0). */
  dist: number
  /** Required interior width. */
  width: number
  /** Visible world width and height at the front plane. */
  visW: number
  visH: number
}

export function fitFrustum(p: RoomParams, aspect: number): FrustumFit {
  const halfV = Math.tan((clamp(p.fov, 8, 110) * Math.PI) / 360)
  const coverage = clamp(1 - p.margin, 0.55, MAX_COVER)
  // Distance at which the vertical frustum covers `coverage` of the room height
  // at the open front, so height and framing stay stable across aspects.
  const distBase = (p.height * coverage) / (2 * halfV)
  // Hard ceiling: however far the distance bias pushes, the frustum never
  // reaches past MAX_COVER of the room height.
  const distMax = (p.height * MAX_COVER) / (2 * halfV)
  const dist = clamp(distBase * p.distanceBias, distBase * 0.22, distMax)
  const visH = 2 * halfV * dist
  const visW = visH * aspect
  // Width follows the aspect, never narrower than an elegant minimum.
  const width = Math.max(visW + FRONT_PAD, p.height * 0.8, p.radius * 2 + 0.4)
  return { dist, width, visW, visH }
}
