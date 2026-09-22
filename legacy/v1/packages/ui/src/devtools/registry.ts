import type { ComponentState } from '../kernel'

export interface ComponentInstanceRecord { id: string; component: string; parameter?: string; state: ComponentState; anatomy?: string[]; source?: string; subscriptions?: string[]; layout?: Record<string, unknown>; accessibility?: Record<string, unknown>; mountedAt: number }

export class ComponentInstanceRegistry {
  revision = 0
  private instances = new Map<string, ComponentInstanceRecord>()
  private simulations = new Map<string, Partial<ComponentState>>()
  private listeners = new Set<() => void>()
  mount(record: Omit<ComponentInstanceRecord, 'mountedAt'>): () => void { this.instances.set(record.id, { ...record, mountedAt: performance.now() }); this.bump(); return () => { this.instances.delete(record.id); this.simulations.delete(record.id); this.bump() } }
  update(id: string, patch: Partial<ComponentInstanceRecord>): void { const record = this.instances.get(id); if (record) { this.instances.set(id, { ...record, ...patch }); this.bump() } }
  simulate(id: string, state: Partial<ComponentState>): void { this.simulations.set(id, state); this.bump() }
  clearSimulation(id: string): void { if (this.simulations.delete(id)) this.bump() }
  simulation(id: string): Partial<ComponentState> | undefined { return this.simulations.get(id) }
  list(): Array<ComponentInstanceRecord & { simulatedState?: Partial<ComponentState> }> { return [...this.instances.values()].map(record => ({ ...record, simulatedState: this.simulations.get(record.id) })) }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private bump() { this.revision++; this.listeners.forEach(listener => listener()) }
}

export const componentInstances = new ComponentInstanceRegistry()
