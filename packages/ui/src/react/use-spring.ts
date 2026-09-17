/**
 * Material springs.
 *
 * Motion is material behaviour, and it changes per world: Clear is light and
 * quick, Monolith heavy and slow. The spring reads `--ui-mass`, `--ui-spring`
 * and `--ui-damp` off the element it moves, so a control inherits the feel of
 * whatever world it sits in without being told which one that is.
 *
 * Integration matches the reference exactly: a damped harmonic step with the
 * frame clamped to 32ms, settling once both position and velocity are within
 * a hair of rest.
 */

import { useCallback, useEffect, useRef } from 'react'

export interface MotionConstants {
  mass: number
  spring: number
  damp: number
}

const REST_POSITION = 0.0008
const REST_VELOCITY = 0.0015
const MAX_STEP = 0.032

function numberVar(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const value = parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** The world's motion constants, read from the element that will move. */
export function readMotion(element: Element | null): MotionConstants {
  if (!element || typeof getComputedStyle === 'undefined') return { mass: 1, spring: 210, damp: 22 }
  const style = getComputedStyle(element)
  return {
    mass: numberVar(style, '--ui-mass', 1),
    spring: numberVar(style, '--ui-spring', 210),
    damp: numberVar(style, '--ui-damp', 22),
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Runs one spring from `from` to `to`, calling `apply` every frame. Returns a
 * cancel function. With reduced motion it lands on `to` immediately.
 */
export function runSpring(
  element: Element | null,
  from: number,
  to: number,
  apply: (value: number) => void,
): () => void {
  if (typeof requestAnimationFrame === 'undefined' || prefersReducedMotion()) {
    apply(to)
    return () => {}
  }
  const { mass, spring, damp } = readMotion(element)
  let position = from
  let velocity = 0
  let last = performance.now()
  let handle = 0

  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, MAX_STEP)
    last = now
    const acceleration = (-spring * (position - to) - damp * velocity) / mass
    velocity += acceleration * dt
    position += velocity * dt
    if (Math.abs(position - to) > REST_POSITION || Math.abs(velocity) > REST_VELOCITY) {
      apply(position)
      handle = requestAnimationFrame(step)
    } else {
      apply(to)
      handle = 0
    }
  }
  handle = requestAnimationFrame(step)
  return () => {
    if (handle) cancelAnimationFrame(handle)
    handle = 0
  }
}

/**
 * A spring bound to one element. Starting a new motion cancels the one in
 * flight, so a value can be re-targeted mid-travel, and unmounting stops it.
 */
export function useSpring<T extends Element>() {
  const ref = useRef<T | null>(null)
  const cancel = useRef<() => void>(() => {})

  useEffect(() => () => cancel.current(), [])

  const animate = useCallback((from: number, to: number, apply: (value: number) => void) => {
    cancel.current()
    cancel.current = runSpring(ref.current, from, to, apply)
  }, [])

  return { ref, animate }
}
