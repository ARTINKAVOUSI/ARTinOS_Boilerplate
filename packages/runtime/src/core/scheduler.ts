import type { FrameCoordinator } from './frames'
import type { ParameterScheduleMode } from './types'

export interface UpdateScheduleOptions<T> {
  value: T
  delayMs?: number
  intervalMs?: number
  reducer?(previous: T, next: T): T
}

export interface ScheduledHandle {
  readonly key: string
  readonly mode: ParameterScheduleMode
  readonly pending: boolean
  flush(): void
  cancel(): void
}

interface ScheduledEntry<T = unknown> {
  key: string
  mode: ParameterScheduleMode
  value: T
  apply(value: T): void
  reducer?: (previous: T, next: T) => T
  timer?: ReturnType<typeof setTimeout>
}

type FrameRequest = (callback: (time: number) => void) => number
type FrameCancel = (handle: number) => void
type IdleRequest = (callback: () => void) => number
type IdleCancel = (handle: number) => void

/**
 * One demand-driven queue for parameter/UI settling work.
 * It owns no perpetual loop: frame and idle callbacks exist only while work is pending.
 */
export class UpdateScheduler {
  private entries = new Map<string, ScheduledEntry>()
  private lastApplied = new Map<string, number>()
  private animationHandle?: number
  private idleHandle?: number
  private microtaskPending = false
  private releaseRenderTask?: () => void
  private disposed = false

  constructor(private frames?: FrameCoordinator) {}

  schedule<T>(
    key: string,
    mode: ParameterScheduleMode,
    apply: (value: T) => void,
    options: UpdateScheduleOptions<T>,
  ): ScheduledHandle {
    if (this.disposed) throw new Error('UpdateScheduler is disposed')
    const existing = this.entries.get(key) as ScheduledEntry<T> | undefined
    const value = existing?.reducer
      ? existing.reducer(existing.value, options.value)
      : options.reducer && existing
        ? options.reducer(existing.value, options.value)
        : options.value
    if (existing?.timer) clearTimeout(existing.timer)
    const entry: ScheduledEntry<T> = { key, mode, value, apply, reducer: options.reducer }
    this.entries.set(key, entry as ScheduledEntry)

    if (mode === 'immediate') this.flush(key)
    else if (mode === 'microtask') this.requestMicrotask()
    else if (mode === 'animation-frame') this.requestAnimationFrame()
    else if (mode === 'render-frame') this.requestRenderFrame()
    else if (mode === 'idle') this.requestIdle()
    else if (mode === 'debounced') {
      entry.timer = setTimeout(() => this.flush(key), Math.max(0, options.delayMs ?? 120))
    } else if (mode === 'throttled') {
      const interval = Math.max(0, options.intervalMs ?? options.delayMs ?? 50)
      const elapsed = this.now() - (this.lastApplied.get(key) ?? -Infinity)
      if (elapsed >= interval) this.flush(key)
      else entry.timer = setTimeout(() => this.flush(key), interval - elapsed)
    }

    const scheduler = this
    return {
      key,
      mode,
      get pending() { return scheduler.entries.has(key) },
      flush: () => this.flush(key),
      cancel: () => this.cancel(key),
    }
  }

  flush(key?: string): void {
    if (key !== undefined) {
      const entry = this.entries.get(key)
      if (!entry) return
      this.entries.delete(key)
      if (entry.timer) clearTimeout(entry.timer)
      entry.apply(entry.value)
      this.lastApplied.set(key, this.now())
      this.releaseRenderFrameIfIdle()
      return
    }
    for (const pendingKey of [...this.entries.keys()]) this.flush(pendingKey)
  }

  cancel(key: string): void {
    const entry = this.entries.get(key)
    if (entry?.timer) clearTimeout(entry.timer)
    this.entries.delete(key)
    this.releaseRenderFrameIfIdle()
  }

  dispose(): void {
    this.disposed = true
    for (const entry of this.entries.values()) if (entry.timer) clearTimeout(entry.timer)
    this.entries.clear()
    this.lastApplied.clear()
    if (this.animationHandle !== undefined) this.cancelFrame()(this.animationHandle)
    if (this.idleHandle !== undefined) this.cancelIdle()(this.idleHandle)
    this.animationHandle = undefined
    this.idleHandle = undefined
    this.releaseRenderTask?.()
    this.releaseRenderTask = undefined
  }

  private flushMode(mode: ParameterScheduleMode): void {
    for (const [key, entry] of [...this.entries]) if (entry.mode === mode) this.flush(key)
  }

  private requestMicrotask(): void {
    if (this.microtaskPending) return
    this.microtaskPending = true
    queueMicrotask(() => {
      this.microtaskPending = false
      if (!this.disposed) this.flushMode('microtask')
    })
  }

  private requestAnimationFrame(): void {
    if (this.animationHandle !== undefined) return
    this.animationHandle = this.requestFrame()(() => {
      this.animationHandle = undefined
      if (!this.disposed) {
        this.flushMode('animation-frame')
        if (!this.frames) this.flushMode('render-frame')
      }
    })
  }

  private requestIdle(): void {
    if (this.idleHandle !== undefined) return
    this.idleHandle = this.requestIdleCallback()(() => {
      this.idleHandle = undefined
      if (!this.disposed) this.flushMode('idle')
    })
  }

  private requestRenderFrame(): void {
    if (!this.frames) { this.requestAnimationFrame(); return }
    if (this.releaseRenderTask) return
    this.releaseRenderTask = this.frames.add({
      id: 'core.update-scheduler',
      phase: 'before-render',
      priority: -1_000,
      run: () => this.flushMode('render-frame'),
    })
  }

  private releaseRenderFrameIfIdle(): void {
    const hasRenderWork = [...this.entries.values()].some(entry => entry.mode === 'render-frame')
    if (!hasRenderWork) {
      this.releaseRenderTask?.()
      this.releaseRenderTask = undefined
    }
  }

  private now(): number { return globalThis.performance?.now() ?? Date.now() }
  private requestFrame(): FrameRequest {
    return typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : callback => setTimeout(() => callback(this.now()), 16) as unknown as number
  }
  private cancelFrame(): FrameCancel {
    return typeof globalThis.cancelAnimationFrame === 'function'
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : handle => clearTimeout(handle)
  }
  private requestIdleCallback(): IdleRequest {
    const request = (globalThis as typeof globalThis & { requestIdleCallback?: IdleRequest }).requestIdleCallback
    return request?.bind(globalThis) ?? (callback => setTimeout(callback, 1) as unknown as number)
  }
  private cancelIdle(): IdleCancel {
    const cancel = (globalThis as typeof globalThis & { cancelIdleCallback?: IdleCancel }).cancelIdleCallback
    return cancel?.bind(globalThis) ?? (handle => clearTimeout(handle))
  }
}
