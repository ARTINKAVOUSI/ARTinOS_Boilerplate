import { useSyncExternalStore } from 'react'

/**
 * Console capture for the Console panel and the error toast. Wraps
 * console.log/info/warn/error once, keeps the last entries, and still forwards
 * every call to the real console.
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  level: LogLevel
  time: number
  /** First line, for the collapsed row. */
  message: string
  /** Everything, formatted, for the expanded row. */
  detail: string
  /** `[source]` prefix convention, e.g. `[postfx]`. */
  source: string
}

const LIMIT = 500
/** Readers are told about new entries at most this often, however fast something logs. */
const NOTIFY_MS = 100
let entries: LogEntry[] = []
let pending: LogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined
let serial = 0
let paused = false
const listeners = new Set<() => void>()

function flush() {
  flushTimer = undefined
  entries = [...entries, ...pending].slice(-LIMIT)
  pending = []
  listeners.forEach(listener => listener())
}

const format = (value: unknown): string => {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function push(level: LogLevel, args: unknown[]) {
  if (paused) return
  // Drop %c markers and the CSS strings that go with them.
  const styles = typeof args[0] === 'string' ? (args[0].match(/%c/g)?.length ?? 0) : 0
  const parts = styles ? [String(args[0]).replace(/%c/g, ''), ...args.slice(1 + styles)] : args
  const text = parts.map(format).join(' ')
  const source = /^\[([\w.-]+)\]/.exec(text)?.[1] ?? 'app'
  pending.push({ id: ++serial, level, time: Date.now(), message: text.split('\n')[0].slice(0, 400), detail: text, source })
  // Readers render React: a warning logged every frame must not re-render the Console 60×/s.
  flushTimer ??= setTimeout(flush, NOTIFY_MS)
}

let installed = false
export function installConsoleCapture() {
  if (installed || typeof console === 'undefined') return
  installed = true
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      // Listeners render React; never do that synchronously inside someone else's render.
      queueMicrotask(() => push(level, args))
    }
  }
  window.addEventListener('error', event => push('error', [event.error ?? event.message]))
  window.addEventListener('unhandledrejection', event => push('error', [event.reason]))
}

export const consoleStore = {
  getEntries: () => entries,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  clear() {
    clearTimeout(flushTimer)
    flushTimer = undefined
    entries = []
    pending = []
    listeners.forEach(listener => listener())
  },
  setPaused(value: boolean) {
    paused = value
  },
  isPaused: () => paused,
}

export function useConsoleEntries(): LogEntry[] {
  return useSyncExternalStore(consoleStore.subscribe, consoleStore.getEntries, consoleStore.getEntries)
}
