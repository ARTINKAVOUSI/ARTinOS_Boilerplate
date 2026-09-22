import { useCallback, useSyncExternalStore } from 'react'

export interface RevealTarget {
  /** What kind of thing to reveal. Panels opt in to the kinds they can show. */
  kind: 'parameter' | 'signal' | 'module' | 'resource'
  id: string
  /** Bumped on every request, so re-revealing the same id still re-triggers a listener. */
  nonce: number
}

let current: RevealTarget | null = null
const listeners = new Set<() => void>()
let nonce = 0

/**
 * A one-slot bus for "show me this thing".
 *
 * The palette can act on a parameter it did not render and does not own: it publishes a
 * target, and whichever panel understands that kind picks it up. No panel needs to know
 * the palette exists, and the palette needs no registry of panel internals.
 */
export function reveal(kind: RevealTarget['kind'], id: string): void {
  current = { kind, id, nonce: ++nonce }
  for (const listener of listeners) listener()
}

export function clearReveal(): void {
  if (!current) return
  current = null
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot() {
  return current
}

/** Returns the pending reveal target, or `null`. Filter by `kind` in the consuming panel. */
export function useReveal(kind?: RevealTarget['kind']): RevealTarget | null {
  const target = useSyncExternalStore(subscribe, snapshot, snapshot)
  const matches = !kind || target?.kind === kind
  return useCallback(() => (matches ? target : null), [matches, target])()
}
