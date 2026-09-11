/**
 * Physics — part of the UI language, not a decoration (PRD §20).
 *
 * Integrators are pure and frame-driven: the caller owns the clock, so the same
 * spring can be stepped by rAF, by an R3F frame task, or by a test at fixed dt.
 */

export interface SpringConfig {
  /** Higher is snappier. */
  stiffness: number
  /** Higher settles sooner; at critical damping there is no overshoot. */
  damping: number
  mass: number
  /** Distance and velocity below which the spring is considered at rest. */
  restDelta: number
}

export interface SpringState {
  value: number
  velocity: number
  target: number
}

/** Semantic presets. Components should name a feel, not tune numbers inline. */
export const SPRING: Record<string, SpringConfig> = {
  /** No overshoot. For values a user is reading while it moves. */
  precise: { stiffness: 420, damping: 40, mass: 1, restDelta: 0.001 },
  soft: { stiffness: 180, damping: 26, mass: 1, restDelta: 0.001 },
  mechanical: { stiffness: 700, damping: 52, mass: 1, restDelta: 0.001 },
  elastic: { stiffness: 320, damping: 18, mass: 1, restDelta: 0.001 },
  magnetic: { stiffness: 900, damping: 60, mass: 1, restDelta: 0.0005 },
  heavy: { stiffness: 160, damping: 34, mass: 2.4, restDelta: 0.001 },
}

/** One semi-implicit Euler step. Returns a new state; never mutates. */
export function stepSpring(state: SpringState, config: SpringConfig, dt: number): SpringState {
  // Clamp dt so a backgrounded tab cannot explode the integrator on resume.
  const h = Math.min(dt, 0.064)
  const displacement = state.value - state.target
  const acceleration = (-config.stiffness * displacement - config.damping * state.velocity) / config.mass
  const velocity = state.velocity + acceleration * h
  return { ...state, velocity, value: state.value + velocity * h }
}

export function springAtRest(state: SpringState, config: SpringConfig): boolean {
  return Math.abs(state.value - state.target) < config.restDelta && Math.abs(state.velocity) < config.restDelta
}

export interface InertiaConfig {
  /** Fraction of velocity retained per second. */
  friction: number
  /** Below this speed the glide stops. */
  restVelocity: number
}

export const INERTIA: Record<string, InertiaConfig> = {
  free: { friction: 0.02, restVelocity: 0.002 },
  inertial: { friction: 0.08, restVelocity: 0.002 },
  damped: { friction: 0.4, restVelocity: 0.004 },
}

export interface PhysicsProfile {
  id: 'precise' | 'soft' | 'mechanical' | 'elastic' | 'magnetic' | 'inertial'
  spring: SpringConfig
  inertia?: InertiaConfig
  bounds: 'clamp' | 'elastic' | 'wrap'
  detentStrength?: number
  reducedMotion?: 'instant' | 'short'
}

export const PHYSICS_PROFILES: Record<PhysicsProfile['id'], PhysicsProfile> = {
  precise: { id: 'precise', spring: SPRING.precise, bounds: 'clamp', reducedMotion: 'instant' },
  soft: { id: 'soft', spring: SPRING.soft, bounds: 'clamp', reducedMotion: 'short' },
  mechanical: { id: 'mechanical', spring: SPRING.mechanical, bounds: 'clamp', detentStrength: 0.8, reducedMotion: 'instant' },
  elastic: { id: 'elastic', spring: SPRING.elastic, bounds: 'elastic', reducedMotion: 'short' },
  magnetic: { id: 'magnetic', spring: SPRING.magnetic, bounds: 'clamp', detentStrength: 1, reducedMotion: 'short' },
  inertial: { id: 'inertial', spring: SPRING.soft, inertia: INERTIA.inertial, bounds: 'elastic', reducedMotion: 'short' },
}

export interface PhysicalState extends SpringState {
  phase: 'idle' | 'inertia' | 'spring'
}

export function stepPhysicalState(
  state: PhysicalState,
  profile: PhysicsProfile,
  dt: number,
): PhysicalState {
  if (state.phase === 'idle') return state
  if (state.phase === 'inertia' && profile.inertia) {
    const next = stepInertia(state.value, state.velocity, profile.inertia, dt)
    if (!next.done) return { ...state, value: next.value, velocity: next.velocity }
    return { ...state, value: next.value, velocity: next.velocity, phase: 'spring' }
  }
  const next = stepSpring(state, profile.spring, dt)
  return springAtRest(next, profile.spring)
    ? { value: state.target, target: state.target, velocity: 0, phase: 'idle' }
    : { ...next, phase: 'spring' }
}

export function settlePhysicalState(
  state: PhysicalState,
  profile: PhysicsProfile,
  dt = 1 / 120,
  maxSteps = 1_200,
): PhysicalState {
  let next = state
  for (let index = 0; index < maxSteps && next.phase !== 'idle'; index++) next = stepPhysicalState(next, profile, dt)
  return next
}

export function reduceMotionProfile(profile: PhysicsProfile, reducedMotion: boolean): PhysicsProfile {
  if (!reducedMotion) return profile
  return {
    ...profile,
    spring: { ...SPRING.precise, stiffness: 1_200, damping: 120, restDelta: 0.01 },
    inertia: undefined,
    bounds: 'clamp',
    detentStrength: 0,
  }
}

export function collideBounds(value: number, velocity: number, min: number, max: number, restitution = 0.18) {
  if (value < min) return { value: min, velocity: Math.abs(velocity) * restitution }
  if (value > max) return { value: max, velocity: -Math.abs(velocity) * restitution }
  return { value, velocity }
}

export function nearestDetent(value: number, detents: readonly number[]): { value: number; distance: number } | undefined {
  if (!detents.length) return undefined
  let nearest = detents[0]
  let distance = Math.abs(value - nearest)
  for (const detent of detents.slice(1)) {
    const next = Math.abs(value - detent)
    if (next < distance) { nearest = detent; distance = next }
  }
  return { value: nearest, distance }
}

export function detentForce(value: number, detents: readonly number[], radius: number, strength = 1): number {
  const nearest = nearestDetent(value, detents)
  if (!nearest || nearest.distance > radius || radius <= 0) return 0
  return (nearest.value - value) * (1 - nearest.distance / radius) * strength
}

export function stepInertia(
  value: number,
  velocity: number,
  config: InertiaConfig,
  dt: number,
): { value: number; velocity: number; done: boolean } {
  const h = Math.min(dt, 0.064)
  const decayed = velocity * Math.pow(config.friction, h)
  return { value: value + decayed * h, velocity: decayed, done: Math.abs(decayed) < config.restVelocity }
}

/**
 * Resistance approaching a bound: travel compresses as it nears the limit, so a
 * bound is felt before it is hit rather than arriving as a hard stop.
 */
export function elasticBound(value: number, min: number, max: number, give = 0.12): number {
  const span = max - min || 1
  if (value < min) return min - (1 - Math.exp((value - min) / (span * give))) * span * give
  if (value > max) return max + (1 - Math.exp((max - value) / (span * give))) * span * give
  return value
}
