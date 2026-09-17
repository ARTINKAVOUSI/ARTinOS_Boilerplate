import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'

/**
 * Signals — a tiny bus for high-frequency live values (audio bands, pointer,
 * hand position). Writers `set` values every frame; readers pull them inside
 * `useFrame` with `get`, so nothing here causes React renders on the hot path.
 * UI that wants to display values polls with `useSignalSnapshot`.
 *
 * Input features write to it and reactive objects read from it. Both work
 * without a <SignalsProvider>: they share one default bus. Wrap a subtree in
 * its own provider only to isolate it (e.g. two independent canvases).
 */

export type SignalValue = number

export class SignalBus {
  private values = new Map<string, SignalValue>()
  private stamps = new Map<string, number>()

  set(name: string, value: SignalValue) {
    this.values.set(name, value)
    this.stamps.set(name, performance.now())
  }

  get(name: string, fallback = 0): SignalValue {
    return this.values.get(name) ?? fallback
  }

  delete(prefix: string) {
    for (const key of [...this.values.keys()]) {
      if (key === prefix || key.startsWith(`${prefix}.`)) {
        this.values.delete(key)
        this.stamps.delete(key)
      }
    }
  }

  /** Milliseconds since the signal was last written, or Infinity. */
  age(name: string) {
    const stamp = this.stamps.get(name)
    return stamp === undefined ? Infinity : performance.now() - stamp
  }

  entries() {
    return [...this.values.entries()].sort(([a], [b]) => a.localeCompare(b))
  }
}

const defaultBus = new SignalBus()
const SignalsContext = createContext<SignalBus>(defaultBus)

export function SignalsProvider({ bus, children }: { bus?: SignalBus; children?: ReactNode }) {
  const value = useMemo(() => bus ?? new SignalBus(), [bus])
  return <SignalsContext.Provider value={value}>{children}</SignalsContext.Provider>
}

export function useSignals(): SignalBus {
  return useContext(SignalsContext)
}

/** Re-renders at `hz` with a snapshot of every signal — for monitors and HUDs, not for animation. */
export function useSignalSnapshot(hz = 15): [string, SignalValue][] {
  const bus = useSignals()
  const cache = useRef<{ time: number; value: [string, SignalValue][] }>({ time: 0, value: [] })
  const subscribe = useMemo(
    () => (notify: () => void) => {
      const timer = setInterval(notify, 1000 / hz)
      return () => clearInterval(timer)
    },
    [hz],
  )
  return useSyncExternalStore(subscribe, () => {
    const now = performance.now()
    if (now - cache.current.time > 1000 / hz / 2) cache.current = { time: now, value: bus.entries() }
    return cache.current.value
  })
}

/** Removes every signal under `prefix` when the writer unmounts. */
export function useSignalCleanup(prefix: string) {
  const bus = useSignals()
  useEffect(() => () => bus.delete(prefix), [bus, prefix])
}
