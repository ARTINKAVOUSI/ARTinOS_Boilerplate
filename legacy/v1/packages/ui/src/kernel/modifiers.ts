/**
 * Interaction modifiers — composable value transforms (PRD §19).
 *
 * Each modifier is `(value, context) => value`. They compose into a pipeline so a
 * control declares *what* its mechanics are rather than re-implementing them.
 */

export interface ModifierContext {
  min: number
  max: number
  step: number
  /** Held modifier keys, normalized by the interaction engine. */
  keys: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean }
  /** px/ms along the drag axis, signed. */
  velocity: number
  elapsed?: number
  axis?: 'x' | 'y' | 'z'
  requests?: Set<'inertia' | 'spring'>
}

export type Modifier = (value: number, context: ModifierContext) => number
export interface ModifierDefinition {
  id: string
  apply: Modifier
  metadata?: Record<string, unknown>
}
export interface ModifierPipeline extends ModifierDefinition {
  modifiers: ModifierDefinition[]
}

export const clamp: Modifier = (v, c) => (v < c.min ? c.min : v > c.max ? c.max : v)

/** Wraps around the range instead of stopping at it — angles, hues, phase. */
export const wrap: Modifier = (v, c) => {
  const span = c.max - c.min
  if (span <= 0) return c.min
  return c.min + ((((v - c.min) % span) + span) % span)
}

export const quantize: Modifier = (v, c) => {
  if (!c.step) return v
  return Math.round(v / c.step) * c.step
}

/**
 * Snaps to the nearest detent, but only inside `radius` — outside it the value
 * passes through untouched, so detents assist rather than fight the pointer.
 */
export function magnet(detents: readonly number[], radius: number): Modifier {
  return (v, c) => {
    if (!detents.length) return v
    const scale = radius * (c.max - c.min)
    let best = v
    let bestDistance = Infinity
    for (const d of detents) {
      const distance = Math.abs(d - v)
      if (distance < bestDistance) {
        bestDistance = distance
        best = d
      }
    }
    return bestDistance <= scale ? best : v
  }
}

/**
 * Precision mode. Scales the *delta*, so it must be applied to a delta pipeline
 * rather than an absolute value — see `applyDelta`.
 */
export function precision(factor = 0.1, key: keyof ModifierContext['keys'] = 'alt'): Modifier {
  return (delta, c) => (c.keys[key] ? delta * factor : delta)
}

/** Coarse mode — the inverse gesture, conventionally Shift. */
export function coarse(factor = 10, key: keyof ModifierContext['keys'] = 'shift'): Modifier {
  return (delta, c) => (c.keys[key] ? delta * factor : delta)
}

/** Ignores sub-threshold movement so a click does not become a 1px drag. */
export function deadZone(threshold: number): Modifier {
  return (delta) => (Math.abs(delta) < threshold ? 0 : delta)
}

/** Faster pointer travel covers more range — a scrub, not a slider. */
export function velocitySensitive(gain = 1): Modifier {
  return (delta, c) => delta * (1 + Math.min(Math.abs(c.velocity) * gain, 4))
}

export function accelerate(gain = 1): Modifier {
  return (delta, context) => delta * (1 + Math.max(0, context.elapsed ?? 0) * gain)
}

export function decelerate(gain = 1): Modifier {
  return (delta, context) => delta / (1 + Math.max(0, context.elapsed ?? 0) * gain)
}

export function resistance(amount = 0.2): Modifier {
  return (value, context) => {
    if (value >= context.min && value <= context.max) return value
    const edge = value < context.min ? context.min : context.max
    return edge + (value - edge) * Math.max(0, Math.min(1, amount))
  }
}

export function friction(amount = 0.12): Modifier {
  return (delta) => delta * Math.max(0, 1 - amount)
}

export function inertiaRequest(minVelocity = 0.02): Modifier {
  return (value, context) => {
    if (Math.abs(context.velocity) >= minVelocity) context.requests?.add('inertia')
    return value
  }
}

export function springRequest(): Modifier {
  return (value, context) => {
    if (value < context.min || value > context.max) context.requests?.add('spring')
    return value
  }
}

export function overshoot(amount = 0.08): Modifier {
  return resistance(amount)
}

export function recoil(amount = 0.12): Modifier {
  return (value, context) => value - context.velocity * amount
}

export function axisLock(axis: 'x' | 'y' | 'z'): Modifier {
  return (value, context) => context.axis && context.axis !== axis ? 0 : value
}

export function elasticity(amount = 0.15): Modifier {
  return resistance(amount)
}

export function compose(...modifiers: Modifier[]): Modifier {
  return (value, context) => modifiers.reduce((acc, m) => m(acc, context), value)
}

export function defineModifier(id: string, apply: Modifier, metadata?: Record<string, unknown>): ModifierDefinition {
  return Object.freeze({ id, apply, metadata: metadata ? Object.freeze({ ...metadata }) : undefined })
}

export function composeModifiers(...definitions: ModifierDefinition[]): ModifierPipeline {
  const modifiers = [...definitions]
  return Object.freeze({
    id: modifiers.map(modifier => modifier.id).join('+') || 'identity',
    modifiers,
    metadata: { modifiers: modifiers.map(modifier => ({ id: modifier.id, metadata: modifier.metadata })) },
    apply: (value: number, context: ModifierContext) => modifiers.reduce((next, modifier) => modifier.apply(next, context), value),
  })
}

/** The standard absolute pipeline: constrain, then land on a legal value. */
export const standard = compose(clamp, quantize)
