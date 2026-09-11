import { createContext, useContext, useEffect, useId, useSyncExternalStore, type PropsWithChildren } from 'react'
import type { ComponentState } from '../kernel'
import { componentInstances, type ComponentInstanceRegistry } from './registry'

const Context = createContext<ComponentInstanceRegistry>(componentInstances)
export function ComponentDevToolsProvider({ children, registry = componentInstances }: PropsWithChildren<{ registry?: ComponentInstanceRegistry }>) { return <Context.Provider value={registry}>{children}</Context.Provider> }
export const useComponentDevTools = () => useContext(Context)
export function useComponentInstance(component: string, options: { parameter?: string; state?: ComponentState; anatomy?: string[]; source?: string; subscriptions?: string[]; layout?: Record<string, unknown>; accessibility?: Record<string, unknown> } = {}) {
  const registry = useComponentDevTools(); const generated = useId(); const id = `${component}:${generated}`
  const stateKey = JSON.stringify(options.state ?? {}), anatomyKey = options.anatomy?.join('|') ?? '', subscriptionsKey = options.subscriptions?.join('|') ?? '', layoutKey = JSON.stringify(options.layout ?? {}), accessibilityKey = JSON.stringify(options.accessibility ?? {})
  useEffect(() => registry.mount({ id, component, state: options.state ?? {}, parameter: options.parameter, anatomy: options.anatomy, source: options.source, subscriptions: options.subscriptions, layout: options.layout, accessibility: options.accessibility }), [registry, id, component])
  useEffect(() => registry.update(id, options), [registry, id, options.parameter, options.source, stateKey, anatomyKey, subscriptionsKey, layoutKey, accessibilityKey])
  const simulatedState = useSyncExternalStore(callback => registry.subscribe(callback), () => registry.simulation(id), () => undefined)
  return { id, simulatedState }
}
