import { useMemo, useState, type ReactNode } from 'react'
import { fuzzyFilter, splitRanges, useVariableVirtual, useVirtual, type FuzzyMatch } from '../headless'
import { SearchField } from './text'
import { Empty } from './layout'

/** Renders a string with its fuzzy-match ranges emphasised. */
export function Highlight({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  if (!ranges.length) return <>{text}</>
  return (
    <>
      {splitRanges(text, ranges).map((part, index) => (part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>))}
    </>
  )
}

export interface VirtualListProps<T> {
  items: T[]
  /** Uniform row height in pixels. Rows that do not match this will overlap. */
  itemHeight: number
  children(item: T, index: number): ReactNode
  /** Rendered instead of the list when `items` is empty. */
  empty?: ReactNode
  className?: string
}

/**
 * Renders only the rows inside the viewport. Use for any list that can exceed ~200 rows:
 * console output, module registries, telemetry metrics, resources.
 */
export function VirtualList<T>({ items, itemHeight, children, empty, className = '' }: VirtualListProps<T>) {
  const view = useVirtual({ count: items.length, itemHeight })
  if (!items.length && empty) return <Empty>{empty}</Empty>
  return (
    <div ref={view.ref} className={`artinos-virtual ${className}`}>
      <div style={{ height: view.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${view.offset}px)` }}>
          {items.slice(view.start, view.end).map((item, offset) => (
            <div key={view.start + offset} style={{ height: itemHeight }} className="artinos-virtual-row">
              {children(item, view.start + offset)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Same windowing as `VirtualList`, laid out as a fixed-column grid. */
export function VirtualGrid<T>({
  items,
  itemHeight,
  columns,
  children,
  empty,
  className = '',
}: VirtualListProps<T> & { columns: number }) {
  const view = useVirtual({ count: items.length, itemHeight, columns })
  if (!items.length && empty) return <Empty>{empty}</Empty>
  return (
    <div ref={view.ref} className={`artinos-virtual ${className}`}>
      <div style={{ height: view.totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${view.offset}px)`,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridAutoRows: `${itemHeight}px`,
          }}
        >
          {items.slice(view.start, view.end).map((item, offset) => (
            <div key={view.start + offset}>{children(item, view.start + offset)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface VariableVirtualListProps<T> {
  items: T[]
  getItemSize(item: T, index: number): number
  children(item: T, index: number): ReactNode
  empty?: ReactNode
  className?: string
}

export function VariableVirtualList<T>({ items, getItemSize, children, empty, className = '' }: VariableVirtualListProps<T>) {
  const sizeAt = useMemo(() => (index: number) => getItemSize(items[index], index), [getItemSize, items])
  const view = useVariableVirtual({ count: items.length, getItemSize: sizeAt })
  if (!items.length && empty) return <Empty>{empty}</Empty>
  return (
    <div ref={view.ref} className={`artinos-virtual ${className}`}>
      <div style={{ height: view.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${view.offset}px)` }}>
          {items.slice(view.start, view.end).map((item, offset) => {
            const index = view.start + offset
            return <div key={index} style={{ height: view.sizes[index] }} className="artinos-virtual-row">{children(item, index)}</div>
          })}
        </div>
      </div>
    </div>
  )
}

export interface VirtualTableColumn<T> {
  id: string
  label: string
  width?: number | string
  render(item: T, index: number): ReactNode
}

export function VirtualTable<T>({ items, columns, rowHeight = 32, getRowKey, empty }: {
  items: T[]
  columns: VirtualTableColumn<T>[]
  rowHeight?: number
  getRowKey(item: T, index: number): string
  empty?: ReactNode
}) {
  const template = columns.map(column => typeof column.width === 'number' ? `${column.width}px` : column.width ?? 'minmax(0,1fr)').join(' ')
  return (
    <div className="artinos-virtual-table" role="table">
      <div role="row" className="artinos-virtual-table__header" style={{ gridTemplateColumns: template }}>
        {columns.map(column => <span key={column.id} role="columnheader">{column.label}</span>)}
      </div>
      <VirtualList items={items} itemHeight={rowHeight} empty={empty}>
        {(item, index) => (
          <div key={getRowKey(item, index)} role="row" className="artinos-virtual-table__row" style={{ gridTemplateColumns: template }}>
            {columns.map(column => <span key={column.id} role="cell">{column.render(item, index)}</span>)}
          </div>
        )}
      </VirtualList>
    </div>
  )
}

export interface ListBrowserFilter {
  id: string
  label: string
  options: string[]
  value: string
  onChange(value: string): void
}

export interface ListBrowserProps<T> {
  items: T[]
  /** The string each item is matched against. */
  searchable(item: T): string
  /** Row renderer. `match` carries the ranges to highlight. */
  children(item: T, match: FuzzyMatch): ReactNode
  itemHeight: number
  placeholder?: string
  filters?: ListBrowserFilter[]
  /** Label describing what is being counted, e.g. `"modules"`. */
  countLabel?: string
  empty?: ReactNode
}

/**
 * Search + filter + virtualized list, the standard pattern for every registry panel.
 *
 * Ranking is fuzzy rather than substring, so `psl` finds `postfx.slot` — which matters
 * once a registry passes a hundred entries and exact prefixes stop being memorable.
 */
export function ListBrowser<T>({
  items,
  searchable,
  children,
  itemHeight,
  placeholder = 'Search…',
  filters = [],
  countLabel = 'items',
  empty = 'Nothing matches this search',
}: ListBrowserProps<T>) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => fuzzyFilter(items, query, searchable), [items, query, searchable])

  return (
    <div className="artinos-list-browser">
      <SearchField value={query} onChange={setQuery} placeholder={placeholder} />
      {filters.length > 0 && (
        <div className="artinos-filter-grid">
          {filters.map(filter => (
            <label key={filter.id} className="artinos-control">
              <span>{filter.label}</span>
              <select value={filter.value} onChange={event => filter.onChange(event.target.value)}>
                {filter.options.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <div className="artinos-list-browser-count">
        {results.length}/{items.length} {countLabel}
      </div>
      <VirtualList items={results} itemHeight={itemHeight} empty={empty}>
        {result => children(result.item, result.match)}
      </VirtualList>
    </div>
  )
}
