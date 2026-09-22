import { useCallback, useRef, useSyncExternalStore } from 'react'

/** Any runtime store that bumps a revision counter and notifies subscribers. */
export interface RevisionStore {
  subscribe(listener: () => void): () => void
  readonly revision: number
}

/**
 * Subscribes to a revision store at a bounded rate.
 *
 * Runtime stores publish on every sample — telemetry does so at frame rate. Re-rendering
 * a panel 60 times a second to redraw numbers nobody can read that fast is the single
 * biggest source of dock stutter, so reads are coalesced to `intervalMs`.
 */
export function useThrottledRevision(store: RevisionStore, intervalMs = 100): number {
  const published = useRef(store.revision)

  const subscribe = useCallback(
    (listener: () => void) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      let last = 0
      const flush = () => {
        timer = null
        last = performance.now()
        published.current = store.revision
        listener()
      }
      const unsubscribe = store.subscribe(() => {
        if (timer) return
        timer = setTimeout(flush, Math.max(0, intervalMs - (performance.now() - last)))
      })
      return () => {
        if (timer) clearTimeout(timer)
        unsubscribe()
      }
    },
    [store, intervalMs],
  )

  const snapshot = useCallback(() => published.current, [])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** Re-renders on a fixed interval. For runtime stores that expose no subscription. */
export function usePoll(intervalMs: number): void {
  const counter = useRef(0)
  const subscribe = useCallback(
    (listener: () => void) => {
      const id = setInterval(() => {
        counter.current++
        listener()
      }, intervalMs)
      return () => clearInterval(id)
    },
    [intervalMs],
  )
  const snapshot = useCallback(() => counter.current, [])
  useSyncExternalStore(subscribe, snapshot, snapshot)
}
