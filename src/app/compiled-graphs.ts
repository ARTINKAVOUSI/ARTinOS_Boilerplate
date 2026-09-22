/**
 * Where compiled GPU graphs are published.
 *
 * A leaf module on purpose: the Graph effect is discovered by the registry, so
 * it cannot import the graph runner (which reads the registry) without a cycle.
 * The runner publishes here, the effect subscribes here, and neither knows about
 * the other.
 */

export interface CompiledGraphEntry {
  id: string
  name: string
  /** The TSL node the graph's Output publishes. */
  node: unknown
}

let entries: readonly CompiledGraphEntry[] = []
const listeners = new Set<() => void>()

export const compiledGraphs = {
  publish(next: readonly CompiledGraphEntry[]) {
    // Same nodes in the same order means nothing downstream has to rebuild.
    if (next.length === entries.length && next.every((entry, index) => entries[index].id === entry.id && entries[index].node === entry.node)) return
    entries = next
    listeners.forEach(listener => listener())
  },
  getEntries: () => entries,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
