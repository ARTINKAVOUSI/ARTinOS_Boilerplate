import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'

export interface CollectionItem {
  id: string
  disabled?: boolean
  textValue?: string
}

export interface RovingCollection {
  activeId?: string
  setActiveId(id?: string): void
  tabIndex(id: string): 0 | -1
  onKeyDown(event: KeyboardEvent, id: string): void
}

export function useRovingCollection(
  items: CollectionItem[],
  options: { orientation?: 'horizontal' | 'vertical' | 'both'; loop?: boolean; onActivate?(id: string): void } = {},
): RovingCollection {
  const enabled = useMemo(() => items.filter(item => !item.disabled), [items])
  const [activeId, setActiveId] = useState<string | undefined>(() => enabled[0]?.id)
  const move = useCallback((id: string, delta: number) => {
    if (!enabled.length) return
    const current = Math.max(0, enabled.findIndex(item => item.id === id))
    const raw = current + delta
    const index = options.loop === false ? Math.max(0, Math.min(enabled.length - 1, raw)) : (raw + enabled.length) % enabled.length
    setActiveId(enabled[index]?.id)
  }, [enabled, options.loop])
  const onKeyDown = useCallback((event: KeyboardEvent, id: string) => {
    const horizontal = options.orientation === 'horizontal' || options.orientation === 'both'
    const vertical = options.orientation !== 'horizontal'
    if ((vertical && event.key === 'ArrowDown') || (horizontal && event.key === 'ArrowRight')) { event.preventDefault(); move(id, 1) }
    else if ((vertical && event.key === 'ArrowUp') || (horizontal && event.key === 'ArrowLeft')) { event.preventDefault(); move(id, -1) }
    else if (event.key === 'Home') { event.preventDefault(); setActiveId(enabled[0]?.id) }
    else if (event.key === 'End') { event.preventDefault(); setActiveId(enabled.at(-1)?.id) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); options.onActivate?.(id) }
  }, [enabled, move, options])
  return {
    activeId,
    setActiveId,
    tabIndex: id => id === (activeId ?? enabled[0]?.id) ? 0 : -1,
    onKeyDown,
  }
}

export function filterCollection<T extends CollectionItem>(items: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return items
  return items.filter(item => (item.textValue ?? item.id).toLocaleLowerCase().includes(needle))
}
