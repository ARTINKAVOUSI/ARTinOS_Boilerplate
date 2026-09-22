/**
 * Universal interaction engine — one input vocabulary (PRD §18).
 *
 * Normalizes mouse, touch, pen, wheel and keyboard into a small set of intents.
 * Components consume intents; they never implement browser events themselves.
 *
 * The DOM types here are structural, so the kernel stays renderer-independent:
 * anything that can produce a point, a set of modifier keys and a timestamp can
 * drive this — including a test, a MIDI surface or a gesture recognizer.
 */

export type IntentKind =
  | 'hover'
  | 'unhover'
  | 'focus'
  | 'blur'
  | 'begin'
  | 'move'
  | 'commit'
  | 'cancel'
  | 'nudge'
  | 'reset'
  | 'edit'
  | 'long-press'
  | 'double-click'
  | 'gesture'

export type SemanticAction =
  | 'hover' | 'focus' | 'press' | 'drag' | 'scrub' | 'nudge' | 'edit'
  | 'reset' | 'commit' | 'cancel' | 'long-press' | 'double-click'
  | 'pinch' | 'rotate'

export interface ModifierKeys {
  alt: boolean
  shift: boolean
  meta: boolean
  ctrl: boolean
}

export const NO_KEYS: ModifierKeys = { alt: false, shift: false, meta: false, ctrl: false }

export interface Intent {
  kind: IntentKind
  /** Position along the primary axis, in element space. */
  offset: number
  /** Change since the previous intent, along the primary axis. */
  delta: number
  /** px/ms, signed. Smoothed, so a single jittery sample cannot spike it. */
  velocity: number
  keys: ModifierKeys
  /** Discrete steps for `nudge`: -1 or +1, scaled by the caller. */
  steps: number
  timestamp: number
  pointerType: 'mouse' | 'touch' | 'pen' | 'key' | 'wheel'
  pointerId?: number
  pressure?: number
  tilt?: { x: number; y: number }
  contactCount?: number
  scale?: number
  rotation?: number
  position?: { x: number; y: number }
  semanticAction?: SemanticAction
}

export interface PointerLike {
  clientX: number
  clientY: number
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  pointerType?: string
  pointerId?: number
  pressure?: number
  tiltX?: number
  tiltY?: number
  width?: number
  height?: number
}

export interface KeyLike {
  key: string
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

export const keysOf = (e: {
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}): ModifierKeys => ({ alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey })

const pointerTypeOf = (t?: string): Intent['pointerType'] =>
  t === 'touch' || t === 'pen' ? t : 'mouse'

/**
 * Tracks one gesture and emits intents. Owns velocity smoothing so every control
 * gets the same feel, and so a control never sees raw per-event jitter.
 */
export class GestureTracker {
  private origin = 0
  private last = 0
  private lastTime = 0
  private smoothed = 0
  private active = false

  /** Exponential smoothing factor; 1 would be raw, 0 would never move. */
  constructor(private readonly axis: 'x' | 'y' = 'x', private readonly smoothing = 0.35) {}

  get isActive(): boolean {
    return this.active
  }

  private coord(e: PointerLike): number {
    return this.axis === 'x' ? e.clientX : e.clientY
  }

  begin(e: PointerLike, now: number): Intent {
    const at = this.coord(e)
    this.origin = at
    this.last = at
    this.lastTime = now
    this.smoothed = 0
    this.active = true
    return {
      kind: 'begin',
      offset: 0,
      delta: 0,
      velocity: 0,
      keys: keysOf(e),
      steps: 0,
      timestamp: now,
      pointerType: pointerTypeOf(e.pointerType),
    }
  }

  move(e: PointerLike, now: number): Intent {
    const at = this.coord(e)
    const delta = at - this.last
    const dt = Math.max(now - this.lastTime, 1)
    const instant = delta / dt
    this.smoothed = this.smoothed + (instant - this.smoothed) * this.smoothing
    this.last = at
    this.lastTime = now
    return {
      kind: 'move',
      offset: at - this.origin,
      delta,
      velocity: this.smoothed,
      keys: keysOf(e),
      steps: 0,
      timestamp: now,
      pointerType: pointerTypeOf(e.pointerType),
    }
  }

  end(e: PointerLike | null, now: number, cancelled = false): Intent {
    this.active = false
    return {
      kind: cancelled ? 'cancel' : 'commit',
      offset: this.last - this.origin,
      delta: 0,
      velocity: this.smoothed,
      keys: e ? keysOf(e) : NO_KEYS,
      steps: 0,
      timestamp: now,
      pointerType: e ? pointerTypeOf(e.pointerType) : 'mouse',
    }
  }
}

/**
 * Capture-agnostic multi-input tracker. A renderer owns pointer capture and
 * listeners; this class owns only deterministic gesture interpretation.
 */
export class InteractionTracker {
  private gesture: GestureTracker
  private pointers = new Map<number, { x: number; y: number }>()
  private beganAt = 0
  private lastTapAt = -Infinity
  private initialDistance = 0
  private initialAngle = 0
  private longPressSent = false

  constructor(
    axis: 'x' | 'y' = 'x',
    private options: { longPressMs?: number; doubleClickMs?: number; smoothing?: number } = {},
  ) {
    this.gesture = new GestureTracker(axis, options.smoothing)
  }

  get activePointers(): number { return this.pointers.size }
  get isActive(): boolean { return this.gesture.isActive }

  begin(event: PointerLike, timestamp: number): Intent {
    const id = event.pointerId ?? 0
    this.pointers.set(id, { x: event.clientX, y: event.clientY })
    this.beganAt = timestamp
    this.longPressSent = false
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.initialDistance = Math.hypot(b.x - a.x, b.y - a.y) || 1
      this.initialAngle = Math.atan2(b.y - a.y, b.x - a.x)
    }
    return this.enrich(this.gesture.begin(event, timestamp), event, 'press')
  }

  move(event: PointerLike, timestamp: number): Intent {
    const id = event.pointerId ?? 0
    this.pointers.set(id, { x: event.clientX, y: event.clientY })
    const intent = this.enrich(this.gesture.move(event, timestamp), event, this.pointers.size > 1 ? 'pinch' : 'drag')
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()]
      const distance = Math.hypot(b.x - a.x, b.y - a.y)
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      intent.kind = 'gesture'
      intent.scale = distance / this.initialDistance
      intent.rotation = angle - this.initialAngle
      intent.position = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
    return intent
  }

  end(event: PointerLike | null, timestamp: number, cancelled = false): Intent {
    const id = event?.pointerId ?? 0
    const duration = timestamp - this.beganAt
    if (!cancelled && this.pointers.size > 1) {
      this.pointers.delete(id)
      return {
        kind: 'gesture', semanticAction: 'commit',
        offset: 0, delta: 0, velocity: 0, keys: event ? keysOf(event) : NO_KEYS,
        steps: 0, timestamp, pointerType: event ? pointerTypeOf(event.pointerType) : 'touch',
        pointerId: id, contactCount: this.pointers.size, scale: 1, rotation: 0,
      }
    }
    const intent = this.enrich(this.gesture.end(event, timestamp, cancelled), event, cancelled ? 'cancel' : 'commit')
    this.pointers.delete(id)
    intent.contactCount = this.pointers.size
    if (!cancelled && duration < (this.options.longPressMs ?? 500) && timestamp - this.lastTapAt <= (this.options.doubleClickMs ?? 300)) {
      intent.kind = 'double-click'
      intent.semanticAction = 'double-click'
      this.lastTapAt = -Infinity
    } else if (!cancelled) {
      this.lastTapAt = timestamp
    }
    return intent
  }

  hold(timestamp: number): Intent | null {
    if (!this.isActive || this.longPressSent || timestamp - this.beganAt < (this.options.longPressMs ?? 500)) return null
    this.longPressSent = true
    return {
      kind: 'long-press', semanticAction: 'long-press',
      offset: 0, delta: 0, velocity: 0, keys: NO_KEYS, steps: 0,
      timestamp, pointerType: 'touch', contactCount: this.pointers.size,
    }
  }

  hover(active: boolean, timestamp: number, pointerType: Intent['pointerType'] = 'mouse'): Intent {
    return { kind: active ? 'hover' : 'unhover', semanticAction: 'hover', offset: 0, delta: 0, velocity: 0, keys: NO_KEYS, steps: 0, timestamp, pointerType }
  }
  focus(active: boolean, timestamp: number): Intent {
    return { kind: active ? 'focus' : 'blur', semanticAction: 'focus', offset: 0, delta: 0, velocity: 0, keys: NO_KEYS, steps: 0, timestamp, pointerType: 'key' }
  }
  cancel(timestamp: number): Intent { return this.end(null, timestamp, true) }

  private enrich(intent: Intent, event: PointerLike | null, action: SemanticAction): Intent {
    if (!event) return { ...intent, contactCount: this.pointers.size, semanticAction: action }
    return {
      ...intent,
      pointerId: event.pointerId ?? 0,
      pressure: event.pressure ?? (event.pointerType === 'mouse' ? 0.5 : 0),
      tilt: { x: event.tiltX ?? 0, y: event.tiltY ?? 0 },
      contactCount: this.pointers.size,
      position: { x: event.clientX, y: event.clientY },
      semanticAction: action,
    }
  }
}

/** Arrow/Page/Home/End → a nudge intent. Returns null for keys we do not own. */
export function intentFromKey(e: KeyLike, now: number): Intent | null {
  const base: Omit<Intent, 'kind' | 'steps'> = {
    offset: 0,
    delta: 0,
    velocity: 0,
    keys: keysOf(e),
    timestamp: now,
    pointerType: 'key',
  }
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return { ...base, kind: 'nudge', steps: 1 }
    case 'ArrowDown':
    case 'ArrowLeft':
      return { ...base, kind: 'nudge', steps: -1 }
    case 'PageUp':
      return { ...base, kind: 'nudge', steps: 10 }
    case 'PageDown':
      return { ...base, kind: 'nudge', steps: -10 }
    case 'Home':
      return { ...base, kind: 'reset', steps: -Infinity }
    case 'End':
      return { ...base, kind: 'reset', steps: Infinity }
    case 'Enter':
    case 'F2':
      return { ...base, kind: 'edit', steps: 0 }
    case 'Escape':
      return { ...base, kind: 'cancel', steps: 0 }
    default:
      return null
  }
}

export function intentFromWheel(
  e: { deltaY: number; deltaX: number; altKey: boolean; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  now: number,
): Intent {
  const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? -e.deltaY : e.deltaX
  return {
    kind: 'nudge',
    offset: 0,
    delta: raw,
    velocity: 0,
    keys: keysOf(e),
    steps: Math.sign(raw),
    timestamp: now,
    pointerType: 'wheel',
  }
}
