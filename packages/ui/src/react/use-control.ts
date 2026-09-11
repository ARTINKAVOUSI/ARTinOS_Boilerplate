/**
 * React renderer bindings for the kernel.
 *
 * This is the only place React meets `ControlBehavior`. The component below it
 * renders anatomy and applies tokens; it does not implement drag, precision,
 * detents or keyboard mechanics — those live in the kernel and are shared.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ControlBehavior,
  InteractionTracker,
  intentFromKey,
  intentFromWheel,
  valueAtOffset,
  stepPhysicalState,
  type ControlSnapshot,
  type ControlSpec,
} from '../kernel'

export interface ControlScheduler {
  schedule<T>(
    key: string,
    mode: 'animation-frame',
    apply: (value: T) => void,
    options: { value: T },
  ): { cancel(): void }
}

export interface UseControlOptions extends ControlSpec {
  value: number
  onChange(value: number): void
  /** Called once when a gesture opens — open a history transaction here. */
  onGestureStart?(): void
  /** Called once when a gesture closes — commit the transaction here. */
  onGestureEnd?(): void
  /** Pointer axis. Vertical rails and dials track Y. */
  axis?: 'x' | 'y'
  /** Click positions the value absolutely along the element (rail behaviour). */
  seekOnPress?: boolean
  scheduler?: ControlScheduler
}

export interface ControlBinding {
  snapshot: ControlSnapshot
  /** Spread onto the interactive element. */
  handlers: {
    onPointerDown(e: React.PointerEvent): void
    onPointerMove(e: React.PointerEvent): void
    onPointerUp(e: React.PointerEvent): void
    onPointerCancel(e: React.PointerEvent): void
    onPointerEnter(): void
    onPointerLeave(): void
    onFocus(): void
    onBlur(): void
    onKeyDown(e: React.KeyboardEvent): void
    onWheel(e: React.WheelEvent): void
    onDoubleClick(): void
  }
  /** Semantic state attributes (PRD §16). */
  attributes: Record<string, string | undefined>
  ref: React.RefObject<HTMLDivElement | null>
  /** Attach to the element that shows the live number. */
  liveRef: React.RefObject<HTMLElement | null>
  /** Formats the live readout during a drag; must match the rendered format. */
  setFormatter(fn: (v: number) => string): void
  /** True while a pointer gesture owns the value. */
  isDragging: boolean
  cancelGesture(): void
}

export function useControl(options: UseControlOptions): ControlBinding {
  const {
    value,
    onChange,
    onGestureStart,
    onGestureEnd,
    axis = 'x',
    seekOnPress = false,
    scheduler,
    ...spec
  } = options

  const ref = useRef<HTMLDivElement | null>(null)
  const schedulerKey = useId()
  const behavior = useMemo(() => new ControlBehavior(spec, value), [])
  const tracker = useMemo(() => new InteractionTracker(axis), [axis])
  const [snapshot, setSnapshot] = useState<ControlSnapshot>(() => ({
    state: 'idle',
    flags: { precision: false, snapping: false, constrained: false },
    value,
    origin: value,
    gestureStarted: false,
    gestureEnded: false,
  }))

  // Latest callbacks without re-binding window listeners mid-gesture.
  const latest = useRef({ onChange, onGestureStart, onGestureEnd })
  latest.current = { onChange, onGestureStart, onGestureEnd }

  /** Element whose text is the live readout, written directly during a drag. */
  const live = useRef<HTMLElement | null>(null)
  const formatRef = useRef<(v: number) => string>(v => String(v))
  const stateRef = useRef(snapshot.state)
  const valueRef = useRef(value)
  const settleHandle = useRef<{ cancel(): void } | null>(null)
  const applyRef = useRef<(next: ControlSnapshot) => void>(() => {})
  const startSettleRef = useRef<(request: NonNullable<ControlSnapshot['settleRequest']>) => void>(() => {})

  useEffect(() => {
    behavior.update(spec)
  }, [spec.min, spec.max, spec.step, spec.disabled, spec.readOnly, spec.travel, spec.physicsProfile, behavior])

  useEffect(() => {
    behavior.sync(value)
    setSnapshot(s => (s.state === 'dragging' ? s : { ...s, value }))
  }, [value, behavior])

  /** Mirrors the live value onto the element so a drag needs no React render. */
  const paint = useCallback((next: ControlSnapshot) => {
    const el = ref.current
    if (!el) return
    const t = (next.value - spec.min) / (spec.max - spec.min || 1)
    el.style.setProperty('--control-t', String(Math.max(0, Math.min(1, t))))
    if (live.current) live.current.textContent = formatRef.current(next.value)
  }, [spec.min, spec.max])

  const apply = useCallback(
    (next: ControlSnapshot) => {
      // Locked decision 4: realtime updates bypass React rendering. During a drag
      // only the DOM and the runtime are touched; React state changes on the
      // gesture boundaries, where the *state* actually changed.
      const boundary = next.gestureStarted || next.gestureEnded || next.state !== stateRef.current
      stateRef.current = next.state
      if (boundary) setSnapshot(next)
      else paint(next)

      // Pin surface contrast for the life of the gesture, so a dragged value never
      // loses legibility against a moving canvas (design system, [data-interacting]).
      if (next.gestureStarted || next.gestureEnded) {
        const surface = ref.current?.closest('.plate-workspace') as HTMLElement | null
        if (surface) {
          if (next.gestureStarted) surface.setAttribute('data-interacting', 'true')
          else surface.removeAttribute('data-interacting')
        }
      }

      if (next.gestureStarted) latest.current.onGestureStart?.()
      if (next.value !== valueRef.current) {
        valueRef.current = next.value
        latest.current.onChange(next.value)
      }
      if (next.gestureEnded) latest.current.onGestureEnd?.()
      if (next.settleRequest) startSettleRef.current(next.settleRequest)
    },
    [paint],
  )
  applyRef.current = apply

  startSettleRef.current = request => {
    settleHandle.current?.cancel()
    if (!scheduler) {
      applyRef.current(behavior.applyPhysical({ ...request.state, velocity: 0, phase: 'idle' }))
      return
    }
    let state = request.state
    let previous = globalThis.performance?.now() ?? Date.now()
    const tick = () => {
      const current = globalThis.performance?.now() ?? Date.now()
      state = stepPhysicalState(state, request.profile, Math.max(0, (current - previous) / 1_000))
      previous = current
      applyRef.current(behavior.applyPhysical(state))
      if (state.phase !== 'idle') {
        settleHandle.current = scheduler.schedule(`control-settle:${schedulerKey}`, 'animation-frame', tick, { value: undefined })
      } else settleHandle.current = null
    }
    settleHandle.current = scheduler.schedule(`control-settle:${schedulerKey}`, 'animation-frame', tick, { value: undefined })
  }

  useEffect(() => () => settleHandle.current?.cancel(), [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || spec.disabled || spec.readOnly) return
      e.preventDefault()

      const element = ref.current
      const length = element ? (axis === 'x' ? element.clientWidth : element.clientHeight) : 200
      behavior.update({ travel: length })

      if (seekOnPress && element) {
        const rect = element.getBoundingClientRect()
        const offset = axis === 'x' ? e.clientX - rect.left : rect.bottom - e.clientY
        apply(behavior.seek(valueAtOffset(offset, { length, value, min: spec.min, max: spec.max })))
      }

      e.currentTarget.setPointerCapture?.(e.pointerId)
      apply(behavior.send(tracker.begin(e, e.timeStamp)))
    },
    [apply, axis, behavior, seekOnPress, spec.disabled, spec.readOnly, spec.min, spec.max, tracker, value],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (tracker.isActive) apply(behavior.send(tracker.move(e, e.timeStamp)))
  }, [apply, behavior, tracker])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!tracker.isActive) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    apply(behavior.send(tracker.end(e, e.timeStamp)))
  }, [apply, behavior, tracker])

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    if (!tracker.isActive) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    apply(behavior.send(tracker.end(e, e.timeStamp, true)))
  }, [apply, behavior, tracker])

  const cancelGesture = useCallback(() => {
    settleHandle.current?.cancel()
    settleHandle.current = null
    if (tracker.isActive || stateRef.current === 'settling') apply(behavior.send(tracker.cancel(performance.now())))
  }, [apply, behavior, tracker])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const intent = intentFromKey(e, e.timeStamp)
      if (!intent) return
      e.preventDefault()
      apply(behavior.send(intent))
    },
    [apply, behavior],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (snapshot.state !== 'hover' && snapshot.state !== 'dragging') return
      apply(behavior.send(intentFromWheel(e, e.timeStamp)))
    },
    [apply, behavior, snapshot.state],
  )

  useEffect(() => {
    valueRef.current = value
  }, [value])

  return {
    snapshot,
    isDragging: snapshot.state === 'dragging',
    ref,
    /** Attach to the element that shows the live number. */
    liveRef: live,
    /** Formats the live readout during a drag; must match the rendered format. */
    setFormatter: (fn: (v: number) => string) => {
      formatRef.current = fn
    },
    cancelGesture,
    attributes: behavior.dataAttributes(),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onWheel,
      onPointerEnter: () => apply(behavior.send({ kind: 'hover', offset: 0, delta: 0, velocity: 0, keys: { alt: false, shift: false, meta: false, ctrl: false }, steps: 0, timestamp: 0, pointerType: 'mouse' })),
      onPointerLeave: () => apply(behavior.send({ kind: 'unhover', offset: 0, delta: 0, velocity: 0, keys: { alt: false, shift: false, meta: false, ctrl: false }, steps: 0, timestamp: 0, pointerType: 'mouse' })),
      onFocus: () => apply(behavior.send({ kind: 'focus', offset: 0, delta: 0, velocity: 0, keys: { alt: false, shift: false, meta: false, ctrl: false }, steps: 0, timestamp: 0, pointerType: 'key' })),
      onBlur: () => apply(behavior.send({ kind: 'blur', offset: 0, delta: 0, velocity: 0, keys: { alt: false, shift: false, meta: false, ctrl: false }, steps: 0, timestamp: 0, pointerType: 'key' })),
      onDoubleClick: () => apply(behavior.send({ kind: 'reset', offset: 0, delta: 0, velocity: 0, keys: { alt: false, shift: false, meta: false, ctrl: false }, steps: 0, timestamp: 0, pointerType: 'mouse' })),
    },
  }
}
