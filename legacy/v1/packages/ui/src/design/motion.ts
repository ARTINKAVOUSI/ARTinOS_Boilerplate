import { PHYSICS_PROFILES, type PhysicsProfile } from '../kernel/physics'

export type MotionProfileId = 'immediate' | 'micro' | 'enter' | 'exit' | 'expand' | 'collapse' | 'transfer'
export type DragProfileId = 'precision' | 'free' | 'inertial'
export type SnapProfileId = 'soft' | 'mechanical' | 'magnetic'

export interface MotionProfile {
  id: MotionProfileId
  duration: number
  easing: string
  interruptible: boolean
  distance?: number
  opacity?: boolean
}

export const MOTION_PROFILES: Record<MotionProfileId, MotionProfile> = {
  immediate: { id: 'immediate', duration: 0, easing: 'linear', interruptible: true },
  micro: { id: 'micro', duration: 70, easing: 'cubic-bezier(0.2,0.7,0.2,1)', interruptible: true },
  enter: { id: 'enter', duration: 180, easing: 'cubic-bezier(0.16,1,0.3,1)', interruptible: true, distance: 6, opacity: true },
  exit: { id: 'exit', duration: 90, easing: 'cubic-bezier(0.4,0,1,1)', interruptible: true, distance: 4, opacity: true },
  expand: { id: 'expand', duration: 220, easing: 'cubic-bezier(0.2,0.7,0.2,1)', interruptible: true },
  collapse: { id: 'collapse', duration: 140, easing: 'cubic-bezier(0.4,0,1,1)', interruptible: true },
  transfer: { id: 'transfer', duration: 280, easing: 'cubic-bezier(0.16,1,0.3,1)', interruptible: true, distance: 12 },
}

export const DRAG_PROFILES: Record<DragProfileId, { precision: number; velocityGain: number; physics: PhysicsProfile['id'] }> = {
  precision: { precision: 0.1, velocityGain: 0, physics: 'precise' },
  free: { precision: 1, velocityGain: 0.5, physics: 'soft' },
  inertial: { precision: 1, velocityGain: 1, physics: 'inertial' },
}

export const SNAP_PROFILES: Record<SnapProfileId, { radius: number; physics: PhysicsProfile['id'] }> = {
  soft: { radius: 0.025, physics: 'soft' },
  mechanical: { radius: 0.018, physics: 'mechanical' },
  magnetic: { radius: 0.04, physics: 'magnetic' },
}

export function resolveMotion(id: MotionProfileId, reducedMotion = false): MotionProfile {
  const profile = MOTION_PROFILES[id]
  if (!reducedMotion) return profile
  return { ...profile, duration: id === 'immediate' ? 0 : Math.min(50, profile.duration), distance: 0, opacity: false }
}

export function motionVariables(id: MotionProfileId, reducedMotion = false): Record<string, string> {
  const motion = resolveMotion(id, reducedMotion)
  return {
    '--motion-duration': `${motion.duration}ms`,
    '--motion-easing': motion.easing,
    '--motion-distance': `${motion.distance ?? 0}px`,
  }
}

export function physicsForMotion(
  profile: PhysicsProfile['id'],
  reducedMotion = false,
): PhysicsProfile {
  if (!reducedMotion) return PHYSICS_PROFILES[profile]
  return {
    ...PHYSICS_PROFILES.precise,
    spring: { ...PHYSICS_PROFILES.precise.spring, stiffness: 1_200, damping: 120 },
    inertia: undefined,
  }
}
