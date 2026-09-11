import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * `useState` that survives reloads via `localStorage`, merged over `initial` so a shape
 * change in a new version cannot strand a user on a stale saved layout.
 */
export function usePersistentState<T extends object>(
  key: string,
  initial: T,
): [T, (patch: Partial<T>) => void, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      return { ...initial, ...(JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<T>) }
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* private mode or quota — persistence is a convenience, never a requirement */
    }
  }, [key, value])

  return [value, patch => setValue(current => ({ ...current, ...patch })), setValue]
}

/** Single-value variant, for scalars like a theme name. */
export function usePersistentValue<T>(key: string, initial: T, parse: (raw: string) => T | null): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : parse(raw) ?? initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      /* see above */
    }
  }, [key, value])

  return [value, setValue]
}
