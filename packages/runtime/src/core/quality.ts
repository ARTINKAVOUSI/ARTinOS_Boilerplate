import type { Unsubscribe } from './types'
export type QualityTier = 'low' | 'balanced' | 'high' | 'ultra'
export interface QualityState { tier: QualityTier; scalar: number; mode: 'auto' | 'manual'; targetFps: number }
export class QualityManager {
  private state: QualityState = { tier: 'high', scalar: 1, mode: 'auto', targetFps: 60 }
  private listeners = new Set<() => void>()
  private consumers = new Map<string, (state: QualityState) => void>()
  getState = () => this.state
  setState(patch: Partial<QualityState>) { this.state = { ...this.state, ...patch, scalar: Math.max(.4, Math.min(1, patch.scalar ?? this.state.scalar)) }; this.listeners.forEach(f=>f()); this.consumers.forEach(f=>f(this.state)) }
  subscribe = (fn: () => void): Unsubscribe => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  register(id: string, fn: (state: QualityState) => void): Unsubscribe { this.consumers.set(id, fn); fn(this.state); return () => this.consumers.delete(id) }
  listConsumers() { return [...this.consumers.keys()] }
}
