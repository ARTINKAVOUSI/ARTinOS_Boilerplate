import { useCallback, useSyncExternalStore } from 'react'
import type { PanelIcon } from './panel-types'

export interface CommandItem {
  /** Stable across queries — used for keying and for the recents list. */
  id: string
  title: string
  /** Live context: a current value, a category, a path. Rendered dim beside the title. */
  subtitle?: string
  /** Section heading in the palette. */
  group: string
  /** Extra text folded into matching but not displayed. */
  keywords?: string
  icon?: PanelIcon
  /** Shown right-aligned, e.g. `"toggle"` or `"⏎ open"`. */
  hint?: string
  run(): void
}

export interface CommandSource {
  id: string
  /**
   * Produce items for the current query. Called on every keystroke, so a source over a
   * large registry should pre-filter cheaply and let the palette do the ranking.
   */
  collect(query: string): CommandItem[]
}

const sources = new Map<string, CommandSource>()
const listeners = new Set<() => void>()
let revision = 0

function publish() {
  revision++
  for (const listener of listeners) listener()
}

/**
 * Registers a palette source. Any package or project file can contribute without the
 * palette knowing about it — that is what keeps the palette content-aware rather than
 * hard-coded to a fixed list of commands.
 *
 * Returns an unregister function; call it on unmount.
 */
export function registerCommandSource(source: CommandSource): () => void {
  sources.set(source.id, source)
  publish()
  return () => {
    if (sources.get(source.id) === source) {
      sources.delete(source.id)
      publish()
    }
  }
}

export function listCommandSources(): CommandSource[] {
  return [...sources.values()]
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Re-renders when the set of registered sources changes. */
export function useCommandSources(): CommandSource[] {
  const snapshot = useCallback(() => revision, [])
  useSyncExternalStore(subscribe, snapshot, snapshot)
  return listCommandSources()
}
