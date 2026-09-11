/**
 * Behavior engine — the control state machine (PRD §17).
 *
 *   idle → hover → press → drag(normal|precision|constrained|snap)
 *        → release(inertia|spring|magnetic) → idle
 *
 * Renderer-independent: it consumes `Intent`s and emits a state plus the value
 * the control should now hold. No React, no DOM, no runtime — which is what lets
 * Slider, Scrubber, Knob, Dial and XY Pad share one set of mechanics instead of
 * carrying five separate implementations of the same drag.
 */

import type { Intent, ModifierKeys } from './interaction'
import { NO_KEYS } from './interaction'
import { clamp, quantize, magnet, type ModifierContext } from './modifiers'
import type { PhysicalState, PhysicsProfile } from './physics'
import { PHYSICS_PROFILES } from './physics'

export type ControlState =
  | 'idle'
  | 'hover'
  | 'focused'
  | 'pressed'
  | 'dragging'
  | 'settling'
  | 'editing'
  | 'disabled'

/** Refinements that describe *how* a drag is behaving right now. */
export interface ControlFlags {
  precision: boolean
  snapping: boolean
  constrained: boolean
}

export interface ControlSpec {
  min: number
  max: number
  step: number
  /** Value the control returns to on reset (double-click, Home). */
  defaultValue?: number
  detents?: readonly number[]
  /** Magnet radius as a fraction of the range. */
  detentRadius?: number
  /** Multiplier applied to a precision-modified drag. */
  precisionFactor?: number
  /** Multiplier applied to a coarse-modified drag. */
  coarseFactor?: number
  disabled?: boolean
  readOnly?: boolean
  /** Range covered by one full sweep of the drag axis, in px. */
  travel?: number
  physicsProfile?: PhysicsProfile['id']
}

export interface ControlSnapshot {
  state: ControlState
  flags: ControlFlags
  value: number
  /** Value when the current gesture began — the transaction's `before`. */
  origin: number
  /** True on the intent that opens a gesture, false otherwise. */
  gestureStarted: boolean
  /** True on the intent that closes a gesture. */
  gestureEnded: boolean
  settleRequest?: { profile: PhysicsProfile; state: PhysicalState }
}

const NO_FLAGS: ControlFlags = { precision: false, snapping: false, constrained: false }

/**
 * A control's mechanics. Construct once per control instance; feed it intents.
 *
 * The machine owns the value during a gesture so that a drag reads from its own
 * accumulated position rather than from React state, which would quantize the
 * gesture to the render rate.
 */
export class ControlBehavior {
  private _state: ControlState = 'idle'
  private _flags: ControlFlags = NO_FLAGS
  private _value: number
  private _origin: number
  private _accumulated = 0

  constructor(private spec: ControlSpec, initial: number) {
    this._value = initial
    this._origin = initial
  }

  get state(): ControlState {
    return this.spec.disabled ? 'disabled' : this._state
  }
  get flags(): ControlFlags {
    return this._flags
  }
  get value(): number {
    return this._value
  }

  /** Keeps the machine in sync when the value changes from outside the gesture. */
  sync(value: number): void {
    if (this._state !== 'dragging') this._value = value
  }

  update(spec: Partial<ControlSpec>): void {
    this.spec = { ...this.spec, ...spec }
  }

  private context(keys: ModifierKeys, velocity: number): ModifierContext {
    return { min: this.spec.min, max: this.spec.max, step: this.spec.step, keys, velocity }
  }

  /** Constrain → quantize → magnet. Order matters: detents win over the step grid. */
  private settle(value: number, keys: ModifierKeys, velocity: number): { value: number; snapped: boolean } {
    const ctx = this.context(keys, velocity)
    let next = clamp(value, ctx)
    next = quantize(next, ctx)
    const detents = this.spec.detents ?? []
    if (detents.length) {
      const pulled = magnet(detents, this.spec.detentRadius ?? 0.02)(next, ctx)
      if (pulled !== next) return { value: clamp(pulled, ctx), snapped: true }
    }
    return { value: next, snapped: false }
  }

  private snapshot(started = false, ended = false): ControlSnapshot {
    return {
      state: this.state,
      flags: this._flags,
      value: this._value,
      origin: this._origin,
      gestureStarted: started,
      gestureEnded: ended,
    }
  }

  send(intent: Intent): ControlSnapshot {
    if (this.spec.disabled) return this.snapshot()
    const readOnly = this.spec.readOnly === true

    switch (intent.kind) {
      case 'hover':
        if (this._state === 'idle') this._state = 'hover'
        return this.snapshot()

      case 'unhover':
        if (this._state === 'hover') this._state = 'idle'
        return this.snapshot()

      case 'focus':
        if (this._state === 'idle' || this._state === 'hover') this._state = 'focused'
        return this.snapshot()

      case 'blur':
        if (this._state === 'focused' || this._state === 'editing') this._state = 'idle'
        return this.snapshot()

      case 'begin': {
        if (readOnly) return this.snapshot()
        this._state = 'dragging'
        this._origin = this._value
        this._accumulated = 0
        this._flags = { ...NO_FLAGS, precision: intent.keys.alt, constrained: intent.keys.shift }
        return this.snapshot(true)
      }

      case 'move': {
        if (this._state !== 'dragging' || readOnly) return this.snapshot()
        const factor = intent.keys.alt
          ? (this.spec.precisionFactor ?? 0.15)
          : intent.keys.shift
            ? (this.spec.coarseFactor ?? 1)
            : 1
        const travel = this.spec.travel && this.spec.travel > 0 ? this.spec.travel : 200
        this._accumulated += (intent.delta / travel) * (this.spec.max - this.spec.min) * factor
        const { value, snapped } = this.settle(this._origin + this._accumulated, intent.keys, intent.velocity)
        this._value = value
        this._flags = { precision: intent.keys.alt, snapping: snapped, constrained: intent.keys.shift }
        return this.snapshot()
      }

      case 'commit': {
        if (this._state !== 'dragging') return this.snapshot()
        if (this.spec.physicsProfile && Math.abs(intent.velocity) > 0.01) {
          this._state = 'settling'
          const profile = PHYSICS_PROFILES[this.spec.physicsProfile]
          return {
            ...this.snapshot(),
            settleRequest: {
              profile,
              state: {
                value: this._value,
                target: this._value,
                velocity: intent.velocity * ((this.spec.max - this.spec.min) / (this.spec.travel ?? 200)) * 1_000,
                phase: profile.inertia ? 'inertia' : 'spring',
              },
            },
          }
        }
        this._state = 'idle'
        this._flags = NO_FLAGS
        return this.snapshot(false, true)
      }

      case 'cancel': {
        if (this._state === 'dragging' || this._state === 'settling') {
          this._value = this._origin // a cancelled gesture leaves no trace
          this._state = 'idle'
          this._flags = NO_FLAGS
          return this.snapshot(false, true)
        }
        if (this._state === 'editing') this._state = 'idle'
        return this.snapshot()
      }

      case 'nudge': {
        if (readOnly) return this.snapshot()
        const magnitude = this.spec.step * (intent.keys.shift ? 10 : intent.keys.alt ? 0.1 : 1)
        this._origin = this._value
        const { value } = this.settle(this._value + intent.steps * magnitude, intent.keys, 0)
        this._value = value
        // A nudge is a complete gesture: it opens and closes in one intent.
        return this.snapshot(true, true)
      }

      case 'reset': {
        if (readOnly) return this.snapshot()
        this._origin = this._value
        const target =
          intent.steps === -Infinity
            ? this.spec.min
            : intent.steps === Infinity
              ? this.spec.max
              : (this.spec.defaultValue ?? this.spec.min)
        const { value } = this.settle(target, intent.keys, 0)
        this._value = value
        return this.snapshot(true, true)
      }

      case 'edit':
        if (!readOnly) this._state = 'editing'
        return this.snapshot()

      default:
        return this.snapshot()
    }
  }

  applyPhysical(state: PhysicalState): ControlSnapshot {
    this._value = Math.max(this.spec.min, Math.min(this.spec.max, state.value))
    if (state.phase === 'idle') {
      this._state = 'idle'
      this._flags = NO_FLAGS
      return this.snapshot(false, true)
    }
    this._state = 'settling'
    return this.snapshot()
  }

  /** Absolute positioning — click on a rail jumps the value to the pointer. */
  seek(value: number, keys: ModifierKeys = NO_KEYS): ControlSnapshot {
    if (this.spec.disabled || this.spec.readOnly) return this.snapshot()
    this._origin = this._value
    const { value: next, snapped } = this.settle(value, keys, 0)
    this._value = next
    this._flags = { ...this._flags, snapping: snapped }
    return this.snapshot(true, true)
  }

  /** Semantic attributes for the renderer (PRD §16). */
  dataAttributes(): Record<string, string | undefined> {
    return {
      'data-state': this.state,
      'data-precision': this._flags.precision ? '' : undefined,
      'data-snapping': this._flags.snapping ? '' : undefined,
      'data-constrained': this._flags.constrained ? '' : undefined,
    }
  }
}
