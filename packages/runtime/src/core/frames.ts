import type { Unsubscribe } from './types'
export type FramePhase = 'input' | 'signals' | 'parameters' | 'simulation' | 'compute' | 'before-render' | 'post-render' | 'telemetry'
export interface FrameContext { time: number; delta: number; frame: number }
export interface FrameTask { id: string; phase: FramePhase; priority?: number; frequency?: number; run(context: FrameContext): void }
export class FrameCoordinator {
  private tasks = new Map<string, FrameTask & { accumulator: number }>()
  constructor(private onError?: (task: FrameTask, error: unknown) => void) {}
  add(task: FrameTask): Unsubscribe {
    const entry = { ...task, accumulator: 0 }
    this.tasks.set(task.id, entry)
    return () => { if (this.tasks.get(task.id) === entry) this.tasks.delete(task.id) }
  }
  run(phase: FramePhase, ctx: FrameContext): void {
    const tasks = [...this.tasks.values()].filter((t) => t.phase === phase).sort((a,b) => (a.priority ?? 0) - (b.priority ?? 0))
    for (const task of tasks) {
      if (task.frequency && task.frequency > 0) { task.accumulator += ctx.delta; const interval = 1/task.frequency; if (task.accumulator < interval) continue; task.accumulator %= interval }
      try { task.run(ctx) } catch (error) { this.onError?.(task, error) }
    }
  }
  has(id: string): boolean { return this.tasks.has(id) }
  list(): FrameTask[] { return [...this.tasks.values()] }
  dispose(): void { this.tasks.clear() }
}
